-- models/staging/stg_customers.sql
--
-- One row per customer_id (which is unique per order in Olist's anonymisation).
-- customer_unique_id is the real person identifier — preserved here and used
-- in mart_cohorts and mart_rfm for cross-order analysis.

with source as (
    select * from {{ source('raw', 'customers') }}
)

select
    customer_id,
    customer_unique_id,
    customer_zip_code_prefix                    as zip_code_prefix,
    customer_city                               as city,
    customer_state                              as state
from source
