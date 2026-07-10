-- models/marts/mart_rfm.sql
--
-- RFM (Recency, Frequency, Monetary) customer scoring.
--
-- SQL techniques demonstrated:
--   NTILE(5) OVER()   → quintile bucketing (the cleanest way to score)
--   Multiple window partitions in one model
--   CASE WHEN on quintile combos → named segments (Champions, At-Risk, etc.)
--   DATE_DIFF for recency calculation relative to a snapshot date
--
-- Grain: one row per customer_unique_id.
-- Feeds the ML segmentation (ml/segmentation.py reads this as input features)
-- and the Customer Segments dashboard page directly.
--
-- RFM explained:
--   R = how recently did they buy?    (lower days = better → high score)
--   F = how many orders total?        (more = better → high score)
--   M = how much did they spend?      (more = better → high score)
-- Each dimension is split into 5 equal buckets (NTILE 5). Score 5 = best.

with order_facts as (
    select
        customer_unique_id,
        order_id,
        purchased_at,
        -- A handful of Olist orders have no matching payment record.
        -- Coalesce to 0 here (row level) so it's explicit: missing payment
        -- means zero known spend for that order, not an unknown customer.
        coalesce(total_payment_value, 0)   as total_payment_value,
        order_status
    from {{ ref('int_orders_enriched') }}
    where order_status in ('delivered', 'shipped', 'invoiced', 'approved')
      and customer_unique_id is not null
),

-- ── Step 1: raw RFM metrics per customer ───────────────────────────────────
customer_metrics as (
    select
        customer_unique_id,

        -- Recency: days since last purchase (snapshot = max date in dataset)
        datediff(
            'day',
            max(purchased_at),
            (select max(purchased_at) from order_facts)
        )                                   as recency_days,

        -- Frequency: number of distinct orders
        count(distinct order_id)            as frequency,

        -- Monetary: total spend across all orders
        round(sum(total_payment_value), 2)  as monetary_value,

        -- Extra context columns for the dashboard
        min(purchased_at)                   as first_order_at,
        max(purchased_at)                   as last_order_at,
        count(distinct order_id)            as order_count

    from order_facts
    group by customer_unique_id
),

-- ── Step 2: NTILE quintile scoring ─────────────────────────────────────────
-- NTILE(5) divides all customers into 5 equal-sized buckets ordered by the metric.
-- For recency: we flip the order (lower days = better = higher score).
-- For frequency and monetary: higher = better = higher score.
scored as (
    select
        *,

        -- R score: 5 = most recent buyer, 1 = oldest (REVERSED order)
        ntile(5) over (order by recency_days asc)   as r_score,

        -- F score: 5 = most frequent buyer
        ntile(5) over (order by frequency asc)      as f_score,

        -- M score: 5 = highest spender
        ntile(5) over (order by monetary_value asc) as m_score

    from customer_metrics
),

-- ── Step 3: composite RFM score + named segment ────────────────────────────
segmented as (
    select
        *,

        -- simple additive composite (3–15 range)
        r_score + f_score + m_score             as rfm_score,

        -- named segment — logic mirrors standard RFM playbook
        case
            when r_score >= 4 and f_score >= 4 and m_score >= 4
                then 'Champions'            -- bought recently, often, and big
            when r_score >= 3 and f_score >= 3
                then 'Loyal Customers'      -- consistent buyers
            when r_score >= 4 and f_score <= 2
                then 'Recent Customers'     -- new buyers, frequency not yet built
            when r_score >= 3 and f_score <= 2 and m_score >= 3
                then 'Potential Loyalists'  -- decent spend, can be cultivated
            when r_score <= 2 and f_score >= 3
                then 'At Risk'              -- used to buy often, gone quiet
            when r_score = 1 and f_score >= 2
                then 'Cannot Lose Them'     -- high frequency, very lapsed
            when r_score <= 2 and f_score <= 2 and m_score <= 2
                then 'Hibernating'          -- low on all dimensions
            else 'Need Attention'           -- catch-all mid-tier
        end                                     as rfm_segment

    from scored
)

select
    customer_unique_id,
    recency_days,
    frequency,
    monetary_value,
    r_score,
    f_score,
    m_score,
    rfm_score,
    rfm_segment,
    first_order_at,
    last_order_at,
    order_count
from segmented
order by rfm_score desc, monetary_value desc
