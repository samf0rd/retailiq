-- models/marts/mart_sellers.sql
--
-- Seller performance scorecard.
--
-- SQL techniques demonstrated:
--   RANK() OVER()           → overall seller revenue ranking
--   PERCENT_RANK() OVER()   → relative percentile position (0.0–1.0)
--   Conditional aggregation → defect rate, late rate, negative review rate
--   FILTER clause           → clean conditional counts without CASE WHEN noise
--
-- Grain: one row per seller_id.
-- Feeds the Seller Performance dashboard page and the business recommendation
-- on seller onboarding quality (newer sellers vs established).

with item_facts as (
    select
        oi.seller_id,
        oi.seller_city,
        oi.seller_state,
        oi.order_id,
        oi.item_price,
        oi.freight_value,
        oi.line_total,
        oi.category_name_en,
        o.order_status,
        o.purchased_at,
        o.delivered_at,
        o.actual_delivery_days,
        o.delivery_delta_days,
        o.is_late_delivery,
        o.review_score,
        o.is_negative_review,
        o.total_payment_value
    from {{ ref('int_order_items_enriched') }} oi
    inner join {{ ref('int_orders_enriched') }}  o
        on oi.order_id = o.order_id
),

-- ── Step 1: aggregate seller metrics ───────────────────────────────────────
seller_metrics as (
    select
        seller_id,
        seller_city,
        seller_state,

        -- volume
        count(distinct order_id)                                as total_orders,
        count(*)                                                as total_items,
        count(distinct category_name_en)                        as categories_sold,

        -- revenue
        round(sum(item_price),    2)                            as total_product_revenue,
        round(sum(freight_value), 2)                            as total_freight_revenue,
        round(sum(line_total),    2)                            as total_gross_revenue,
        round(avg(item_price),    2)                            as avg_item_price,

        -- delivery performance
        round(avg(actual_delivery_days), 1)                     as avg_delivery_days,
        round(avg(delivery_delta_days),  1)                     as avg_delivery_delta,

        -- rates (conditional aggregation)
        round(
            count(*) filter (where is_late_delivery = true)::double
            / nullif(count(*), 0) * 100,
        2)                                                      as late_delivery_rate_pct,

        round(
            count(*) filter (where order_status = 'canceled')::double
            / nullif(count(distinct order_id), 0) * 100,
        2)                                                      as cancellation_rate_pct,

        -- review quality
        round(avg(review_score), 2)                             as avg_review_score,
        round(
            count(*) filter (where is_negative_review = true)::double
            / nullif(count(*), 0) * 100,
        2)                                                      as negative_review_rate_pct,

        -- tenure proxy: first and last sale date
        min(purchased_at)                                       as first_sale_at,
        max(purchased_at)                                       as last_sale_at

    from item_facts
    where seller_id is not null
    group by seller_id, seller_city, seller_state
),

-- ── Step 2: rank sellers on revenue and review score ───────────────────────
ranked as (
    select
        *,

        -- RANK: 1 = top revenue seller (ties share a rank, gap after)
        rank() over (order by total_gross_revenue desc)         as revenue_rank,

        -- PERCENT_RANK: 1.0 = top seller, 0.0 = lowest
        -- Useful for "this seller is in the top 10% of revenue"
        round(
            percent_rank() over (order by total_gross_revenue asc) * 100,
        1)                                                      as revenue_percentile,

        -- Rank by review quality
        rank() over (order by avg_review_score desc nulls last) as review_rank,

        -- Composite performance tier
        case
            when percent_rank() over (order by total_gross_revenue asc) >= 0.8
                 and avg_review_score >= 4.0
                then 'Elite'
            when percent_rank() over (order by total_gross_revenue asc) >= 0.5
                then 'Established'
            when total_orders >= 5
                then 'Growing'
            else 'New'
        end                                                     as seller_tier

    from seller_metrics
)

select * from ranked
order by revenue_rank
