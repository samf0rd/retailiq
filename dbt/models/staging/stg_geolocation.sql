-- models/staging/stg_geolocation.sql
--
-- Zip prefix → lat/lng/city/state. Multiple rows per zip prefix are expected
-- (the source has ~1M rows for ~19k unique prefixes).
-- Downstream models that need a single point per zip should aggregate here
-- or use int_geolocation_deduped (built in Phase 2).

with source as (
    select * from {{ source('raw', 'geolocation') }}
)

select
    geolocation_zip_code_prefix                     as zip_code_prefix,
    cast(geolocation_lat as double)                 as lat,
    cast(geolocation_lng as double)                 as lng,
    geolocation_city                                as city,
    geolocation_state                               as state
from source
