# RetailIQ v2 — Revamp Spec & Build Instructions
### For Claude Code · Governs the full UI/UX + credibility overhaul

> **How to use this document.** This is the source of truth for the RetailIQ revamp. It supersedes the visual/UX portions of the original founding PRD (data model, dbt architecture, and dataset facts there still hold). Read it top to bottom before touching code. When any later instruction conflicts with this file, this file wins. Every design value comes from `tokens.css` (Section 4) — never hardcode a hex, spacing, or duration in a component.
>
> **Teach-as-we-build still applies.** Every new concept gets: (1) one-sentence plain-English definition, (2) a one-paragraph interview answer Samuel can say verbatim, (3) where it sits in the architecture. Break down every new command.

---

## 0. WHY THIS REVAMP EXISTS (read this first — it's the whole point)

RetailIQ v1 works but reads one notch below "product" — closer to a dashboard template than to something a fintech would ship. A hiring-manager review surfaced **three credibility problems and one polish gap**. The revamp fixes all four. Do not lose sight of these while chasing pretty UI:

1. **The AI is making judgments it shouldn't.** Every page opened with a confident "Key Finding" that *decided* something ("prioritize health & beauty", "requires immediate intervention"). Several were analytically unsound — most damningly, recommending marketing spend off an 11.77% MoM figure that sits at the **truncated tail** of the Olist series (2018-08 is incomplete; the apparent trend is a data artifact, not a business signal). A reviewer who catches one bad number distrusts every number. **Fix: the AI describes, never decides. Judgment becomes Samuel's, hardcoded and quantified.** (Section 6.)

2. **The SQL is invisible.** This is the SQL-showcase project, yet not one line of SQL, no lineage, no dbt test result is visible from the dashboard. **Fix: a "View SQL" drawer on every panel + a dedicated interactive Methodology page.** (Section 7.)

3. **Small credibility leaks.** Currency mixed R$ and $; order count differs across surfaces (98,699 / ~98,700 / ~100k); segment names inconsistent (At-Risk vs Need Attention); Logistics shows ~15 states at exactly "0.0%" late (small-n masquerading as perfect). **Fix: a consistency + data-honesty pass.** (Section 8.)

4. **Polish gap.** v1 lacks a real landing/onboarding, orchestrated motion, and the calm-dense "instrument" feel. **Fix: design-token system + onboarding + motion language.** (Sections 4, 5, 9.)

**The one-line thesis for the whole revamp:** *Lead with the metric and the query; let AI narrate, not conclude; let Samuel's judgment be visibly human and finance-grade.*

---

## 1. AESTHETIC DIRECTION

Origin's **calm density** (see reference: black background, restrained single accent, real typographic hierarchy, micro-interactions that feel engineered), carrying RetailIQ's **green identity**. Not a rewrite of the vibe — a tightening of it.

- **Black-forward, layered surfaces.** Depth comes from 4 stacked greys (base→rail→panel→inset) and hairlines, *not* from heavy borders or shadows.
- **ONE green.** `--accent`. Spend it on: the active nav item, positive deltas, the single focus ring, sparingly on links. Everything else is the four-step grey text ramp. If green appears more than ~3–4 times on a screen, remove one.
- **Numbers are set in mono** (JetBrains Mono). This is the signature move — it makes the dashboard read as an *instrument*, columns align, and it quietly signals "financial tool." Labels/prose stay in Inter.
- **Motion settles, doesn't bounce.** `--ease-out` (a decelerating curve) on everything. No spring, no overshoot. Page loads stagger-reveal panels; numbers count up once on mount; hovers are 120ms.

