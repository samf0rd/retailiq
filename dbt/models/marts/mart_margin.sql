-- models/marts/mart_margin.sql
--
-- Estimated contribution margin by category and month — the finance-moat
-- model (REDESIGN_SPEC.md §2.4).
--
-- Olist gives us item_price and freight_value but NO cost-of-goods-sold —
-- sellers on the marketplace never disclose COGS to the platform. So this
-- model does what a capital-markets / FP&A analyst does when the ledger
-- doesn't hand you cost directly: apply a STATED, DOCUMENTED assumed
-- gross-margin schedule and flag every downstream number as an estimate.
--
-- ═══════════════════════════════════════════════════════════════════════
-- THIS IS ILLUSTRATIVE, NOT ACTUAL. Every "contribution" figure produced by
-- this model is item_price × an assumed category margin, minus real freight
-- cost. It is not derived from seller-reported cost data (none exists in
-- this dataset). Every consuming surface must label it
-- "Est. contribution (assumed-margin model — see methodology)".
-- ═══════════════════════════════════════════════════════════════════════
--
-- Assumed gross-margin schedule — one row per category band, every number
-- sourced. Bands were chosen by grouping Olist's 74 product categories into
-- retail-recognizable groups, then anchored to published Brazilian retail
-- and e-commerce gross-margin benchmarks. Because Olist sellers are
-- marketplace resellers (not brand owners running vertically-integrated
-- DTC), each anchor leans toward the CONSERVATIVE (lower) end of its
-- published range rather than brand-level DTC economics.
--
-- Sources (accessed 2026-07-09):
--   - Sebrae (Brazilian small-business support agency): general retail
--     gross margin commonly 10-20%; multi-brand apparel retail markup
--     commonly 2.5-3x cost (~60-67% implied gross margin).
--   - Empreender.com.br: Brazilian retail electronics margins 10-30%,
--     compressed by price transparency and brand competition.
--   - Onramp Funds, "10 Profit Margin Benchmarks for eCommerce" (2025):
--     home goods 35-55% gross margin; food & beverage 15-25% gross margin.
--   - Eightx, "Average Ecommerce Profit Margins by Industry" (2026):
--     beauty/personal-care DTC brands 65-85% gross margin (median ~69%).
--
-- These are ANCHORS for a documented assumption, not measured Olist data.
-- Reasonable analysts could pick different points within each published
-- range; the point of stating them here is that every number in this
-- model traces back to a labeled, citable assumption instead of a silent
-- guess.
with margin_schedule as (
    select * from (
        values
            -- band,                                  assumed_margin_pct, rationale
            ('electronics_tech',                        0.12, 'BR retail electronics gross margin 10-30% (Empreender/Sebrae); marketplace resale sits at the low end due to price transparency and brand competition.'),
            ('apparel_fashion',                          0.45, 'BR multi-brand apparel markup ~2.5-3x cost implies ~60-67% gross; using a conservative marketplace-resale anchor of 45% (Sebrae/Toyoshima Contabilidade).'),
            ('health_beauty_personal_care',               0.40, 'Global beauty DTC gross margin 65-85% (Eightx 2026); discounted materially for marketplace resale economics rather than brand-owner economics.'),
            ('home_furniture_housewares',                 0.35, 'US home-goods e-commerce gross margin 35-55% (Onramp Funds 2025); low end used for marketplace resale.'),
            ('food_drink',                                0.18, 'Food & beverage e-commerce gross margin 15-25% (Onramp Funds 2025) — thin, competitive, commodity-like.'),
            ('books_music_media',                         0.20, 'Books/media retail is traditionally thin-margin and price-competitive (list-price competition, publisher-set pricing).'),
            ('toys_sports_leisure_gifts',                 0.32, 'Discretionary/leisure goods — mid-range retail markup, between electronics and apparel bands.'),
            ('construction_tools_industrial_auto',        0.25, 'Trade/industrial and auto-parts goods — competitive B2B-adjacent pricing, lower consumer markup than lifestyle categories.'),
            ('other_general_merchandise',                 0.30, 'Default/blended band for unmapped or catch-all categories (e.g. market_place, uncategorised) — general BR retail blended estimate (Sebrae).')
    ) as t(margin_band, assumed_margin_pct, margin_rationale)
),

