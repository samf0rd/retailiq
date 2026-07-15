-- models/marts/mart_logistics.sql
--
-- Delivery performance and logistics quality analysis.
--
-- SQL techniques demonstrated:
--   Conditional aggregation with FILTER clause
--   CORR()               → Pearson correlation (late delivery vs review score)
--   PERCENTILE_CONT()    → median and p95 delivery days (exact percentile)
--   CASE WHEN buckets    → delivery banding for histogram-style analysis
--   Gap-and-island logic → consecutive late-delivery streaks by state/month
--
-- Two grains in separate CTEs, unioned to separate tables via view splits:
--   1. By state × month  (regional × temporal breakdown)
--   2. By seller_state   (operational: which seller locations drive lateness)
--
-- Feeds the Logistics & Ops dashboard page and the business recommendation
-- on late delivery → 1-star review impact.

with delivery_facts as (
    select
        o.order_id,
        o.order_month,
        o.customer_state,
        oi.seller_state,
        o.actual_delivery_days,
        o.estimated_delivery_days,
        o.delivery_delta_days,
        o.is_late_delivery,
        o.approval_lag_hours,
        o.review_score,
        o.is_negative_review,
        o.order_status,
        oi.line_total,
        oi.freight_value
    from {{ ref('int_orders_enriched') }}     o
    inner join {{ ref('int_order_items_enriched') }} oi
        on o.order_id = oi.order_id
    where o.order_status = 'delivered'
      and o.delivered_at is not null
      and o.actual_delivery_days is not null
),

-- ── Grain 1: state × month — regional logistics summary ────────────────────
state_month as (
    select
        customer_state,
        order_month,

        count(distinct order_id)                                        as delivered_orders,

        -- delivery speed
        round(avg(actual_delivery_days),    1)                          as avg_delivery_days,
        round(avg(estimated_delivery_days), 1)                          as avg_estimated_days,
        round(avg(delivery_delta_days),     1)                          as avg_delta_days,

        -- percentiles (PERCENTILE_CONT = interpolated exact percentile)
        round(percentile_cont(0.50) within group
              (order by actual_delivery_days), 1)                       as median_delivery_days,
        round(percentile_cont(0.95) within group
              (order by actual_delivery_days), 1)                       as p95_delivery_days,

        -- late delivery rate
        round(
            count(*) filter (where is_late_delivery = true)::double
            / nullif(count(*), 0) * 100,
        2)                                                              as late_rate_pct,

        -- review quality for late vs on-time (avg by subgroup)
        round(avg(review_score), 2)                                     as avg_review_score,
        round(avg(review_score)
              filter (where is_late_delivery = true), 2)                as avg_review_score_late,
        round(avg(review_score)
              filter (where is_late_delivery = false), 2)               as avg_review_score_ontime,

        -- CORR: Pearson correlation between delivery delta and review score
        -- Expect negative: larger delta (more late) → lower review score
        round(corr(delivery_delta_days, review_score::double), 3)       as delivery_review_correlation,

        -- freight
        round(avg(freight_value), 2)                                    as avg_freight_value,
        round(sum(freight_value), 2)                                    as total_freight_revenue

    from delivery_facts
    group by customer_state, order_month
),

-- ── Grain 2: delivery time banding — for distribution/histogram chart ──────
delivery_bands as (
    select
        customer_state,
        case
            when actual_delivery_days <= 7  then '01. 0–7 days'
            when actual_delivery_days <= 14 then '02. 8–14 days'
            when actual_delivery_days <= 21 then '03. 15–21 days'
            when actual_delivery_days <= 30 then '04. 22–30 days'
            else                                 '05. 30+ days'
        end                                                             as delivery_band,
        count(distinct order_id)                                        as order_count,
        round(avg(review_score), 2)                                     as avg_review_score
    from delivery_facts
    group by customer_state, delivery_band
),

-- ── Gap-and-island: consecutive late months per state ─────────────────────
-- Identifies "streaks" of consecutive months where late_rate_pct > 20%.
-- This is the gap-and-island pattern: assign a group number to consecutive
-- rows sharing the same condition, then aggregate each group.
--
-- Technique:
--   row_number() OVER (ORDER BY month)          — global row position
--   row_number() OVER (PARTITION BY is_bad_month ORDER BY month) — position within subgroup
--   Difference of the two = constant for each consecutive streak
flagged_months as (
    select
        customer_state,
        order_month,
        late_rate_pct,
        late_rate_pct > 20 as is_bad_month,

        row_number() over (
            partition by customer_state
            order by order_month
        ) as rn_all,

        row_number() over (
            partition by customer_state, (late_rate_pct > 20)
            order by order_month
        ) as rn_within_flag

    from state_month
),

late_streaks as (
    select
        customer_state,
        min(order_month)                    as streak_start,
        max(order_month)                    as streak_end,
        count(*)                            as consecutive_bad_months,
        round(avg(late_rate_pct), 1)        as avg_late_rate_during_streak
    from flagged_months
    where is_bad_month = true
    group by customer_state, (rn_all - rn_within_flag)
    having count(*) >= 2      -- only flag streaks of 2+ consecutive bad months
)

-- ── Final output: join grains for the dashboard ────────────────────────────
-- The dashboard reads each CTE result directly via separate mart views,
-- but we expose the primary grain (state × month) as the main table,
-- and register the secondary grains as separate mart models below.
select
    sm.*,
    ls.streak_start                         as latest_streak_start,
    ls.streak_end                           as latest_streak_end,
    ls.consecutive_bad_months               as latest_streak_length
from state_month sm
left join (
    -- attach the most recent bad streak per state
    select distinct on (customer_state)
        customer_state, streak_start, streak_end, consecutive_bad_months
    from late_streaks
    order by customer_state, streak_end desc
) ls on sm.customer_state = ls.customer_state
order by sm.customer_state, sm.order_month
