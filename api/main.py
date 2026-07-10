"""
api/main.py
────────────────────────────────────────────────────────────────────────────
Phase 5 — thin FastAPI read layer between DuckDB and the Next.js dashboard.

Why FastAPI over a static JSON export (decision made at the start of this
phase): Phase 6's "Ask the data" panel needs to run live, grounded queries
against DuckDB from a Claude API call. A real backend means Phase 6 slots in
as a new route (`/api/ask`) instead of requiring a rebuild of the data layer.

Every route here does ONE thing: run a read-only query against a mart (or ML
output) table and return it as JSON. No business logic lives here — that's
already baked into the dbt marts and the ml/ scripts. This layer is
deliberately dumb, which is the point: it's easy to reason about and easy to
swap the warehouse behind it later (README framing: "swapping to
Snowflake/BigQuery is a profile change, not a rewrite" applies to this layer
too — DuckDB is queried with the same interface a Postgres/Snowflake driver
would expose).

Run:
    uvicorn api.main:app --reload --port 8000

Env:
    RETAILIQ_DB_PATH   path to the DuckDB file (default: warehouse/retailiq.duckdb)
"""

import os
from contextlib import asynccontextmanager
from typing import Optional

import duckdb
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

DB_PATH = os.environ.get("RETAILIQ_DB_PATH", "warehouse/retailiq.duckdb")

# Single shared read-only connection. DuckDB handles concurrent reads fine;
# we never write from this process, so read_only=True is both correct and
# a safety rail — this API can never corrupt the warehouse.
_con: Optional[duckdb.DuckDBPyConnection] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _con
    if not os.path.exists(DB_PATH):
        # Don't crash on boot — let individual routes 503 with a clear
        # message. This lets the frontend build/dev-server come up even
        # before the warehouse file exists locally.
        _con = None
    else:
        _con = duckdb.connect(DB_PATH, read_only=True)
    yield
    if _con is not None:
        _con.close()


app = FastAPI(title="RetailIQ API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # tighten to the Vercel URL at deploy time
    allow_methods=["GET"],
    allow_headers=["*"],
)


def q(sql: str, params: Optional[list] = None):
    if _con is None:
        raise HTTPException(
            status_code=503,
            detail=f"Warehouse not found at {DB_PATH}. Run the dbt build first.",
        )
    # FastAPI runs each sync route in its own threadpool thread. A DuckDB
    # connection can only run one query at a time, so concurrent requests
    # (e.g. the Segments page's Promise.all of 3 fetches) sharing _con
    # directly race and return corrupted/empty results. cursor() gives each
    # request an independent handle onto the same underlying connection.
    df = _con.cursor().execute(sql, params or []).fetchdf()
    # Marts legitimately contain NaN (e.g. prev_month_revenue on a category's
    # first month). Starlette's JSONResponse uses allow_nan=False, so NaN/NaT
    # must become None before serialization or the route 500s.
    df = df.astype(object).where(df.notnull(), None)
    return df.to_dict(orient="records")


@app.get("/api/health")
def health():
    return {"status": "ok", "warehouse_connected": _con is not None}


# ── Revenue ──────────────────────────────────────────────────────────────────

# The Olist dataset's order volume collapses in its final month(s) — a known
# artifact of when data collection stopped, not a real demand crash. September
# 2018 has a single stray order against a normal ~2,600/month baseline, which
# would otherwise show up as a fake "-94% MoM" headline. Rather than hardcode
# a cutoff date, this flags a trailing month as incomplete if its order volume
# falls below 10% of the dataset's average monthly volume. The volume check is
# scoped to only the 2 most recent months (months_from_end <= 2) — early months
# like 2016-09 through 2016-12 are low-volume too, but that's Olist's real
# ramp-up period as a young marketplace, not a collection artifact, so every
# earlier month is kept regardless of volume.
COMPLETE_MONTHS_CTE = """
    monthly_volume as (
        select
            order_month,
            sum(order_count) as orders_in_month,
            row_number() over (order by order_month desc) as months_from_end
        from main_marts.mart_revenue
        group by 1
    ),
    complete_months as (
        select order_month
        from monthly_volume
        where months_from_end > 2
           or orders_in_month >= (select avg(orders_in_month) * 0.1 from monthly_volume)
    )
"""


