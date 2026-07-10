import Link from 'next/link';
import IntroHero from '@/components/IntroHero';
import Panel from '@/components/v2/Panel';
import Kpi from '@/components/v2/Kpi';
import AnalystNote from '@/components/v2/AnalystNote';
import Recommendation from '@/components/v2/Recommendation';
import RevenueChart from '@/components/v2/RevenueChart';
import AskTheData from '@/components/v2/AskTheData';
import { getCaveats } from '@/ai/caveats';
import { StaggerIn } from '@/components/v2/motion';
import { fmtBRL } from '@/lib/format';
import { apiGet, ApiError, RevenueRow, RevenueSummary } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * Exec Summary — the v2 token/primitive system's proving ground (PRD §10),
 * since expanded with the AI re-scope (R2), SQL drawer (R3), and tour
 * retarget (R6). AnalystNote copy is hand-authored against numbers fetched
 * live from /api/revenue and /api/revenue/summary — never LLM-generated
 * (§6.1); the "Ask the data" panel below is the one AI surface on this page
 * that calls out to Claude, and it's hardened per §6.4.
 *
 * `id="tour-decision-card"` and `id="tour-sql-drawer"` (the latter passed
 * via Panel's `sqlTriggerId`) are the DOM targets components/Tour.tsx's
 * config-driven steps spotlight — see components/TourProvider.tsx.
 */
export default async function ExecutiveSummaryPage() {
  let summary: RevenueSummary | null = null;
  let revenue: RevenueRow[] = [];
  let error: string | null = null;

  try {
    [summary, revenue] = await Promise.all([
      apiGet<RevenueSummary>('/api/revenue/summary'),
      apiGet<RevenueRow[]>('/api/revenue'),
    ]);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Unknown error';
  }

  if (error || !summary) {
    return (
      <>
        <IntroHero />
        <div className="rq-v2">
          <div
            style={{
              border: '1px solid var(--line-strong)',
              borderRadius: 'var(--r-md)',
              background: 'var(--bg-panel)',
              padding: 'var(--s-5) var(--s-6)',
              maxWidth: 640,
              color: 'var(--neg)',
              fontSize: 'var(--t-sm)',
            }}
          >
            Warehouse unavailable: {error ?? 'no summary data returned'}
          </div>
        </div>
      </>
    );
  }

  const monthlyTotals = Object.values(
    revenue.reduce<Record<string, { order_month: string; revenue: number }>>((acc, r) => {
      acc[r.order_month] = acc[r.order_month] ?? { order_month: r.order_month, revenue: 0 };
      acc[r.order_month].revenue += r.gross_revenue;
      return acc;
    }, {})
  ).sort((a, b) => a.order_month.localeCompare(b.order_month));

  const topCategories = [...revenue]
    .filter((r) => r.order_month === summary?.latest_month)
    .sort((a, b) => b.gross_revenue - a.gross_revenue)
    .slice(0, 5);

  return (
    <>
      <IntroHero />

      <div className="rq-v2">
        <div style={{ marginBottom: 'var(--s-8)' }}>
          <div className="rq-eyebrow">Exec Summary</div>
          <h1
            style={{
              fontSize: 'var(--t-display)',
              color: 'var(--text-hi)',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              lineHeight: 'var(--lh-tight)',
              margin: '6px 0',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Executive Summary
          </h1>
          <div style={{ color: 'var(--text-mid)', fontSize: 'var(--t-sm)', maxWidth: 640 }}>
            Headline revenue, order volume, and category performance across the full Olist dataset (2016–2018).
          </div>
        </div>

        <StaggerIn>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--s-4)', marginBottom: 'var(--s-6)' }}>
            <Kpi label="Total Revenue" countTo={summary.total_revenue} format="brl" />
            <Kpi label="Valid Orders" countTo={summary.total_orders} format="int" />
            <Kpi label="Avg Order Value" value={fmtBRL(summary.aov, 2)} />
            <Kpi
              label={`Latest Month (${summary.latest_month})`}
              value={fmtBRL(summary.latest_month_revenue)}
              delta={{ value: summary.latest_total_revenue_growth, confidence: 'low', footnote: 'partial month' }}
            />
          </div>
          <p style={{ fontSize: 'var(--t-cap)', color: 'var(--text-lo)', marginTop: `calc(-1 * var(--s-4))`, marginBottom: 'var(--s-6)' }}>
            &quot;Valid orders&quot; = every order in a month with enough volume to be treated as complete — this
            excludes the dataset&apos;s trailing partial month(s), the same filter behind every total on this page.
            One number, used everywhere.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 'var(--s-4)' }}>
            <Panel title="Monthly Gross Revenue" sqlModel="mart_revenue" sqlTriggerId="tour-sql-drawer">
              <div id="tour-decision-card">
                <RevenueChart data={monthlyTotals} />
                <p style={{ fontSize: 'var(--t-cap)', color: 'var(--text-lo)', marginTop: 'var(--s-3)', textAlign: 'center' }}>
                  Sep 2016–Feb 2017: launch period, small sample — trend stabilises from Mar 2017.
                </p>
                <AnalystNote
                  figures={{ peak: 'R$1.17M', band: 'R$1.0–1.15M', latest: summary.latest_month }}
                  caveat={getCaveats({ period: summary.latest_month })
                    .map((c) => c.text)
                    .join(' ')}
                >
                  {(f) => (
                    <>
                      Revenue climbs steadily from March 2017, peaking near{' '}
                      <span className="rq-mono" style={{ color: 'var(--text-hi)' }}>
                        {f.peak}
                      </span>
                      /month in November 2017 and holding roughly a{' '}
                      <span className="rq-mono" style={{ color: 'var(--text-hi)' }}>
                        {f.band}
                      </span>{' '}
                      band through 2018. The final point (
                      <span className="rq-mono" style={{ color: 'var(--text-hi)' }}>
                        {f.latest}
                      </span>
                      ) is a partial month.
                    </>
                  )}
                </AnalystNote>
              </div>
            </Panel>

            <Panel title={`Top Categories — ${summary.latest_month}`} sqlModel="mart_revenue">
              {topCategories.map((c) => (
                <div
                  key={c.category_name_en}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: 'var(--s-2) 0',
                    borderBottom: '1px solid var(--line-subtle)',
                    fontSize: 'var(--t-sm)',
                  }}
                >
                  <Link href={`/app/revenue?category=${encodeURIComponent(c.category_name_en)}`} style={{ color: 'var(--accent)' }}>
                    {c.category_name_en}
                  </Link>
                  <span className="rq-mono" style={{ color: 'var(--text-hi)' }}>
                    {fmtBRL(c.gross_revenue)}
                  </span>
                </div>
              ))}
              {topCategories.length === 0 && (
                <span style={{ fontSize: 'var(--t-sm)', color: 'var(--text-lo)' }}>No data for latest month.</span>
              )}
            </Panel>
          </div>

          <Recommendation takeaway="Hold health & beauty budget flat — 11.8% growth is a truncated-series watch, not a spend signal.">
            Health &amp; beauty leads current gross at{' '}
            <span className="rq-mono" style={{ color: 'var(--accent-hi)' }}>
              13.7%
            </span>{' '}
            of the mix (
            <span className="rq-mono" style={{ color: 'var(--accent-hi)' }}>
              {fmtBRL(topCategories[0]?.gross_revenue ?? 0)}
            </span>{' '}
            in {summary.latest_month}), but that month&apos;s{' '}
            <span className="rq-mono" style={{ color: 'var(--accent-hi)' }}>
              11.8%
            </span>{' '}
            category growth sits on a truncated series — so this is a{' '}
            <span className="rq-mono" style={{ color: 'var(--accent-hi)' }}>
              watch
            </span>
            , not a spend trigger. The defensible move: hold category budget flat and re-test allocation once a full
            post-2018-08 month closes, rather than chasing a partial-month spike.
          </Recommendation>

          <div style={{ marginTop: 'var(--s-6)' }}>
            <AskTheData />
          </div>
        </StaggerIn>
      </div>
    </>
  );
}
