-- models/intermediate/int_orders_enriched.sql
--
-- One row per order, enriched with:
--   - customer identity (unique_id for cross-order analysis)
--   - aggregated payment info (total paid, primary payment type)
--   - review score
--   - pre-computed delivery performance flags
--
-- mart_cohorts, mart_logistics, and mart_rfm all read from here.
-- Keeping the join logic here means each mart stays focused on aggregation.

with orders as (
    select * from {{ ref('stg_orders') }}
),

customers as (
    select * from {{ ref('stg_customers') }}
),

-- Aggregate payments to one row per order: total amount paid + primary method
payments_agg as (
    select
        order_id,
        sum(payment_value)                                  as total_payment_value,
        -- primary payment type = the one with the largest value on this order
        first(payment_type order by payment_value desc)     as primary_payment_type,
        sum(payment_installments)                           as total_installments,
        count(*)                                            as payment_line_count
    from {{ ref('stg_order_payments') }}
    group by order_id
),

-- One review per order (already deduped in staging)
reviews as (
    select
        order_id,
        review_score,
        is_negative_review,
        review_created_at
    from {{ ref('stg_order_reviews') }}
)

select
    -- order identity
    o.order_id,
    o.customer_id,

    -- customer identity — customer_unique_id tracks the same person across orders
    c.customer_unique_id,
    c.city              as customer_city,
    c.state             as customer_state,
    c.zip_code_prefix   as customer_zip_code_prefix,

    -- order status & timing
    o.order_status,
    o.purchased_at,
    o.approved_at,
    o.shipped_at,
    o.delivered_at,
    o.estimated_delivery_at,
    o.order_date,
    o.order_month,
    o.order_year,

    -- delivery performance (pre-computed in stg_orders)
    o.approval_lag_hours,
    o.actual_delivery_days,
    o.estimated_delivery_days,
    o.delivery_delta_days,          -- negative = early, positive = late
    case
        when o.delivery_delta_days > 0 then true
        else false
    end                             as is_late_delivery,

    -- payment summary
    p.total_payment_value,
    p.primary_payment_type,
    p.total_installments,
    p.payment_line_count,

    -- review
    r.review_score,
    r.is_negative_review,
    r.review_created_at

from orders o
left join customers    c  on o.customer_id = c.customer_id
left join payments_agg p  on o.order_id    = p.order_id
left join reviews      r  on o.order_id    = r.order_id
