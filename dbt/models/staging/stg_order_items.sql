-- models/staging/stg_order_items.sql
--
-- One row per order-item (orders can contain multiple products).
-- order_id + order_item_id is the composite natural key.
-- price and freight_value are cast to DECIMAL for financial accuracy.

with source as (
    select * from {{ source('raw', 'order_items') }}
)

select
    order_id,
    order_item_id,
    product_id,
    seller_id,

    cast(shipping_limit_date as timestamp) as shipping_limit_at,

    cast(price          as decimal(12, 2)) as item_price,
    cast(freight_value  as decimal(12, 2)) as freight_value,

    -- total revenue contribution of this line item
    cast(price as decimal(12, 2)) + cast(freight_value as decimal(12, 2)) as line_total

from source