@app.get("/api/revenue")
def revenue(
    start_month: Optional[str] = None,
    end_month: Optional[str] = None,
    category: Optional[str] = None,
):
    """Feeds the Revenue Deep Dive page. Filters are optional and additive."""
    # DuckDB serializes DATE/TIMESTAMP columns to full ISO strings over JSON
    # (e.g. "2018-09-01T00:00:00"). Casting to a YYYY-MM text column here means
    # every route returns the same canonical format, instead of relying on
    # exact-string-match comparisons in the frontend that break silently the
    # moment two endpoints format the same date column differently.
    where = ["r.order_month in (select order_month from complete_months)"]
    params = []
    if start_month:
        # start_month/end_month arrive as "YYYY-MM" — the same format this
        # route outputs (see strftime cast below) and the same format the
        # frontend's month dropdown is populated from. Filtering on the raw
        # DATE/TIMESTAMP column against a "YYYY-MM" string fails to parse;
        # cast the column to match instead.
        where.append("strftime(r.order_month, '%Y-%m') >= ?")
        params.append(start_month)
    if end_month:
        where.append("strftime(r.order_month, '%Y-%m') <= ?")
        params.append(end_month)
    if category:
        where.append("r.category_name_en = ?")
        params.append(category)
    sql = f"""
        with {COMPLETE_MONTHS_CTE}
        select
            strftime(r.order_month, '%Y-%m') as order_month,
            r.category_name_en, r.order_count, r.item_count, r.product_revenue,
            r.freight_revenue, r.gross_revenue, r.avg_item_price, r.total_gross_revenue,
            r.total_orders, r.revenue_share_pct, r.prev_month_revenue, r.cumulative_revenue,
            r.cumulative_total_revenue, r.category_rank_in_month, r.mom_growth_pct,
            r.is_top3_category
        from main_marts.mart_revenue r
        where {' and '.join(where)}
        order by r.order_month, r.category_rank_in_month
    """
    return q(sql, params)


@app.get("/api/revenue/summary")
def revenue_summary():
    """Headline KPIs for the Executive Summary page — one row, no grain.
    Excludes incomplete trailing months (see COMPLETE_MONTHS_CTE above)."""
    sql = f"""
        with {COMPLETE_MONTHS_CTE},
        monthly as (
            select r.order_month, sum(r.gross_revenue) as revenue, sum(r.order_count) as orders
            from main_marts.mart_revenue r
            where r.order_month in (select order_month from complete_months)
            group by 1
        )
        select
            (select sum(revenue) from monthly) as total_revenue,
            (select sum(orders) from monthly) as total_orders,
            (select round(sum(revenue) / nullif(sum(orders), 0), 2) from monthly) as aov,
            (select strftime(max(order_month), '%Y-%m') from monthly) as latest_month,
            (select round(revenue, 2) from monthly order by order_month desc limit 1) as latest_month_revenue,
            (select mom_growth_pct from main_marts.mart_revenue
                where order_month = (select max(order_month) from monthly)
                order by gross_revenue desc limit 1) as latest_top_category_growth,
            -- total-revenue MoM growth (distinct from latest_top_category_growth above,
            -- which is one category's growth, not the total) — latest complete month vs
            -- the prior complete month, both drawn from the same complete_months filter
            -- so the Sep-2018 single-stray-order artifact never enters either side.
            (select round((latest.revenue - prev.revenue) / nullif(prev.revenue, 0) * 100, 2)
                from (select revenue from monthly order by order_month desc limit 1) latest,
                     (select revenue from monthly order by order_month desc limit 1 offset 1) prev
            ) as latest_total_revenue_growth
    """
    rows = q(sql)
    return rows[0] if rows else {}


# ── Cohorts ──────────────────────────────────────────────────────────────────

@app.get("/api/cohorts")
def cohorts():
    """Retention matrix — feeds the Cohort Analysis heatmap grid."""
    sql = """
        select
            strftime(cohort_month, '%Y-%m') as cohort_month,
            periods_since_first_order, cohort_size, active_customers,
            retention_rate_pct, period_churn
        from main_marts.mart_cohorts
        order by cohort_month, periods_since_first_order
    """
    return q(sql)


# ── RFM / Segmentation ───────────────────────────────────────────────────────

@app.get("/api/rfm")
def rfm(segment: Optional[str] = None, limit: int = Query(500, le=5000)):
    where = "where rfm_segment = ?" if segment else ""
    params = [segment] if segment else []
    sql = f"""
        select * from main_marts.mart_rfm
        {where}
        order by rfm_score desc, monetary_value desc
        limit {limit}
    """
    return q(sql, params)


@app.get("/api/segments/kmeans")
def kmeans_segments(segment: Optional[str] = None, limit: int = Query(5000, le=100000)):
    """K-Means cluster assignments — validates the rule-based RFM segments.
    Filters on kmeans_segment (e.g. "Champions", "Need Attention") — feeds
    the Segment Economics drill-down on the Segments page."""
    where = "where kmeans_segment = ?" if segment else ""
    params = [segment] if segment else []
    sql = f"select * from ml.kmeans_segments {where} limit {limit}"
    return q(sql, params)


@app.get("/api/segments/economics")
def segment_economics():
    """Aggregated economics per segment — feeds the Customer Segments cards."""
    return q("select * from ml.segment_economics")