**Restraint rule (Chanel's mirror):** before shipping any screen, remove one decorative element. The signature is the mono numbers + the stagger-in; keep everything else quiet.

---

## 2. WHAT'S UNCHANGED (don't rebuild these)

The analytical bones are strong. **Preserve and lightly restyle only:**
- Cohort retention matrix — good, correctly caveated. Keep the caveat.
- Segments method-comparison panel (silhouette, RFM→K-Means agreement %, "where they disagree the data is telling you something") — this is your best analytics-engineer signal. Keep verbatim, restyle only.
- Sellers log-scaled quadrant with median cross — sharp. Keep.
- All dbt models, the DuckDB warehouse, the mart structure — untouched by this revamp except where Section 8 requires a data-honesty fix (e.g. small-n suppression is a *query/filter* change).

---

## 3. INFORMATION ARCHITECTURE (v2)

```
Landing (/)                      ← NEW. Public front door. Not the dashboard.
└── Enter dashboard →
    Dashboard shell
    ├── Exec Summary   (/app)    ← was "/", now behind landing
    ├── Revenue        (/app/revenue)
    ├── Cohorts        (/app/cohorts)
    ├── Segments       (/app/segments)
    ├── Sellers        (/app/sellers)
    ├── Logistics      (/app/logistics)
    └── Methodology    (/app/methodology)   ← NEW. The SQL/lineage showcase.
```
- Landing is a real page (Section 9), not a modal. It's what gets linked from samvgarcia.com.
- The old intro banner / big-hero card is already removed (v1 work) — keep it gone.
- The 60-second tour stays but is **rebuilt on the new onboarding system** (Section 9.3); the current bespoke `ProductTour.tsx` is replaced.

---

## 4. DESIGN TOKENS (paste this file in as `styles/tokens.css`, import globally)

> This is non-negotiable infrastructure. Every component reads these. A code reviewer opening the repo should see zero raw hex in components — that alone signals "this person builds systems." Interview answer: *"Colors, type, spacing and motion live in one token file as CSS custom properties, so the whole app is themeable from one place and the design stays consistent — same reason a design system exists at any product company."*

```css
/* ============================================================
   RetailIQ Design Tokens — v2 "Terminal Calm"
   Single source of truth. Every color/space/type value in the
   app must reference a token here. No raw hex in components.
   Aesthetic: Origin's calm density + RetailIQ green identity.
   ============================================================ */

:root {
  /* ---- SURFACES (black-forward, layered not flat) ---- */
  --bg-base:        #0a0c10;   /* app background, deepest layer   */
  --bg-rail:        #0d1016;   /* left navigation rail            */
  --bg-panel:       #10141b;   /* cards / panels                  */
  --bg-panel-hover: #141922;   /* panel hover / raised            */
  --bg-inset:       #0c0f14;   /* wells, code drawers, inputs     */

  /* ---- HAIRLINES (structure via light, not boxes) ---- */
  --line-subtle:    #1a1f28;   /* default panel border            */
  --line-strong:    #262d38;   /* active / focused border         */
  --line-accent:    #1f3d31;   /* green-tinted divider            */

  /* ---- TEXT (four-step ramp, disciplined) ---- */
  --text-hi:        #e8edf4;   /* headlines, key numbers          */
  --text-mid:       #9aa5b4;   /* body, labels                    */
  --text-lo:        #5e6a7a;   /* captions, footnotes, eyebrows   */
  --text-faint:     #3a4453;   /* disabled, axis gridlines        */

  /* ---- ACCENT (ONE green, used with restraint) ---- */
  --accent:         #34d399;   /* primary green — RetailIQ identity */
  --accent-hi:      #6ee7b7;   /* hover / emphasis                */
  --accent-dim:     #1f8b66;   /* pressed / muted                 */
  --accent-wash:    rgba(52, 211, 153, 0.08);  /* faint fill      */
  --accent-glow:    rgba(52, 211, 153, 0.22);  /* focus ring      */

  /* ---- SEMANTIC (data states — NOT decoration) ---- */
  --pos:            #34d399;   /* positive delta (same as accent) */
  --neg:            #f87171;   /* negative delta                  */
  --warn:           #fbbf24;   /* caution / caveat                */
  --info:           #60a5fa;   /* neutral callout                 */
  /* low-confidence / small-n data gets --text-lo, never a color  */

  /* ---- TYPE FACES ---- */
  /* Display+body: Inter (variable). Data/mono: JetBrains Mono.   */
  /* Mono is deliberate — numbers align, reads "instrument".      */
  --font-sans: "Inter", -apple-system, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "SF Mono", ui-monospace, monospace;

  /* ---- TYPE SCALE (major-third-ish, capped) ---- */
  --t-display: 30px;   /* page H1                         */
  --t-h2:      19px;   /* panel titles                   */
  --t-body:    14px;   /* default                        */
  --t-sm:      13px;   /* table cells, secondary         */
  --t-cap:     11px;   /* eyebrows, footnotes (UPPERCASE) */
  --t-kpi:     34px;   /* the big KPI numbers (mono)     */

  --lh-tight:  1.15;
  --lh-body:   1.55;
  --tracking-cap: 0.08em;  /* eyebrow letter-spacing      */

  /* ---- SPACING (4px base grid) ---- */
  --s-1: 4px;   --s-2: 8px;   --s-3: 12px;  --s-4: 16px;
  --s-5: 20px;  --s-6: 24px;  --s-8: 32px;  --s-10: 40px;
  --s-12: 48px; --s-16: 64px;

  /* ---- RADIUS (soft, not pill; terminal-adjacent) ---- */
  --r-sm: 6px;   --r-md: 10px;  --r-lg: 14px;

  /* ---- MOTION (engineered, not bouncy) ---- */
  --ease-out:  cubic-bezier(0.16, 1, 0.3, 1);   /* decel, "settles" */
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --dur-fast:  120ms;
  --dur-base:  220ms;
  --dur-slow:  420ms;

  /* ---- ELEVATION (subtle; light does the work) ---- */
  --shadow-panel: 0 1px 0 rgba(255,255,255,0.02) inset,
                  0 8px 24px -12px rgba(0,0,0,0.6);
  --shadow-pop:   0 12px 40px -8px rgba(0,0,0,0.7);
}

/* Respect reduced motion — quality floor, non-negotiable */
@media (prefers-reduced-motion: reduce) {
  :root { --dur-fast: 0ms; --dur-base: 0ms; --dur-slow: 0ms; }
}
```

**Load the fonts** (in the root layout `<head>` or via `next/font`): Inter (variable) + JetBrains Mono. Prefer `next/font/google` for both so they self-host and don't flash.

---

## 5. COMPONENT CONTRACTS

Build these as the shared primitives. Every page composes them; no page invents its own card/kpi styling.

### 5.1 `<Panel>`
The base container. `--bg-panel`, 1px `--line-subtle` border, `--r-lg`, `--s-6` padding, `--shadow-panel`. Optional `title` (H2, Inter, `--text-hi`) + optional `eyebrow` (uppercase `--t-cap`, `--text-lo`, `--tracking-cap`). **Every Panel that renders data from a mart takes an optional `sqlModel` prop** → renders the "View SQL" affordance (5.5) in its top-right.

### 5.2 `<Kpi>`
Label (`--t-cap` uppercase `--text-lo`) + value (mono, `--t-kpi`, `--text-hi`) + optional delta. **Delta rules:** positive → `--pos` with ▲; negative → `--neg` with ▼; **if the underlying period is flagged low-confidence (small-n or truncated), render the delta in `--text-lo` with no arrow and a `†` that footnotes why.** Value counts up from 0 once on mount over `--dur-slow` with `--ease-out` (respect reduced-motion: show final value instantly).

### 5.3 `<AnalystNote>` (replaces the old "Key Finding" card)
This is the demoted, describe-only AI surface. See Section 6 for content rules. Visual: NOT a big glowing green card. It's a quiet inset (`--bg-inset`, left border `2px --line-accent`), small `AI` chip top-right (`--text-lo`, not green), body in `--text-mid`. It sits *below* the numbers it describes, never above them. Max ~2 sentences. Every number inside it is passed in as data — the component receives a `figures` array and the prose template, and asserts each figure exists before render (dev-mode throw if a figure is missing, so ungrounded copy can't ship).

