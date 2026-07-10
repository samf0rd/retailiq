-- models/staging/stg_order_payments.sql
--
-- One row per payment entry. An order can have multiple rows here when
-- a customer pays with multiple methods or splits into installments.
-- payment_sequential tracks the order of entries within an order.

with source as (
    select * from {{ source('raw', 'order_payments') }}
)

select
    order_id,
    payment_sequential,
    payment_type,
    payment_installments,
    cast(payment_value as decimal(12, 2)) as payment_value

from source
