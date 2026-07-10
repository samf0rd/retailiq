# RetailIQ — E-Commerce Intelligence Platform

> **The decision:** 55 of the platform's 311 highest-revenue sellers run a late-delivery rate above 10%, carrying R$1.56M of GMV at elevated delivery risk. An onboarding-standards fix targeted at just those 55 sellers protects that revenue — a quantified, targeted intervention instead of an untargeted platform-wide quality push. See it live on the [Sellers page](#quick-start), with the real dbt SQL one click away via "View SQL."

RetailIQ is a decision-support analytics platform built on 98,699 real orders from [Olist](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce), a Brazilian e-commerce marketplace (2016–2018). The dashboard is the conclusion; the [Methodology page](#methodology--the-sql-showcase) and every panel's "View SQL" drawer are the work — click from any number straight to the exact dbt model, its lineage, and its dbt tests.

**Design discipline this repo enforces in code, not just convention:** the AI narrates what's on screen (grounded in real numbers, dev-asserted, never invented); every business recommendation is hand-authored, quantified against a validated number, and tagged `Author: analysis` — never presented as a model's decision. See `dashboard/ai/caveats.ts` and `dashboard/components/v2/AnalystNote.tsx`.

---

## Quick start

```bash
# 1. Clone and set up the Python environment
git clone https://github.com/samf0rd/retailiq
cd retailiq
python -m venv .venv && source .venv/bin/activate   # .venv/Scripts/activate on Windows
pip install -r requirements.txt

# 2. Place the 9 Olist CSVs in data/raw/
#    Dataset: https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce

# 3. Load raw data into DuckDB, then run the dbt pipeline
python ingestion/load_raw.py
cd dbt && dbt build --profiles-dir . && cd ..

# 4. (Optional) Run the ML segmentation/propensity models — feeds the Segments page
python ml/segmentation.py
python ml/propensity.py

# 5. Start the API (FastAPI, reads the DuckDB warehouse read-only)
uvicorn api.main:app --reload --port 8000

# 6. Start the dashboard (Next.js — in a second terminal)
cd dashboard
npm install
npm run dev
```

Then open `http://localhost:3000` for the landing page, or `http://localhost:3000/app` for the dashboard directly. `ANTHROPIC_API_KEY` is optional — without it, "Ask the data" (the one interactive AI surface, PRD §6.4) reports honestly that AI answering isn't configured; every other page works identically either way, since no other page's numbers are AI-generated.

## Architecture

```
raw (9 CSVs) → staging (1:1 per source, typed/cleaned)
             → intermediate (join hubs, defined once)
             → marts (business-grain tables the dashboard queries)
```

Full interactive version — click any node for its real SQL, dbt tests, and row count — lives on the dashboard's **Methodology** page (`/app/methodology`) once running locally.

```
DuckDB (warehouse) → dbt (staging/intermediate/marts) → ml/ (segmentation, propensity)
                                                        ↓
                                          FastAPI (api/) — read-only, one route per mart
                                                        ↓
                                        Next.js dashboard (dashboard/) — App Router, server components
```

## Methodology — the SQL showcase

Every dashboard panel that renders mart data carries a `</> View SQL` button — the real dbt model, its lineage (`raw → staging → intermediate → mart`), its dbt tests, and the specific window function / `NTILE()` / `CORR()` / gap-and-island construct it demonstrates, highlighted inline. The Methodology page collects the same information into one interactive dependency graph plus a SQL-proficiency index (`dashboard/app/app/methodology/page.tsx`, bundled at build time by `dashboard/scripts/bundle-models.mjs` — never a live DB connection shipped to the browser).

## Tech stack

| Layer | Tool |
|---|---|
| Warehouse | DuckDB |
| Transforms | dbt (dbt-duckdb) |
| ML | Python · scikit-learn |
| AI ("Ask the data" only) | Claude API (Anthropic), grounded to pre-computed mart summaries |
| API | FastAPI |
| Dashboard | Next.js / React (App Router) |

## Business recommendations

Three of the six hand-authored, quantified recommendations live on the dashboard (`Author: analysis` tag, never AI-generated) — full context and the supporting query are one click away on each page:

1. **Sellers.** 55 of the platform's 311 highest-revenue sellers (top decile by GMV) exceed a 10% late-delivery rate, carrying R$1.56M of GMV at elevated risk — an onboarding-standards fix targeted at those 55 protects that revenue without an untargeted platform-wide push.
2. **Segments.** "Potential Loyalists" (2,471 customers, 2.6% of the base) carry the platform's highest average LTV (R$1,159) but only a 1.2% second-order rate. Converting 10% of this segment to a second order is worth ≈R$283K in incremental revenue — a targeted win-back, not a blanket retention program.
3. **Logistics.** The state with the strongest delivery-delay-to-review-score correlation sits at a *weak* band (|r|<0.4) even at its strongest — real, but not grounds for a full logistics-investment case on its own. The defensible move is an SLA test isolated to that state's affected orders, not a broad spend commitment off a weak correlation.

One order count everywhere: **98,699** valid orders (orders in months with sufficient volume to be treated as complete — the dataset's trailing partial month is excluded from every total, filter stated once on Exec Summary). Currency is R$ only, one formatting util (`dashboard/lib/format.ts`) used everywhere.

---

*Built by [Samuel Garcia](https://samvgarcia.com) · github.com/samf0rd*
