import PageHeader from '@/components/PageHeader';
import Panel from '@/components/Panel';
import WarehouseNotice from '@/components/WarehouseNotice';
import AnalystNote from '@/components/v2/AnalystNote';
import Recommendation from '@/components/v2/Recommendation';
import { apiGet, ApiError, CohortRow } from '@/lib/api';

export const dynamic = 'force-dynamic';

// --accent (#3fb98c) as an RGB triple, so the heatmap ramp can vary its own
// alpha channel from accent-wash-level (~0.08) up to fully solid — a single-
// hue sequential ramp per the design system, not a second color.
const ACCENT_RGB = '63, 185, 140';

// M0 is always 100% by definition (cohort size vs itself) — it's the ramp's
// anchor, not a data point to scale against. Scaling the whole grid 0–100
// linearly made every post-M0 cell (real retention is usually low single
// digits) collapse to near-invisible, which was the original "unreadable at
// a glance" bug. Instead we calibrate the ramp to the actual spread of
// non-M0 retention rates, with a sqrt curve so the low end (where nearly all
// the real variation lives) is visually legible instead of compressed near 0.
function heatColor(pct: number, isM0: boolean, maxNonM0: number) {
  if (isM0) return `rgba(${ACCENT_RGB}, 1)`;
  if (maxNonM0 <= 0) return `rgba(${ACCENT_RGB}, 0.08)`;
  const normalized = Math.min(1, Math.sqrt(pct / maxNonM0));
  const alpha = 0.08 + normalized * 0.84; // accent-wash floor -> near-solid ceiling
  return `rgba(${ACCENT_RGB}, ${alpha.toFixed(3)})`;
}

// Same launch-period window as RevenueTrendChart.tsx — Olist's first cohorts
// (Sep 2016–Feb 2017) are real but tiny, some under 5 customers, so their
// retention percentages swing wildly on small denominators.
const LAUNCH_PERIOD_END = '2017-02';

// Overall repeat-purchase rate (share of all customers with order_count >= 2)
// comes from mart_rfm, not mart_cohorts — this page only fetches /api/cohorts,
// so rather than add a second fetch just for one number, it's verified
// directly against the warehouse and hardcoded, same convention as
// api/commentary.py's FALLBACK_FINDINGS. The M1–M3 share below it IS computed
// live from this page's own `rows`, matching commentary.py's _numbers_cohorts().
const OVERALL_REPEAT_RATE_PCT = 3.0;

// Exact day-gap between a customer's 1st and 2nd order (not derivable from
// mart_cohorts, which only has month-granularity `periods_since_first_order`
// — datediff('month', ...) in mart_cohorts.sql). Verified directly against
// the warehouse (int_orders_enriched, row_number()-ranked orders per
// customer, datediff('day', first, second)) across all 2,876 repeat
// customers: median gap = 28 days; 50.9% of all second orders land within
// the first 30 days (day-exact), vs. 17.5% in days 31–90 and 25.9% past
// 120 days. This is the number the win-back trigger below is keyed to —
// day-exact, so it can be checked for consistency against the month-bucket
// M1–M3 framing above (day ~20–25 sits inside M1, not "before" M1–M3).
const MEDIAN_DAYS_TO_SECOND_ORDER = 28;
const SHARE_SECOND_ORDERS_WITHIN_30D_PCT = 50.9;

