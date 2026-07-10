"""
api/commentary.py
────────────────────────────────────────────────────────────────────────────
Shared mart-numbers registry + numeric-grounding helpers, used by api/ask.py
("Ask the data" — PRD §6.4). This file used to also expose a per-page
`/api/commentary/{page}` endpoint that auto-generated a "Key Finding" for
each dashboard page; that pattern is exactly what the v2 AI re-scope (PRD
§6.1: "AI describes what's on screen. AI never decides what to do.") retired
— every page now carries a hand-authored <AnalystNote>/<Recommendation>
pair instead, grounded in numbers computed inline in the page component or
verified once against the warehouse (see e.g. dashboard/app/segments/page.tsx).
The route and its LLM call were deleted along with the frontend's
DecisionCard component; what's left here is the reusable core:

  1. NUMBERS_FN — one real-mart-query function per page. api/ask.py calls
     all of them to build its knowledge base; a free-form question can draw
     on any page's numbers, not just one.
  2. The numeric-grounding helpers (_extract_numbers, _normalize_value,
     _allowed_number_set) — every number an LLM answer cites must trace
     back to a number actually in this registry. api/ask.py reuses this
     exact logic rather than re-implementing it.
"""

import json
import re
from typing import Optional

from api.main import q, _read_metrics, COMPLETE_MONTHS_CTE


# ── Real mart queries → real numbers, one function per page ────────────────

def _numbers_exec_summary() -> dict:
    # Excludes incomplete trailing months (e.g. Sep-2018's single stray order —
    # a known Olist data-collection artifact) via the same COMPLETE_MONTHS_CTE
    # used by /api/revenue/summary, so "latest month" numbers are real, not noise.
    summary = q(
        f"""
        with {COMPLETE_MONTHS_CTE},
        monthly as (
            select order_month, sum(gross_revenue) as revenue, sum(order_count) as orders
            from main_marts.mart_revenue
            where order_month in (select order_month from complete_months)
            group by 1
        )
        select
            (select round(sum(revenue),2) from monthly) as total_revenue,
            (select sum(orders) from monthly) as total_orders,
            (select round(sum(revenue)/nullif(sum(orders),0),2) from monthly) as aov,
            (select strftime(max(order_month),'%Y-%m') from monthly) as latest_month,
            (select round(revenue,2) from monthly order by order_month desc limit 1) as latest_month_revenue,
            (select round(mom_growth_pct,2) from main_marts.mart_revenue
                where order_month = (select max(order_month) from monthly)
                order by gross_revenue desc limit 1) as top_category_mom_growth_pct,
            (select category_name_en from main_marts.mart_revenue
                where order_month = (select max(order_month) from monthly)
                order by gross_revenue desc limit 1) as top_category_name
        """
    )[0]
    repeat = q(
        """
        select round(sum(case when order_count > 1 then 1 else 0 end) * 100.0 / count(*), 2) as repeat_rate_pct,
               count(*) as total_customers
        from main_marts.mart_rfm
        """
    )[0]
    return {**summary, **repeat}


def _numbers_revenue() -> dict:
    row = q(
        f"""
        with {COMPLETE_MONTHS_CTE},
        latest as (select max(order_month) as m from complete_months),
        top5 as (
            select sum(revenue_share_pct) as top5_share_pct
            from main_marts.mart_revenue
            where order_month = (select m from latest) and category_rank_in_month <= 5
        )
        select
            strftime((select m from latest), '%Y-%m') as latest_month,
            r.category_name_en as top_category_name,
            r.revenue_share_pct as top_category_share_pct,
            (select top5_share_pct from top5) as top5_share_pct
        from main_marts.mart_revenue r
        where r.order_month = (select m from latest) and r.category_rank_in_month = 1
        """
    )[0]
    return row


def _numbers_cohorts() -> dict:
    rows = q(
        """
        select periods_since_first_order, sum(active_customers) as active
        from main_marts.mart_cohorts
        where periods_since_first_order >= 1
        group by 1
        """
    )
    total_repeat = sum(r["active"] for r in rows)
    m1_3 = sum(r["active"] for r in rows if 1 <= r["periods_since_first_order"] <= 3)
    repeat = q(
        "select round(sum(case when order_count > 1 then 1 else 0 end) * 100.0 / count(*), 2) as repeat_rate_pct from main_marts.mart_rfm"
    )[0]
    return {
        "repeat_rate_pct": repeat["repeat_rate_pct"],
        "m1_m3_share_of_repeat_purchases_pct": round(m1_3 * 100 / total_repeat, 1) if total_repeat else None,
    }


