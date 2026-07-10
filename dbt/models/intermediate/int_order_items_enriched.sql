-- models/intermediate/int_order_items_enriched.sql
--
-- One row per order line item, enriched with product and seller dimensions.
-- This is the "wide" fact table that mart_revenue and mart_sellers read from.
--
-- Why intermediate and not directly in the mart?
-- Because three different mart models need this same join. Defining it once
-- here means a single place to fix if a column name changes upstream.

with order_items as (
    select * from {{ ref('stg_order_items') }}
),

products as (
    select * from {{ ref('stg_products') }}
),

sellers as (
    select * from {{ ref('stg_sellers') }}
)

select
    -- item keys
    oi.order_id,
    oi.order_item_id,
    oi.product_id,
    oi.seller_id,

    -- item financials
    oi.item_price,
    oi.freight_value,
    oi.line_total,
    oi.shipping_limit_at,

    -- product attributes
    p.category_name_en,
    p.category_name_pt,
    p.product_weight_g,
    p.volume_cm3,
    p.product_photos_qty,

    -- seller location
    s.city             as seller_city,
    s.state            as seller_state,
    s.zip_code_prefix  as seller_zip_code_prefix

from order_items oi
left join products p  on oi.product_id = p.product_id
left join sellers  s  on oi.seller_id  = s.seller_id
