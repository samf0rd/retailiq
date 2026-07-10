-- models/staging/stg_products.sql
--
-- One row per product. Joins the category translation table here at staging
-- so every downstream model works with English category names from the start.
-- Null categories (a known data gap in this dataset) are labelled explicitly.

with source as (
    select * from {{ source('raw', 'products') }}
),

translation as (
    select * from {{ source('raw', 'product_category_name_translation') }}
),

joined as (
    select
        p.product_id,

        -- English category name; fall back to PT name if no translation exists
        coalesce(
            t.product_category_name_english,
            p.product_category_name
        )                                            as category_name_en,
        p.product_category_name                      as category_name_pt,

        cast(p.product_name_lenght       as integer) as product_name_length,
        cast(p.product_description_lenght as integer) as product_description_length,
        cast(p.product_photos_qty        as integer) as product_photos_qty,
        cast(p.product_weight_g          as integer) as product_weight_g,
        cast(p.product_length_cm         as integer) as product_length_cm,
        cast(p.product_height_cm         as integer) as product_height_cm,
        cast(p.product_width_cm          as integer) as product_width_cm,

        -- derived: volumetric weight (cm³) — proxy for packaging cost
        cast(p.product_length_cm as integer)
            * cast(p.product_height_cm as integer)
            * cast(p.product_width_cm  as integer) as volume_cm3

    from source p
    left join translation t
        on p.product_category_name = t.product_category_name
)

select * from joined
