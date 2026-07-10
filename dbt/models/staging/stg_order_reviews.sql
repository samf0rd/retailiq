-- models/staging/stg_order_reviews.sql
--
-- One row per ORDER (not per review_id).
--
-- Two deduplication issues in the raw Olist dataset:
--   1. 789 duplicate review_ids (same review_id, multiple rows) — noise in the data
--   2. Some orders have multiple distinct review_ids — we keep the latest one
--
-- Both are resolved by deduplicating on order_id (the join key used downstream),
-- keeping the row with the latest review_answer_timestamp.
-- The uniqueness test on review_id is set to WARN to document issue #1.

with source as (
    select * from {{ source('raw', 'order_reviews') }}
),

deduped as (
    select
        review_id,
        order_id,
        cast(review_score as integer)               as review_score,
        review_comment_title,
        review_comment_message,
        cast(review_creation_date   as timestamp)   as review_created_at,
        cast(review_answer_timestamp as timestamp)  as review_answered_at,

        -- deduplicate by order_id: keep the latest review per order
        row_number() over (
            partition by order_id
            order by review_answer_timestamp desc nulls last
        ) as _row_num

    from source
    where review_id is not null
      and order_id  is not null
),

cleaned as (
    select
        review_id,
        order_id,
        review_score,
        review_comment_title,
        review_comment_message,
        review_created_at,
        review_answered_at,
        case when review_score <= 2 then true else false end as is_negative_review
    from deduped
    where _row_num = 1
)

select * from cleaned