@app.get("/api/segments/propensity")
def repeat_propensity(tier: Optional[str] = None, limit: int = Query(500, le=5000)):
    where = "where propensity_tier = ?" if tier else ""
    params = [tier] if tier else []
    sql = f"select * from ml.repeat_propensity {where} order by repeat_propensity desc limit {limit}"
    return q(sql, params)


@app.get("/api/segments/retention-targets")
def retention_targets():
    """The decision table: who to target with retention spend, and priority."""
    return q("select * from ml.retention_targets order by avg_propensity_pct desc")


# ── Sellers ──────────────────────────────────────────────────────────────────

@app.get("/api/sellers")
def sellers(tier: Optional[str] = None, limit: int = Query(200, le=2000)):
    where = "where seller_tier = ?" if tier else ""
    params = [tier] if tier else []
    sql = f"select * from main_marts.mart_sellers {where} order by revenue_rank limit {limit}"
    return q(sql, params)


# ── Logistics ────────────────────────────────────────────────────────────────

@app.get("/api/logistics")
def logistics(state: Optional[str] = None):
    where = "where customer_state = ?" if state else ""
    params = [state] if state else []
    sql = f"""
        select
            customer_state, strftime(order_month, '%Y-%m') as order_month,
            delivered_orders, avg_delivery_days, avg_estimated_days, avg_delta_days,
            median_delivery_days, p95_delivery_days, late_rate_pct, avg_review_score,
            avg_review_score_late, avg_review_score_ontime, delivery_review_correlation,
            avg_freight_value, total_freight_revenue,
            latest_streak_start, latest_streak_end, latest_streak_length
        from main_marts.mart_logistics
        {where}
        order by customer_state, order_month
    """
    return q(sql, params)


# ── Margin (contribution view — assumed-margin model, see mart_margin.sql) ──

@app.get("/api/margin")
def margin(category: Optional[str] = None):
    """Est. contribution by category and month. ILLUSTRATIVE: item_price is
    real, freight_value is real, but the margin % applied is a stated,
    documented assumption (no COGS in the Olist dataset) — see
    dbt/models/marts/mart_margin.sql for the full sourced schedule."""
    where = "where category_name_en = ?" if category else ""
    params = [category] if category else []
    sql = f"""
        select
            strftime(order_month, '%Y-%m') as order_month,
            category_name_en, margin_band, assumed_margin_pct,
            order_count, item_count, total_item_price, total_freight_value,
            est_gross_margin_amount, est_contribution, est_contribution_per_order
        from main_marts.mart_margin
        {where}
        order by order_month, est_contribution desc
    """
    return q(sql, params)


@app.get("/api/margin/summary")
def margin_summary():
    """Contribution by category, all months combined — feeds the Contribution
    View panel. Excludes incomplete trailing months (see COMPLETE_MONTHS_CTE)."""
    sql = f"""
        with {COMPLETE_MONTHS_CTE}
        select
            category_name_en, margin_band, max(assumed_margin_pct) as assumed_margin_pct,
            sum(order_count) as order_count,
            round(sum(total_item_price), 2) as total_item_price,
            round(sum(total_freight_value), 2) as total_freight_value,
            round(sum(est_contribution), 2) as est_contribution
        from main_marts.mart_margin
        where order_month in (select order_month from complete_months)
        group by 1, 2
        order by est_contribution desc
    """
    return q(sql)


# ── Metadata (populates dashboard filter dropdowns) ─────────────────────────

@app.get("/api/meta/categories")
def categories():
    return q("select distinct category_name_en from main_marts.mart_revenue order by 1")


@app.get("/api/meta/states")
def states():
    return q("select distinct customer_state from main_marts.mart_logistics order by 1")


# ── Model metrics (static JSON written by ml/segmentation.py and ml/propensity.py) ──
# Not mart data — these are one-time training-run metrics (silhouette score,
# ROC-AUC, elbow analysis), read straight off disk rather than DuckDB.

import json as _json

ML_OUTPUTS_DIR = os.environ.get("RETAILIQ_ML_OUTPUTS", "ml/outputs")


def _read_metrics(filename: str):
    path = os.path.join(ML_OUTPUTS_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=503, detail=f"Metrics file not found: {path}. Run the ml/ script first.")
    with open(path) as f:
        return _json.load(f)


@app.get("/api/segments/metrics")
def segmentation_metrics():
    return _read_metrics("segmentation_metrics.json")


@app.get("/api/segments/propensity-metrics")
def propensity_metrics():
    return _read_metrics("propensity_metrics.json")


# ── Ask the data (hardened Q&A, PRD §6.4 — see api/ask.py) ──────────────────
from api.ask import router as ask_router  # noqa: E402

app.include_router(ask_router)
