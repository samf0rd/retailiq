# RetailIQ — Dashboard Elevation Spec
### From "developer-grade tables" to "fintech-grade decision tool"

> **Purpose.** This is the fixed target for the Phase 5.5 elevation (visual + storytelling
> + finance-moat) merged with Phase 6 (AI commentary). Claude Code executes this tier by
> tier. Each tier is independently shippable. Do not skip ahead — Tier 1 (substance) must
> land before Tier 2 (visual), because a beautiful dashboard that doesn't tell you what to
> do is a decorator's work, not an analyst's.

---

## 0. THE PROBLEM WE'RE FIXING

The current dashboard is *correct* but *inert*. Real numbers, real filters, real drill-downs
— but every page shows data and asks the reader to find the point themselves. Three gaps,
in priority order:

1. **No "so what."** PRD §2 says lead with the decision. Every page currently leads with a
   table. The best finding in the project (2.6% of customers = 18.3% of revenue) is buried in
   grey monospace.
2. **Developer aesthetic.** The amber-terminal look reads as "engineer's tool," not
   "executive's dashboard." No visual hierarchy — everything is the same weight, so nothing
   guides the eye.
3. **Finance moat invisible.** Nothing echoes Samuel's capital-markets edge. Generic
   e-commerce analytics a bootcamp grad could theme.

---

## 1. DESIGN LANGUAGE (the new visual system)

**Direction: clean fintech dashboard.** Reference points: Mercury, Stripe dashboard, Wise,
Ramp. Dark canvas (keeps the data-focused feel, avoids the generic cream/serif AI look), but
with real hierarchy, breathing room, and restraint. NOT a terminal. NOT amber-on-black
monospace everywhere.

### 1.1 Color tokens (replace the current amber-terminal set)

```
/* Canvas — deep slate-navy, not pure black. Warmer, more considered. */
--bg:             #0d1117;   /* app background */
--surface:        #151b23;   /* card background */
--surface-2:      #1c232d;   /* raised / hover */
--border:         #232c38;   /* hairline dividers */
--border-strong:  #313d4d;   /* emphasized borders */

/* Text */
--text:           #e6edf3;   /* primary */
--text-muted:     #8b98a9;   /* secondary / labels */
--text-dim:       #5a6675;   /* tertiary / captions */

/* Brand accent — a single confident teal-green (fintech "trust + money"),
   used sparingly for emphasis, active states, key figures. */
--accent:         #3fb98c;   /* primary accent */
--accent-dim:     #2d8968;
--accent-wash:    rgba(63, 185, 140, 0.08);  /* subtle fills behind KPIs */

/* Semantic — muted, not neon. */
--positive:       #3fb98c;   /* gains, good */
--negative:       #e5636b;   /* losses, bad */
--warning:        #e0a458;   /* caution / thresholds */
--info:           #5b9bd5;   /* neutral info, links */

/* Data-viz categorical ramp (charts) — cohesive, not rainbow */
--viz-1: #3fb98c;  --viz-2: #5b9bd5;  --viz-3: #a78bfa;
--viz-4: #e0a458;  --viz-5: #e5636b;  --viz-6: #6b7a8d;
```

### 1.2 Typography (stop using monospace for everything)

```
--font-display: 'Inter', -apple-system, sans-serif;   /* headings, KPIs — tight tracking */
--font-body:    'Inter', -apple-system, sans-serif;   /* body, labels */
--font-mono:    'JetBrains Mono', 'SF Mono', monospace; /* ONLY numbers in tables + IDs */
```

- Display/headings: Inter, weight 600–700, letter-spacing -0.02em on large sizes.
- **Monospace is for tabular numbers and IDs only** — not labels, not headings, not body.
  This alone will make it stop looking like a terminal.
- Type scale (px): 32 (page title) / 22 (section) / 15 (body) / 13 (label) / 11 (caption).
- Tabular figures (`font-variant-numeric: tabular-nums`) on every number column so digits align.

### 1.3 Layout & spacing

- Generous padding: cards `24px`, page gutters `40px`, section gaps `28px`.
- Border-radius: `10px` cards, `6px` controls, `4px` chips. (Soft, modern — not the current 3px.)
- Every card gets a subtle 1px `--border` and NO heavy fills. Elevation via border + faint
  shadow (`0 1px 3px rgba(0,0,0,0.3)`), not bright backgrounds.
