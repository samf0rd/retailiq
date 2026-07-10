-- tests/assert_no_negative_prices.sql
--
-- Item price and freight must be >= 0.
-- Returns rows that violate this — dbt fails the test if any rows returned.

select
    order_id,
    order_item_id,
    item_price,
    freight_value
from {{ ref('stg_order_items') }}
where item_price < 0
   or freight_value < 0
