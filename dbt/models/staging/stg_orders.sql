-- models/staging/stg_orders.sql
--
-- One row per order. Most timestamp columns are inferred correctly by DuckDB's
-- read_csv_auto. order_estimated_delivery_date is cast via VARCHAR to handle
-- both TIMESTAMP and blank-string VARCHAR inference across environments.

with source as (
    select * from {{ source('raw', 'orders') }}
),

cleaned as (
    select
        order_id,
        customer_id,
        order_status,

        -- direct timestamp columns (DuckDB infers these correctly from CSV)
        order_purchase_timestamp                                                as purchased_at,
        order_approved_at                                                       as approved_at,
        order_delivered_carrier_date                                            as shipped_at,
        order_delivered_customer_date                                           as delivered_at,

        -- estimated delivery: cast to VARCHAR first, then to TIMESTAMP
        -- this handles both environments where DuckDB infers it as TIMESTAMP
        -- (real Olist data) or VARCHAR (blank strings on canceled orders)
        try_cast(
            nullif(trim(cast(order_estimated_delivery_date as varchar)), '')
        as timestamp)                                                           as estimated_delivery_at,

        -- derived durations
        datediff('hour',
            order_purchase_timestamp,
            order_approved_at
        )                                                                       as approval_lag_hours,

        datediff('day',
            order_purchase_timestamp,
            order_delivered_customer_date
        )                                                                       as actual_delivery_days,

        datediff('day',
            order_purchase_timestamp,
            try_cast(
                nullif(trim(cast(order_estimated_delivery_date as varchar)), '')
            as timestamp)
        )                                                                       as estimated_delivery_days,

        datediff('day',
            try_cast(
                nullif(trim(cast(order_estimated_delivery_date as varchar)), '')
            as timestamp),
            order_delivered_customer_date
        )                                                                       as delivery_delta_days,

        -- date parts
        date_trunc('month', order_purchase_timestamp)   as order_month,
        date_trunc('year',  order_purchase_timestamp)   as order_year,
        cast(order_purchase_timestamp as date)          as order_date

    from source
    where order_purchase_timestamp is not null
)

select * from cleaned