- Left rail: keep it, but restyle — remove the "00/01/02" numeric codes (they imply a sequence
  that isn't real; per design principles, numbering must encode true order). Use clean labels
  + small line icons instead.

### 1.4 Signature element

**The "Decision Card"** — the one memorable, repeated element. Every page opens with one:
a bordered card with an accent left-edge, a one-line plain-English finding in display type,
the supporting number pulled out large, and a muted "why it matters" line. This is the
storytelling spine and the finance-moat surface. Spec in §2.1.

---

## 2. TIER 1 — SUBSTANCE (the findings/decision layer + AI)  [BUILD FIRST]

This is the highest-leverage tier. It merges Phase 6 (AI commentary) in, per Samuel's call.

### 2.1 The Decision Card component

New component `dashboard/components/DecisionCard.tsx`. Renders at the top of every page:

```
┌─────────────────────────────────────────────────────────────┐
│ ▏ KEY FINDING                                                │  ← accent left-edge
│ ▏                                                            │
│ ▏ 2.6% of customers generate 18.3% of revenue.               │  ← finding, display 18px
│ ▏                                                            │
│ ▏   R$ 1,159   avg LTV of this segment vs R$ 134 baseline    │  ← pulled-out number, mono
│ ▏                                                            │
│ ▏ → Concentrate retention spend on "Potential Loyalists".    │  ← recommendation, muted
│ ▏   8.6× the average customer value.                         │
└─────────────────────────────────────────────────────────────┘
```

Props: `finding` (string), `metric` (string), `metricLabel` (string),
`recommendation` (string), `source` ('computed' | 'ai'), optional `severity`.

### 2.2 AI commentary — grounded, never inventing numbers

New file `api/commentary.py` (or extend `api/main.py`) + a new route `/api/commentary/{page}`.

**Critical grounding pattern (this is the whole point — PRD §8):**
1. The endpoint first runs the page's mart query(ies) and gets the REAL numbers.
2. It builds a prompt that PASSES those numbers in explicitly, and instructs Claude to write
   commentary using ONLY the provided figures — never to compute or invent.
3. Claude returns 1–3 findings as structured JSON (finding / metric / recommendation).
4. The endpoint returns that JSON to the frontend, which renders it via DecisionCard.

```python
# Shape of the grounding prompt (pseudocode — Claude Code implements against the real Anthropic SDK):
#
#   numbers = run_page_summary_queries(page)   # dict of real computed values
#   prompt = f"""
#   You are a financial data analyst writing an executive finding for the {page} page.
#   Here are the ONLY numbers you may use (do not compute new ones, do not invent):
#   {json.dumps(numbers, indent=2)}
#
#   Return 1-3 findings as JSON: [{{"finding":..., "metric":..., "metric_label":...,
#   "recommendation":...}}]. Each finding must reference a specific number above.
#   Lead with the business decision, not the statistic. Be concise and concrete.
#   """
#   → call Claude, parse JSON, validate every cited number exists in `numbers`, return.
```

**Guardrail:** after Claude responds, the endpoint validates that any number appearing in the
output also appears in the `numbers` dict it was given (regex the figures, cross-check). If a
number is hallucinated, drop that finding and log it. This is the "real numbers only" rule
(PRD §12) enforced in code, and it's a strong interview talking point.

**Env:** `ANTHROPIC_API_KEY` from environment. If absent, the endpoint returns the hardcoded
fallback findings (§2.3) so the dashboard never breaks in a no-key environment (e.g. a reviewer
running it locally without a key). Cache AI responses to disk (the marts only change on rebuild).

### 2.3 Hardcoded fallback findings (verified, per page)

Claude Code must VERIFY each of these against the real warehouse via curl/DuckDB before
hardcoding — do not paste these numbers blind, confirm them first, adjust to actual values:

- **Exec Summary:** total revenue R$15.7M across 98.7k orders; latest complete month Aug-2018
  grew ~11.8% MoM. Repeat-purchase rate is low (~3%) — this is a marketplace, framed honestly.
- **Revenue:** top category (health_beauty) = ~13.7% of latest-month revenue; concentration
  finding (top 5 categories = X% of revenue → category dependency risk).
- **Cohorts:** repeat purchase is rare and happens early (M1–M3) if at all → retention window
  is short; win-back must fire within ~60 days.
- **Segments:** 2.6% "Potential Loyalists" = 18.3% of revenue, 8.6× baseline LTV → concentrate
  retention spend. RFM-vs-KMeans agreement only 9.5% → rule-based buckets miss real structure.
- **Sellers:** top-decile sellers drive X% of GMV; some high-revenue sellers have >10% late
  rate → concentration + quality risk in the seller base.
- **Logistics:** late delivery correlates negatively with review score (state-level corr down
  to -0.39) → late delivery is a measurable review-score (and repeat-rate) drag.

### 2.4 The margin model (finance moat) — new mart, documented assumptions

New dbt model `dbt/models/marts/mart_margin.sql` (Claude Code: this is the ONE place you may
add to marts/, since it's net-new, not a change to existing final models — confirm with Samuel
before running `dbt run` on it).

**Assumption model (documented, defensible, clearly flagged as illustrative):**
- Olist has `item_price` and `freight_value` but no COGS. So we model contribution margin with
  a **stated, category-level assumed gross-margin schedule** — the way a capital-markets analyst
  builds a P&L view when the ledger doesn't hand you cost directly.
- Define an assumed gross-margin % per category band (e.g. electronics ~12%, apparel ~45%,
  health_beauty ~40% — use published Brazilian e-commerce category benchmarks as the anchor,
  cite the assumption in a comment + the README).
- `contribution = item_price * assumed_margin_pct - freight_value` (freight as a real,
  data-backed cost-to-serve component; margin as the stated assumption).
- Output: contribution by category / month / seller-tier. Every consuming surface labels this
  **"Est. contribution (assumed-margin model — see methodology)"** so it's never mistaken for
  actuals. This honesty IS the finance-moat signal: you show you can build a margin view AND
  that you flag your assumptions, which is exactly the reconciliation-analyst instinct.

New page or Exec-Summary panel: **"Contribution View"** — est. contribution by category, the
one screen that most echoes Samuel's P&L-by-portfolio day job.

---

## 3. TIER 2 — VISUAL HIERARCHY + RIGHT CHARTS  [BUILD SECOND]

Apply the §1 design language everywhere, and put the right visual on each page.

### 3.1 Global restyle
- Swap the color tokens + typography (§1.1, §1.2) in `globals.css`. Every page inherits it.
- Restyle the rail (§1.3): drop numeric codes, add line icons, clean labels.
- Every page: DecisionCard at top → primary visual → supporting table/detail. One focal point
  per page, not a wall of equal-weight tables.

### 3.2 Per-page primary visual (the thing that was missing)

| Page | Current | Add as primary visual |
|---|---|---|
| Exec Summary | KPIs + line (ok) | Keep line chart (restyled). Add contribution-by-category mini bar. Add repeat-rate KPI (was missing). |
| Revenue | table only | **Stacked area** — revenue by top-6 categories over time. Table becomes secondary detail. |
| Cohorts | faint heatmap | **Proper retention heatmap** — readable color ramp (accent-wash → accent), M0 anchored, clear legend. |
| Segments | tables only | **Scatter / bubble** — segments on recency×frequency, bubble size = revenue. The 2.6%/18.3% story made visual. |
| Sellers | table (ok) | **Quadrant scatter** — revenue vs review score, tier-colored; table below. Fix truncated IDs → show city+state+category context. |
| Logistics | table | **Brazil choropleth** (or ranked bar if map is too heavy) — late-rate by state, geographic pattern visible at a glance. |

### 3.3 Human-readability fixes
- Seller "scorecard" must show actionable identity: city, state, top category, order count —
  not just a truncated hash. Keep the ID in mono, small, secondary.
- Every table: right-align numbers, tabular-nums, thousands separators, consistent decimals.
- Cohort heatmap: fix the legibility (current faint amber is unreadable at a glance).

---

## 4. TIER 3 — CREDIBILITY POLISH  [BUILD THIRD]

- Loading states (skeleton rows, not blank), empty states with direction (per design skill:
  "an empty screen is an invitation to act"), error states in the interface's voice.
- Responsive down to tablet/mobile (rail collapses, tables scroll).
- Keyboard focus visible, reduced-motion respected.
- A methodology footer/modal explaining the assumed-margin model + data caveats (launch period,
  marketplace repeat-rate) — one place, linked from the relevant "est." labels.
- Micro-interactions: subtle row hover, chart tooltips styled to the new tokens, one tasteful
  page-load reveal. Restraint — no scattered effects.

---

## 5. TIER 4 — DEPLOY  [BUILD LAST]

- Frontend → Vercel. API → a hosted option (Render / Railway / Fly for the FastAPI + DuckDB
  file, or pre-export mart JSON if a live backend is overkill for a static dataset — decide
  based on whether the AI "ask the data" panel needs live queries; it does, so host the API).
- `NEXT_PUBLIC_API_URL` → the deployed API URL. CORS → the Vercel domain.
- Link from samvgarcia.com. Confirm the whole thing works cold (no local warehouse).
- This is the step that makes the project *exist* for a hiring manager. Nothing is real until
  it's on a URL.

---

## 6. EXECUTION RULES (for Claude Code)

- **Tier order is fixed.** Ship and verify each tier before the next.
- **Real numbers only.** Every hardcoded finding verified against the warehouse first. The AI
  layer validates its own numbers in code (§2.2).
- **Don't touch existing marts** except the two net-new additions (`mart_margin`), and only
  after confirming with Samuel.
- **Verify visually.** After each page, describe what it looks like (you can't screenshot, so
  Samuel confirms). Build clean, restart dev clean (the `.next` collision), curl endpoints
  before wiring UI to them.
- **Teach as you go** (PRD teach-as-we-build): for each new concept (choropleth, grounded LLM
  prompt, contribution margin, Vercel deploy) give the one-line definition + interview answer.