-- ── Step 1: category → margin band mapping ─────────────────────────────────
-- Every one of Olist's 74 product categories is mapped to exactly one band
-- above. Unmapped categories fall through to 'other_general_merchandise'.
category_band_map as (
    select * from (
        values
            ('air_conditioning', 'electronics_tech'), ('audio', 'electronics_tech'),
            ('cine_photo', 'electronics_tech'), ('computers', 'electronics_tech'),
            ('computers_accessories', 'electronics_tech'), ('consoles_games', 'electronics_tech'),
            ('electronics', 'electronics_tech'), ('fixed_telephony', 'electronics_tech'),
            ('home_appliances', 'electronics_tech'), ('home_appliances_2', 'electronics_tech'),
            ('home_comfort_2', 'electronics_tech'), ('home_confort', 'electronics_tech'),
            ('pc_gamer', 'electronics_tech'), ('portateis_cozinha_e_preparadores_de_alimentos', 'electronics_tech'),
            ('small_appliances', 'electronics_tech'), ('small_appliances_home_oven_and_coffee', 'electronics_tech'),
            ('tablets_printing_image', 'electronics_tech'), ('telephony', 'electronics_tech'),

            ('fashio_female_clothing', 'apparel_fashion'), ('fashion_bags_accessories', 'apparel_fashion'),
            ('fashion_childrens_clothes', 'apparel_fashion'), ('fashion_male_clothing', 'apparel_fashion'),
            ('fashion_shoes', 'apparel_fashion'), ('fashion_sport', 'apparel_fashion'),
            ('fashion_underwear_beach', 'apparel_fashion'), ('luggage_accessories', 'apparel_fashion'),
            ('watches_gifts', 'apparel_fashion'),

            ('baby', 'health_beauty_personal_care'), ('diapers_and_hygiene', 'health_beauty_personal_care'),
            ('health_beauty', 'health_beauty_personal_care'), ('perfumery', 'health_beauty_personal_care'),

            ('bed_bath_table', 'home_furniture_housewares'), ('flowers', 'home_furniture_housewares'),
            ('furniture_bedroom', 'home_furniture_housewares'), ('furniture_decor', 'home_furniture_housewares'),
            ('furniture_living_room', 'home_furniture_housewares'), ('furniture_mattress_and_upholstery', 'home_furniture_housewares'),
            ('garden_tools', 'home_furniture_housewares'), ('home_construction', 'home_furniture_housewares'),
            ('housewares', 'home_furniture_housewares'), ('kitchen_dining_laundry_garden_furniture', 'home_furniture_housewares'),
            ('la_cuisine', 'home_furniture_housewares'), ('office_furniture', 'home_furniture_housewares'),

            ('drinks', 'food_drink'), ('food', 'food_drink'), ('food_drink', 'food_drink'),

            ('books_general_interest', 'books_music_media'), ('books_imported', 'books_music_media'),
            ('books_technical', 'books_music_media'), ('cds_dvds_musicals', 'books_music_media'),
            ('dvds_blu_ray', 'books_music_media'), ('music', 'books_music_media'),
            ('musical_instruments', 'books_music_media'),

            ('art', 'toys_sports_leisure_gifts'), ('arts_and_craftmanship', 'toys_sports_leisure_gifts'),
            ('christmas_supplies', 'toys_sports_leisure_gifts'), ('cool_stuff', 'toys_sports_leisure_gifts'),
            ('party_supplies', 'toys_sports_leisure_gifts'), ('pet_shop', 'toys_sports_leisure_gifts'),
            ('sports_leisure', 'toys_sports_leisure_gifts'), ('stationery', 'toys_sports_leisure_gifts'),
            ('toys', 'toys_sports_leisure_gifts'),

            ('agro_industry_and_commerce', 'construction_tools_industrial_auto'), ('auto', 'construction_tools_industrial_auto'),
            ('construction_tools_construction', 'construction_tools_industrial_auto'), ('construction_tools_lights', 'construction_tools_industrial_auto'),
            ('construction_tools_safety', 'construction_tools_industrial_auto'), ('costruction_tools_garden', 'construction_tools_industrial_auto'),
            ('costruction_tools_tools', 'construction_tools_industrial_auto'), ('industry_commerce_and_business', 'construction_tools_industrial_auto'),
            ('security_and_services', 'construction_tools_industrial_auto'), ('signaling_and_security', 'construction_tools_industrial_auto'),

            ('market_place', 'other_general_merchandise'), ('uncategorised', 'other_general_merchandise')
    ) as t(category_name_en, margin_band)
),

-- ── Step 2: order-item level facts, same completed-order filter as mart_revenue ──
order_item_facts as (
    select
        oi.order_id,
        coalesce(oi.category_name_en, 'uncategorised') as category_name_en,
        oi.item_price,
        oi.freight_value,
        o.order_month
    from {{ ref('int_order_items_enriched') }} oi
    inner join {{ ref('int_orders_enriched') }}  o
        on oi.order_id = o.order_id
    where o.order_status in ('delivered', 'shipped', 'invoiced', 'approved')
),

-- ── Step 3: attach margin band + assumed % to every line item ──────────────
item_with_margin as (
    select
        f.order_month,
        f.category_name_en,
        coalesce(m.margin_band, 'other_general_merchandise')            as margin_band,
        coalesce(s.assumed_margin_pct, s_default.assumed_margin_pct)    as assumed_margin_pct,
        f.order_id,
        f.item_price,
        f.freight_value,
        -- contribution = item_price * assumed_margin_pct - freight_value
        round(f.item_price * coalesce(s.assumed_margin_pct, s_default.assumed_margin_pct) - f.freight_value, 2) as contribution
    from order_item_facts f
    left join category_band_map m  on f.category_name_en = m.category_name_en
    left join margin_schedule s    on coalesce(m.margin_band, 'other_general_merchandise') = s.margin_band
    left join margin_schedule s_default on s_default.margin_band = 'other_general_merchandise'
),

-- ── Step 4: aggregate to category x month grain ─────────────────────────────
final as (
    select
        order_month,
        category_name_en,
        margin_band,
        assumed_margin_pct,
        count(distinct order_id)                    as order_count,
        count(*)                                     as item_count,
        round(sum(item_price), 2)                    as total_item_price,
        round(sum(freight_value), 2)                 as total_freight_value,
        round(sum(item_price * assumed_margin_pct), 2) as est_gross_margin_amount,
        round(sum(contribution), 2)                  as est_contribution,
        round(sum(contribution) / nullif(count(distinct order_id), 0), 2) as est_contribution_per_order
    from item_with_margin
    group by 1, 2, 3, 4
)

select * from final
order by order_month, est_contribution desc
