-- models/marts/mart_revenue.sql
--
-- Monthly revenue analytics — the primary SQL showcase model.
--
-- SQL techniques demonstrated:
--   LAG()           → month-over-month revenue growth
--   SUM() OVER()    → running/cumulative revenue totals
--   RANK()          → category revenue ranking per month
--   FILTER clause   → conditional aggregation without CASE WHEN noise
--   CTEs            → step-by-step readable transformation chain
--
-- Grain: one row per (order_month, category_name_en).
-- The dashboard Revenue Deep Dive page reads directly from this table.

-- ── Step 1: base revenue facts ─────────────────────────────────────────────
with order_item_facts as (
    select
        oi.order_id,
        oi.category_name_en,
        oi.item_price,
        oi.freight_value,
        oi.line_total,
        o.order_month,
        o.order_date,
        o.customer_state,
        o.order_status,
        o.primary_payment_type,
        o.total_payment_value
    from {{ ref('int_order_items_enriched') }} oi
    inner join {{ ref('int_orders_enriched') }}  o
        on oi.order_id = o.order_id
    -- only count revenue from orders that actually completed
    where o.order_status in ('delivered', 'shipped', 'invoiced', 'approved')
),

-- ── Step 2: monthly revenue by category ────────────────────────────────────
monthly_category as (
    select
        order_month,
        coalesce(category_name_en, 'uncategorised') as category_name_en,

        -- volume
        count(distinct order_id)                as order_count,
        count(*)                                as item_count,

        -- revenue components
        round(sum(item_price),    2)            as product_revenue,
        round(sum(freight_value), 2)            as freight_revenue,
        round(sum(line_total),    2)            as gross_revenue,

        -- average order value for this category-month
        round(
            sum(item_price) / nullif(count(distinct order_id), 0),
        2)                                      as avg_item_price

    from order_item_facts
    group by 1, 2
),

-- ── Step 3: monthly totals (all categories combined) ───────────────────────
monthly_total as (
    select
        order_month,
        round(sum(gross_revenue), 2)            as total_gross_revenue,
        sum(order_count)                        as total_orders,
        sum(item_count)                         as total_items
    from monthly_category
    group by 1
),

-- ── Step 4: window functions — growth, running totals, ranking ─────────────
with_windows as (
    select
        mc.order_month,
        mc.category_name_en,
        mc.order_count,
        mc.item_count,
        mc.product_revenue,
        mc.freight_revenue,
        mc.gross_revenue,
        mc.avg_item_price,

        -- monthly totals (joined in so we can compute category share)
        mt.total_gross_revenue,
        mt.total_orders,

        -- category revenue share of month total
        round(
            mc.gross_revenue / nullif(mt.total_gross_revenue, 0) * 100,
        2)                                      as revenue_share_pct,

        -- ── WINDOW FUNCTIONS ──────────────────────────────────────────────

        -- LAG: previous month's revenue for this category → enables MoM growth
        lag(mc.gross_revenue) over (
            partition by mc.category_name_en
            order by mc.order_month
        )                                       as prev_month_revenue,

        -- MoM growth % (calculated below in next CTE to allow null handling)
        -- SUM OVER: running cumulative revenue per category across all months
        sum(mc.gross_revenue) over (
            partition by mc.category_name_en
            order by mc.order_month
            rows between unbounded preceding and current row
        )                                       as cumulative_revenue,

        -- SUM OVER: running cumulative total revenue (all categories)
        sum(mt.total_gross_revenue) over (
            order by mc.order_month
            rows between unbounded preceding and current row
        )                                       as cumulative_total_revenue,

        -- RANK: category revenue rank within each month
        rank() over (
            partition by mc.order_month
            order by mc.gross_revenue desc
        )                                       as category_rank_in_month

    from monthly_category mc
    inner join monthly_total mt on mc.order_month = mt.order_month
),

-- ── Step 5: compute growth % cleanly (avoids division in window clause) ────
final as (
    select
        *,
        -- MoM revenue growth for this category
        case
            when prev_month_revenue is null     then null   -- first month, no prior
            when prev_month_revenue = 0         then null   -- avoid division by zero
            else round(
                (gross_revenue - prev_month_revenue) / prev_month_revenue * 100,
            2)
        end                                     as mom_growth_pct,

        -- flag top-3 categories by revenue in each month (for dashboard highlights)
        category_rank_in_month <= 3             as is_top3_category

    from with_windows
)

select * from final
order by order_month, category_rank_in_month