def _numbers_segments() -> dict:
    econ = q("select * from ml.segment_economics")
    loyalists = next((r for r in econ if r["kmeans_segment"] == "Potential Loyalists"), None)
    typical = max(econ, key=lambda r: r["customer_count"])
    metrics = _read_metrics("segmentation_metrics.json")
    return {
        "loyalists_pct_of_customers": loyalists["pct_of_customers"] if loyalists else None,
        "loyalists_pct_of_revenue": loyalists["pct_of_revenue"] if loyalists else None,
        "loyalists_avg_ltv": loyalists["avg_ltv"] if loyalists else None,
        "typical_segment_name": typical["kmeans_segment"],
        "typical_segment_avg_ltv": typical["avg_ltv"],
        "ltv_multiplier": round(loyalists["avg_ltv"] / typical["avg_ltv"], 1) if loyalists else None,
        "rfm_kmeans_agreement_rate_pct": metrics.get("alignment", {}).get("agreement_rate_pct"),
    }


def _numbers_sellers() -> dict:
    sellers = q("select total_gross_revenue, late_delivery_rate_pct, revenue_percentile from main_marts.mart_sellers")
    n_sellers = len(sellers)
    decile_n = max(1, round(n_sellers * 0.1))
    total_gmv = sum(s["total_gross_revenue"] for s in sellers)
    top_decile = sorted(sellers, key=lambda s: s["total_gross_revenue"], reverse=True)[:decile_n]
    top_decile_gmv = sum(s["total_gross_revenue"] for s in top_decile)
    high_revenue_late = sum(1 for s in sellers if s["revenue_percentile"] >= 90 and s["late_delivery_rate_pct"] > 10)
    top_decile_pct_count = sum(1 for s in sellers if s["revenue_percentile"] >= 90)
    return {
        "total_sellers": n_sellers,
        "top_decile_seller_count": decile_n,
        "top_decile_gmv_share_pct": round(top_decile_gmv * 100 / total_gmv, 1) if total_gmv else None,
        # explicit numeric value (not just embedded in a key name) so a
        # finding phrasing this as "late rate above 10%" grounds correctly
        "late_delivery_rate_threshold_pct": 10,
        "high_revenue_sellers_above_late_rate_threshold": high_revenue_late,
        "high_revenue_seller_count": top_decile_pct_count,
    }


def _numbers_logistics() -> dict:
    rows = q(
        """
        select customer_state, strftime(order_month, '%Y-%m') as order_month,
               delivery_review_correlation, delivered_orders
        from main_marts.mart_logistics
        """
    )
    latest_month = max(r["order_month"] for r in rows)
    latest = {r["customer_state"]: r for r in rows if r["order_month"] == latest_month}
    candidates = [r for r in latest.values() if r["delivery_review_correlation"] is not None]
    worst = min(candidates, key=lambda r: r["delivery_review_correlation"])
    return {
        "latest_month": latest_month,
        "worst_state": worst["customer_state"],
        "worst_state_correlation": round(worst["delivery_review_correlation"], 3),
        "worst_state_delivered_orders": worst["delivered_orders"],
    }


NUMBERS_FN = {
    "exec_summary": _numbers_exec_summary,
    "revenue": _numbers_revenue,
    "cohorts": _numbers_cohorts,
    "segments": _numbers_segments,
    "sellers": _numbers_sellers,
    "logistics": _numbers_logistics,
}

PAGE_LABEL = {
    "exec_summary": "Executive Summary",
    "revenue": "Revenue Deep Dive",
    "cohorts": "Cohort Analysis",
    "segments": "Customer Segments",
    "sellers": "Seller Performance",
    "logistics": "Logistics & Ops",
}


# ── Numeric-grounding helpers — every number an LLM answer cites must trace
# back to a number actually present in the supplied numbers dict. Small bare
# integer counts (single/double digit, no decimal, no thousands separator,
# no '%') are skipped when scanning generated text — they're too common
# ("top 5 categories") to be a meaningful grounding signal either way.
# Percentages are always checked regardless of magnitude ("27%") — that's
# exactly the kind of figure a fabricated answer cites, and skipping them by
# size would let an invented rate slip through. This skip is a
# generated-text-side heuristic only: the allowed set itself (built from the
# numbers dict) keeps every real value, however small, so a genuinely-cited
# small number (e.g. a threshold like "10") still validates correctly.
_NUM_RE = re.compile(r"-?\d[\d,]*\.?\d*%?")


def _extract_numbers(text: str) -> list[str]:
    return _NUM_RE.findall(text)


def _normalize_value(tok: str) -> Optional[str]:
    cleaned = tok.rstrip("%").replace(",", "")
    try:
        val = float(cleaned)
    except ValueError:
        return None
    # normalize trailing .0
    if val == int(val):
        return str(int(val))
    return f"{val:g}"


def _allowed_number_set(numbers: dict) -> set:
    blob = json.dumps(numbers)
    allowed = set()
    for tok in _extract_numbers(blob):
        norm = _normalize_value(tok)
        if norm:
            allowed.add(norm)
    return allowed