### 5.4 `<Caveat>`
A first-class citizen, not a footnote afterthought. Small `--warn`-dot + `--text-lo` text. Auto-attached by the caveat engine (Section 6.2) whenever: sample size below threshold, series-tail truncation, or |correlation| < 0.4 described as meaningful. Example render: *"† 2018-08 is the final month in the dataset and may be partially truncated; treat month-over-month at the series edge with caution."*

### 5.5 `<SqlDrawer>` — the SQL showcase surface
Triggered by a small `</> View SQL` text button (`--text-lo`, hover `--accent`) in any data Panel's corner. Opens a right-side drawer (`--bg-inset`, `--shadow-pop`, slide-in `--dur-base --ease-out`). Contents:
- **Model name + layer badge** (staging / intermediate / mart).
- **The actual SQL**, syntax-highlighted, mono, read from the real dbt model file (see 7.3 for how it's bundled). Highlight the "showcase" construct (window fn / recursive CTE / NTILE) with a subtle `--accent-wash` line background + a margin note naming it.
- **Lineage strip**: `raw → stg_x → int_y → THIS`, each a chip; the current model emphasized.
- **Tests on this model**: list of dbt tests (unique, not_null, relationships, custom) with a ✓.
- A `Open in Methodology →` link (jumps to the DAG node, 7.2).
Keyboard: Esc closes, focus-trapped, returns focus to trigger.

### 5.6 `<DeltaFigure>`
Inline mono number + colored delta, reused in tables. Same low-confidence rule as `<Kpi>`.

### 5.7 Motion primitives
- `StaggerIn`: wraps a page's panels; each child fades+translates-up 8px, 60ms stagger, `--ease-out`. Runs once per route mount.
- `CountUp`: the KPI number animation (5.2).
- Hover: panels lift border `--line-subtle`→`--line-strong` over `--dur-fast`; never move/scale the panel.

### 5.8 `<Recommendation>` — two-tier structure (added post-launch)
Samuel's judgment, not the model's (see 6.3 for content rules). A stakeholder-skim review found the original single-paragraph version buried the actual decision at the same visual weight as its supporting prose — a skimming reader could miss it entirely. Fixed by requiring **two tiers**, both mandatory props:
- **`takeaway`** (required) — one bolded line, `--text-hi`, `--t-body` weight 600: the action + the headline number, e.g. *"Win back 247 Potential Loyalists → ~R$286K opportunity."* This is the thing a skimming stakeholder must not miss — render it first, above the reasoning.
- **`children`** (required) — the existing reasoning paragraph (the "why"), `--text-mid`, `--t-body` regular weight, unchanged from the original single-tier copy otherwise.
Both keep the `Author: analysis` mono tag top-right (never `AI`) — the two-tier split changes emphasis, not provenance. A `<Recommendation>` without a `takeaway` is a build error, not a style choice — the two-tier structure is the fix, not an option.

---

## 6. THE AI RE-SCOPE (the most important change)

### 6.1 The rule
**AI describes what's on screen. AI never decides what to do.** Judgment (recommendations) is authored by Samuel, hardcoded, quantified, and defensible in an interview.

| Old (delete) | New (build) |
|---|---|
| "Key Finding: prioritize health & beauty" (a decision) | `<AnalystNote>`: "Health & beauty is the largest category in 2018-08 at R$136,823 (13.7% of gross), up 11.8% MoM." (a grounded description) |
| LLM-authored recommendation | `<Recommendation>` (6.3): human-written, quantified, one per page, with the counterfactual |
| Numbers possibly invented | Every figure passed in from the mart query; component throws in dev if a figure is missing |

### 6.2 The caveat engine (`ai/caveats.ts`)
A pure function that takes a metric context and returns zero or more `<Caveat>`s. Rules (all derived from real dataset facts):
- **Truncated tail:** any MoM/period delta whose latest period is the dataset's final month (2018-08, and the sparse 2016-09..2017-02 launch window) → attach the truncation caveat and downgrade the delta to low-confidence styling.
- **Small-n:** any cohort/segment/state cell computed on n below a stated threshold (define per surface; e.g. cohorts already note "<5 customers", states in Logistics need the same) → suppress the flashy number or grey it + caveat.
- **Weak correlation:** any |r| < 0.4 must not be described with strong verbs ("drives", "requires intervention"). The AnalystNote template for correlations is forced to neutral phrasing and the caveat notes the strength band.
This engine runs *before* the AnalystNote renders; the note consumes its output. Interview answer: *"I built a caveat layer so the AI can't overstate — truncated series, small samples, and weak correlations are auto-flagged in code before any narration is generated. It's the same discipline as not trusting a P&L number at month-end before the cutoff is confirmed."*

### 6.3 `<Recommendation>` — Samuel's judgment, not the model's
One per page, authored by hand, must be **specific to this data and quantified with a counterfactual**. Generic mad-libs ("launch a loyalty program") are banned. Pattern: *observation (with number) → mechanism → quantified opportunity → the action*. Examples to write against the real marts (validate numbers first, never assert unverified):
- Segments: "The ~2,471 'Potential Loyalists' sit at R$1,158 avg LTV but a [X]% second-order rate. Closing the gap to the Champions' [Y]% rate on this group alone is ~R$[Z] incremental LTV — a tighter target than a blanket retention program."
- Logistics: "Late delivery in [state] correlates with review score at r=[real value]. It's a moderate, not strong, relationship — worth an SLA test on the [n] affected orders, not a full logistics overhaul."
- Sellers: "[N] top-quartile-revenue sellers exceed a 10% late rate. They're [P]% of revenue — an onboarding-standards fix here protects R$[V], quantified, vs. an untargeted quality push."
Each `<Recommendation>` carries a small `Author: analysis` tag (not `AI`) to make the human-judgment provenance explicit and honest.

### 6.4 "Ask the data" panel — KEEP, harden
This is the *good* AI use; keep it on Exec Summary (or a dedicated slot). Hardening:
- It may only answer from **pre-computed mart summaries passed into the prompt** — never free-form SQL from the LLM, never invented numbers.
- Every answer cites which mart(s) it used (small chips).
- If the question can't be answered from available marts, it says so plainly ("I don't have a mart covering seller-level payment types") — an honest empty state, not a hallucinated answer. This honest-limits behavior is itself a hiring signal.

---

## 7. EXPOSING THE SQL (View-SQL drawer + Methodology page)

### 7.1 Why (interview framing)
*"The dashboard is the conclusion; the Methodology page and the View-SQL drawers are the work. I wanted a reviewer to be able to click from any number straight to the exact dbt model, its lineage, and its tests — so the SQL isn't a folder you have to trust, it's on display doing the analysis."*

### 7.2 Methodology page (`/app/methodology`) — interactive data-flow
An interactive DAG of the warehouse: `raw (9 sources) → staging → intermediate → marts`. Requirements:
- **Visual, navigable graph.** Nodes = models, edges = dependencies, colored by layer. Not a static image — clicking a node opens its detail (SQL, tests, description, row count). Use React Flow (`reactflow`) — it's the standard, handles pan/zoom/layout. If a lighter touch is wanted, an SVG columns-by-layer diagram with hover is acceptable, but React Flow reads more "engineered".
- **Layer legend** and a short prose explainer of the raw→staging→intermediate→marts pattern (teach-as-we-build: define each layer in one sentence).
- **Per-node panel** reuses `<SqlDrawer>` content inline: SQL with the showcase construct highlighted, lineage, tests, row count from DuckDB.
- **A "SQL techniques" index**: a small table listing each advanced construct (window functions, recursive CTE, NTILE, RANK/PERCENT_RANK, gap-and-island) → which mart uses it → a one-line "why this technique here". This is the explicit SQL-proficiency proof the CV can link to.

### 7.3 How SQL gets into the UI (build note)
The dbt model `.sql` files are the source of truth. At build time, copy `dbt/models/**/*.sql` into a bundled JSON (`generated/models.json`: `{ model_name: { layer, sql, tests[], description, lineage[], rowcount } }`) via a small prebuild script. Tests + descriptions come from the dbt `schema.yml`; row counts from a one-shot DuckDB query at build. The UI reads this JSON — never ships a live DB connection to the browser. Add the prebuild step to `package.json` (`"prebuild": "node scripts/bundle-models.mjs"`) and explain each part of that command to Samuel when you add it.

---

## 8. CONSISTENCY & DATA-HONESTY PASS (do this early — it's cheap and high-trust)

1. **One order number, everywhere.** Decide the canonical figure and the filter behind it (recommend: valid orders after status/payment filtering — state it). Use it on Exec Summary, tour, About, README. Footnote the filter once. Kill "~100k" prose; use the real number.
2. **Currency: R$ only.** Purge every `$` in AI/segment copy. All money is `R$` + mono, thousands-separated, 2dp. One formatting util (`fmtBRL`) used everywhere.
3. **Segment taxonomy: one canonical set of names**, identical in the bubble legend, the economics table, the AnalystNote, and the recommendation. Pick from the PRD set (Champions / Loyal / Potential Loyalists / At-Risk / Hibernating / Need-Attention — choose the final list, document it, use it everywhere).
4. **Logistics small-n suppression.** The block of states at "0.0%" late is almost certainly low sample, not perfection. Suppress states below an order-count threshold from the ranked bar (or render them greyed in a separate "insufficient sample" group) and caveat. Same treatment for the delta-review correlation column when n is low.
5. **Correlation honesty.** Anywhere a correlation is shown (Logistics), label the strength band (weak/moderate/strong) and never pair a weak r with a strong action verb (enforced by 6.2).

---

## 9. LANDING + ONBOARDING + MOTION

### 9.1 Landing page (`/`) — the public front door
Not the dashboard. One scroll, ~3 sections, then "Enter dashboard →". Purpose: in 15 seconds a hiring manager understands what this is and why it's credible.
- **Hero (the thesis, per design skill):** the most characteristic thing in this subject's world is *a real business decision backed by a real query*. So the hero is NOT a big-number-with-gradient template. It's a short, confident line ("Decision-support analytics on 98,699 real Olist orders") **with a live, tiny animated proof** beside it: a mini revenue sparkline drawing itself in on load, or a 3-line SQL snippet that "types" then resolves to a number. Green used exactly once here.
- **Credibility strip:** real dataset (Olist, 2016–2018, not synthetic) · dbt-tested warehouse · code-built, no BI tool · live. Four quiet chips, mono labels.
- **What you can explore:** the 6 analysis areas as a restrained grid (this is the *good* home for the old 6-card content that was cut from Exec Summary — it belongs on the landing, not above the fold of the dashboard).
- **Built by Samuel** line → samvgarcia.com. Honest, short.
- Respect reduced motion; everything degrades to static.

### 9.2 Onboarding = the landing itself + an optional tour
Don't gate the dashboard behind a multi-step wizard (friction for a reviewer who just wants to see the work). The landing *is* the onboarding. The guided tour is opt-in from the dashboard, rebuilt on a small reusable system (9.3).

### 9.3 Tour (rebuilt) — reusable, not bespoke
Replace `ProductTour.tsx` with a small `<Tour>` driven by a config array (`{ target, title, body, placement }`). Same spotlight technique is fine (single box-shadow cutout). But:
- Config-driven so steps live in data, not JSX.
- Steps retargeted to the v2 surfaces, and **step 4 points at a real `<SqlDrawer>` trigger** ("every number here has its query one click away") — that ties the tour to the revamp's headline feature instead of a generic panel.
- Honest count, keyboard nav, `localStorage` seen-flag (keep v1's approach), reduced-motion aware.

### 9.4 Motion language (apply consistently)
- Route enter: `StaggerIn` panels (5.7).
- KPIs: `CountUp` once.
- Charts: draw-in on mount (line paths animate stroke-dashoffset; bars grow from baseline) over `--dur-slow`, once, reduced-motion → instant.
- Drawer/modal: slide + fade `--dur-base --ease-out`.
- Hover: border-brighten only, `--dur-fast`.
- **Nothing loops.** Ambient looping motion reads as "AI-generated toy". One-shot reveals read as "engineered".

---

## 10. BUILD ORDER (phased — one per session where possible)

**R0 — Tokens + primitives.** Drop in `tokens.css`, wire fonts, build `<Panel> <Kpi> <AnalystNote> <Caveat> <DeltaFigure>` + motion primitives. Restyle Exec Summary to prove the system end-to-end. *Done when:* Exec Summary uses only tokens, no raw hex, stagger+countup work, reduced-motion verified.

**R1 — Consistency & data-honesty pass (Section 8).** Cheap, high-trust, do it before more UI. *Done when:* one order number everywhere, R$-only, segment names unified, Logistics small-n suppressed + caveated.

**R2 — AI re-scope (Section 6).** Delete old Key-Finding cards; build caveat engine, `<AnalystNote>`, `<Recommendation>` (hand-author the per-page recs against validated numbers), harden Ask-the-data. *Done when:* no AI text makes a decision; every AI number is passed-in and dev-asserted; recs are quantified + human-tagged.

**R3 — View-SQL drawer + model bundling (7.3, 5.5).** Prebuild script → `models.json`; `<SqlDrawer>` on every data panel. *Done when:* any panel → real dbt SQL, lineage, tests, showcase construct highlighted.

**R4 — Methodology page (7.2).** Interactive DAG + SQL-techniques index. *Done when:* clickable graph, per-node detail, techniques table links to marts.

**R5 — Landing + onboarding (9.1, 9.2).** Public landing; move 6-card content here; wire "Enter dashboard". *Done when:* landing tells the story in 15s, links to samvgarcia.com, reduced-motion clean.

**R6 — Tour rebuild + motion polish (9.3, 9.4).** Config-driven tour, chart draw-ins, final motion pass. *Done when:* tour retargeted (step 4 → SqlDrawer), all motion one-shot + reduced-motion aware.

**R7 — Full sweep + README/methodology cross-links.** Every panel has sqlModel; README leads with a decision and links the Methodology page; CV-facing links updated. *Done when:* Section 11 checklist passes.

At each session end: note what's done + what's next so the next chat resumes clean.

---

## 11. DEFINITION OF DONE (v2)

- [ ] Zero raw hex/spacing/duration in components — all from `tokens.css`.
- [ ] No AI-authored text makes a recommendation or decision anywhere. AI describes only.
- [ ] Every number shown by an AnalystNote is passed in from a query and dev-asserted (no possible hallucination path).
- [ ] Caveat engine flags truncated tail (2018-08 + launch window), small-n, and weak correlations automatically.
- [ ] Every hand-authored `<Recommendation>` is quantified against a validated real number, carries a counterfactual, and is tagged as human analysis.
- [ ] "View SQL" drawer on every data panel → real dbt model, lineage, tests, highlighted showcase construct.
- [ ] Methodology page: interactive DAG + SQL-techniques index, each node clickable to SQL/tests/rowcount.
- [ ] One canonical order count, R$-only currency, one segment taxonomy — consistent on every surface incl. README.
- [ ] Logistics: no low-sample state shown as "0.0%" without suppression/caveat; correlations labeled by strength band.
- [ ] Landing page live, tells the story in ~15s, hosts the 6-area grid, links samvgarcia.com; dashboard at `/app`.
- [ ] Tour is config-driven, step 4 targets a SqlDrawer trigger, keyboard + reduced-motion clean.
- [ ] All motion one-shot, `--ease-out`, reduced-motion respected; nothing loops.
- [ ] README leads with a decision, links Methodology; CV surfaces SQL + dbt + live dashboard + Methodology link.

---

## 12. WORKING AGREEMENTS (unchanged from founding PRD, restated)
- Build incrementally, verify each step (row counts, real outputs) — no big untested blobs.
- **Real numbers only** — never a figure in UI/README/commentary that isn't computed from the actual data. This is now enforced in code (6.1–6.2), not just discipline.
- Explain the "why" briefly; Samuel is strong technically.
- Code-built, deployable artifacts over no-code, for anything portfolio-facing.
- Keep the finance-moat framing visible where a choice echoes capital-markets/analytics-engineering practice.
- Default deliverables to real repo files, not inline snippets.
- On resume, ask which R-phase we're on if unstated.
