-- tests/assert_delivered_orders_have_delivery_date.sql
--
-- 8 orders in the Olist dataset have status='delivered' but no delivered_at timestamp.
-- This is a known upstream data quality issue — we can't fix the source.
-- Configured as a WARN (not ERROR) in dbt_project.yml so the build stays green
-- while the issue is documented and visible.

select
    order_id,
    order_status,
    delivered_at
from {{ ref('stg_orders') }}
where order_status = 'delivered'
  and delivered_at is null
