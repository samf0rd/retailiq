-- models/marts/mart_cohorts.sql
--
-- Customer cohort retention matrix.
--
-- SQL techniques demonstrated:
--   Self-join (CTE referencing itself via first-order subquery)
--   DATEDIFF on months to compute "periods since first purchase"
--   Conditional COUNT / COUNT DISTINCT for retention rates
--   NTILE (in mart_rfm) — similar pattern, shown here via manual quintiling
--
-- Grain: one row per (cohort_month, periods_since_first_order).
-- Answers: "Of all customers who first bought in month X, what % came back
--           in month X+1, X+2, X+3 ...?"
-- This is the classic retention heatmap displayed on the Cohort page.
--
-- Important Olist data note: Olist is a marketplace, not a subscription product.
-- Repeat-purchase rates are naturally low (most customers buy once). We present
-- this honestly — the analysis shows WHEN repeat purchases happen, not that
-- they're high. Framed correctly, this is still a strong demonstration.

-- ── Step 1: first order date per customer (using unique id, not order id) ──
with first_orders as (
    select
        customer_unique_id,
        min(order_month)                    as cohort_month,
        min(purchased_at)                   as first_order_at
    from {{ ref('int_orders_enriched') }}
    where order_status in ('delivered', 'shipped', 'invoiced', 'approved')
      and customer_unique_id is not null
    group by customer_unique_id
),

-- ── Step 2: all orders per customer with their cohort month attached ────────
orders_with_cohort as (
    select
        o.customer_unique_id,
        o.order_month,
        o.purchased_at,
        f.cohort_month,

        -- how many months after their first purchase did this order happen?
        -- month 0 = the cohort month itself (first purchase)
        datediff(
            'month',
            f.cohort_month,
            o.order_month
        )                                   as periods_since_first_order

    from {{ ref('int_orders_enriched') }}   o
    inner join first_orders                 f
        on o.customer_unique_id = f.customer_unique_id
    where o.order_status in ('delivered', 'shipped', 'invoiced', 'approved')
      and o.customer_unique_id is not null
),

-- ── Step 3: cohort size — how many unique customers in each cohort month ────
cohort_sizes as (
    select
        cohort_month,
        count(distinct customer_unique_id)  as cohort_size
    from first_orders
    group by cohort_month
),

-- ── Step 4: retention counts — distinct customers active in each period ─────
retention_counts as (
    select
        cohort_month,
        periods_since_first_order,
        count(distinct customer_unique_id)  as active_customers

    from orders_with_cohort
    group by 1, 2
),

-- ── Step 5: join sizes to counts, compute retention rate ───────────────────
final as (
    select
        rc.cohort_month,
        rc.periods_since_first_order,
        cs.cohort_size,
        rc.active_customers,

        -- retention rate: what % of the original cohort came back in this period
        round(
            rc.active_customers::double / nullif(cs.cohort_size, 0) * 100,
        2)                                  as retention_rate_pct,

        -- absolute churn from previous period (for waterfall charts)
        rc.active_customers
            - lag(rc.active_customers) over (
                partition by rc.cohort_month
                order by rc.periods_since_first_order
              )                             as period_churn

    from retention_counts   rc
    inner join cohort_sizes cs  on rc.cohort_month = cs.cohort_month
)

select * from final
order by cohort_month, periods_since_first_order