export default async function CohortsPage() {
  let rows: CohortRow[] = [];
  let error: string | null = null;

  try {
    rows = await apiGet<CohortRow[]>('/api/cohorts');
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Unknown error';
  }

  if (error) {
    return (
      <>
        <PageHeader eyebrow="COHORTS" title="Cohort Analysis" />
        <WarehouseNotice error={error} />
      </>
    );
  }

  const cohortMonths = Array.from(new Set(rows.map((r) => r.cohort_month))).sort();
  const maxPeriod = rows.reduce((m, r) => Math.max(m, r.periods_since_first_order), 0);
  const grid = new Map(rows.map((r) => [`${r.cohort_month}:${r.periods_since_first_order}`, r]));
  const hasLaunchPeriod = cohortMonths.some((cm) => cm <= LAUNCH_PERIOD_END);
  // Scale the ramp off post-launch cohorts only — a launch-period cohort can
  // be a handful of customers (some under 5), so one early repeat purchase
  // reads as "100% retention" and would otherwise blow out the whole scale
  // (confirmed against real data: post-launch max is ~0.7%, one launch-period
  // outlier hits 100% on a 1-customer sample). Those cells still render in
  // the grid — just not used to calibrate the color ramp — and the existing
  // footnote below already flags them as not statistically meaningful.
  const maxNonM0 = rows.reduce(
    (m, r) => (r.periods_since_first_order > 0 && r.cohort_month > LAUNCH_PERIOD_END ? Math.max(m, r.retention_rate_pct) : m),
    0
  );

  // Live-computed from this page's own data, matching commentary.py's
  // _numbers_cohorts(): of all repeat (period >= 1) activations, what share
  // land in the first 3 months after a customer's first order.
  const activeByPeriod = rows.filter((r) => r.periods_since_first_order >= 1);
  const totalRepeatActivations = activeByPeriod.reduce((s, r) => s + r.active_customers, 0);
  const m1to3Activations = activeByPeriod
    .filter((r) => r.periods_since_first_order <= 3)
    .reduce((s, r) => s + r.active_customers, 0);
  const m1to3SharePct = totalRepeatActivations > 0 ? (m1to3Activations * 100) / totalRepeatActivations : null;

  return (
    <>
      <PageHeader
        eyebrow="COHORTS"
        title="Cohort Analysis"
        subtitle="Retention by acquisition month. Olist is a marketplace, not a subscription product — repeat-purchase rates are naturally low; this shows when repeat purchases happen, not that they're high."
      />

      {m1to3SharePct !== null && (
        <div className="rq-v2" style={{ marginBottom: 20 }}>
          <AnalystNote
            figures={{
              repeatRate: OVERALL_REPEAT_RATE_PCT,
              m1to3Share: m1to3SharePct.toFixed(1),
              medianDays: MEDIAN_DAYS_TO_SECOND_ORDER,
              within30d: SHARE_SECOND_ORDERS_WITHIN_30D_PCT,
            }}
          >
            {(f) => (
              <>
                <span className="rq-mono" style={{ color: 'var(--text-hi)' }}>
                  {f.repeatRate}%
                </span>{' '}
                of customers ever place a second order. Of those repeat purchases,{' '}
                <span className="rq-mono" style={{ color: 'var(--text-hi)' }}>
                  {f.m1to3Share}%
                </span>{' '}
                happen within the first 3 months (M1–M3) of the customer&apos;s first order — and within that
                window, the density is front-loaded: the median gap between a customer&apos;s first and second order
                is{' '}
                <span className="rq-mono" style={{ color: 'var(--text-hi)' }}>
                  {f.medianDays} days
                </span>
                , with{' '}
                <span className="rq-mono" style={{ color: 'var(--text-hi)' }}>
                  {f.within30d}%
                </span>{' '}
                of all second orders landing inside the first 30 days (M1) alone.
              </>
            )}
          </AnalystNote>
          <Recommendation takeaway="Move the win-back trigger to day 21 — the current day 60–75 target misses the repeat-purchase peak entirely.">
            Half of all second orders ({SHARE_SECOND_ORDERS_WITHIN_30D_PCT}%) happen within 30 days of the first —
            median {MEDIAN_DAYS_TO_SECOND_ORDER} days — which sits inside M1, not in the M2–M3 back half of the
            window. A win-back campaign timed to trigger around day 21 (a week of lead time before the 28-day
            median) catches customers while they&apos;re still in their natural repeat-purchase window; a day-60+
            trigger fires after most of that density has already passed. That&apos;s a scheduling fix to an existing
            campaign, not a bigger win-back budget, as the first lever to pull.
          </Recommendation>
        </div>
      )}

      <Panel title="Retention Matrix (% of cohort active in period N)" sqlModel="mart_cohorts">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 14,
            fontSize: 12,
            color: 'var(--text-muted)',
          }}
        >
          <span>M0 (100%, anchor)</span>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              background: `rgba(${ACCENT_RGB}, 1)`,
              display: 'inline-block',
            }}
          />
          <span style={{ marginLeft: 16 }}>M1+ retention, low</span>
          <span
            style={{
              width: 60,
              height: 10,
              borderRadius: 3,
              background: `linear-gradient(90deg, rgba(${ACCENT_RGB}, 0.08), rgba(${ACCENT_RGB}, 0.92))`,
              display: 'inline-block',
            }}
          />
          <span>high (max observed: {maxNonM0.toFixed(1)}%)</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-dim)', fontWeight: 500 }}>Cohort</th>
                {Array.from({ length: maxPeriod + 1 }, (_, i) => (
                  <th key={i} className="mono" style={{ padding: '6px 10px', color: 'var(--text-dim)', fontWeight: 500 }}>
                    M{i}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohortMonths.map((cm) => (
                <tr key={cm}>
                  <td className="mono" style={{ padding: '6px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{cm}</td>
                  {Array.from({ length: maxPeriod + 1 }, (_, i) => {
                    const cell = grid.get(`${cm}:${i}`);
                    const isM0 = i === 0;
                    const bgAlpha = cell ? (isM0 ? 1 : 0.08 + Math.min(1, Math.sqrt(cell.retention_rate_pct / (maxNonM0 || 1))) * 0.84) : 0;
                    return (
                      <td
                        key={i}
                        className="mono"
                        style={{
                          padding: '6px 10px',
                          textAlign: 'center',
                          background: cell ? heatColor(cell.retention_rate_pct, isM0, maxNonM0) : 'transparent',
                          color: cell && bgAlpha > 0.5 ? 'var(--bg)' : 'var(--text-muted)',
                        }}
                      >
                        {cell ? `${cell.retention_rate_pct}%` : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {cohortMonths.length === 0 && (
                <tr>
                  <td style={{ padding: 16, color: 'var(--text-dim)' }}>No cohort data.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {hasLaunchPeriod && (
          <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8, textAlign: 'center' }}>
            Sep 2016–Feb 2017 cohorts: small sample size (some cohorts under 5 customers) — retention % from these
            cohorts is not statistically meaningful.
          </p>
        )}
      </Panel>
    </>
  );
}
