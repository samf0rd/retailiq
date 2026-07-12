'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import Panel from '@/components/Panel';
import Rate from '@/components/Rate';
import WarehouseNotice from '@/components/WarehouseNotice';
import LogisticsFilters from '@/components/LogisticsFilters';
import LogisticsRankedBar from '@/components/LogisticsRankedBar';
import AnalystNote from '@/components/v2/AnalystNote';
import Recommendation from '@/components/v2/Recommendation';
import Caveat from '@/components/v2/Caveat';
import { apiGet, ApiError, LogisticsRow } from '@/lib/api';
import { hasSufficientSample, correlationStrength, MIN_SAMPLE_ORDERS } from '@/lib/logistics';
import { getCaveats } from '@/ai/caveats';

function LogisticsPageContent() {
  const searchParams = useSearchParams();
  const state = searchParams.get('state') || undefined;
  const isDrillDown = Boolean(state);

  const [rows, setRows] = useState<LogisticsRow[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      apiGet<LogisticsRow[]>('/api/logistics', { state }),
      apiGet<{ customer_state: string }[]>('/api/meta/states'),
    ])
      .then(([logisticsRows, stateRows]) => {
        if (cancelled) return;
        setRows(logisticsRows);
        setStates(stateRows.map((s) => s.customer_state));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Unknown error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [state]);

  if (loading) {
    return (
      <>
        <PageHeader eyebrow="LOGISTICS" title="Logistics & Ops" />
        <div className="rq-v2" style={{ color: 'var(--text-lo)', fontSize: 'var(--t-sm)' }}>
          Loading…
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader eyebrow="LOGISTICS" title="Logistics & Ops" />
        <WarehouseNotice error={error} />
      </>
    );
  }

  let tableRows: LogisticsRow[];
  let panelTitle: string;
  let subtitle: string;

  if (isDrillDown) {
    // Real backend-filtered call already returns full month-by-month history
    // for this one state — just order it chronologically.
    tableRows = [...rows].sort((a, b) => a.order_month.localeCompare(b.order_month));
    panelTitle = `${state} — Monthly Trend`;
    subtitle = `Delivery performance for ${state} across all months on record. Correlation column: delivery delta vs review score (negative = later delivery, lower reviews).`;
  } else {
    // Default: latest month per state.
    tableRows = Object.values(
      rows.reduce<Record<string, LogisticsRow>>((acc, r) => {
        if (!acc[r.customer_state] || r.order_month > acc[r.customer_state].order_month) {
          acc[r.customer_state] = r;
        }
        return acc;
      }, {})
    ).sort((a, b) => b.late_rate_pct - a.late_rate_pct);
    panelTitle = 'Delivery Performance by State';
    subtitle = 'Delivery performance by state, latest month on record. Correlation column: delivery delta vs review score (negative = later delivery, lower reviews).';
  }

  // Grounding for the AnalystNote below: the state with the strongest
  // (most negative) correlation among states with a sufficient sample,
  // in the latest month on record — computed live from the same `rows`
  // the table renders, never hardcoded, so this stays correct if the
  // warehouse is rebuilt.
  const latestMonthAll = rows.reduce((max, r) => (r.order_month > max ? r.order_month : max), '');
  const latestSufficient = rows.filter(
    (r) => r.order_month === latestMonthAll && hasSufficientSample(r.delivered_orders) && r.delivery_review_correlation !== null
  );
  const worstCorrState =
    latestSufficient.length > 0
      ? latestSufficient.reduce((worst, r) => (r.delivery_review_correlation! < worst.delivery_review_correlation! ? r : worst))
      : null;
  const worstStrength = worstCorrState ? correlationStrength(worstCorrState.delivery_review_correlation!) : null;
  const worstCaveats = worstCorrState
    ? getCaveats({ period: latestMonthAll, sampleSize: worstCorrState.delivered_orders, correlation: worstCorrState.delivery_review_correlation! })
    : [];

  return (
    <>
      <PageHeader eyebrow="LOGISTICS" title="Logistics & Ops" subtitle={subtitle} />

      {!isDrillDown && worstCorrState && (
        <div className="rq-v2" style={{ marginBottom: 20 }}>
          <AnalystNote
            figures={{
              state: worstCorrState.customer_state,
              month: latestMonthAll,
              r: worstCorrState.delivery_review_correlation!.toFixed(3),
              n: worstCorrState.delivered_orders,
              strength: worstStrength,
            }}
            caveat={worstCaveats.map((c) => c.text).join(' ')}
          >
            {(f) => (
              <>
                <span className="rq-mono" style={{ color: 'var(--text-hi)' }}>
                  {f.state}
                </span>{' '}
                shows the strongest delivery-delay-to-review-score correlation of any state with a sufficient sample
                in <span className="rq-mono" style={{ color: 'var(--text-hi)' }}>{f.month}</span>, at{' '}
                <span className="rq-mono" style={{ color: 'var(--text-hi)' }}>
                  r = {f.r}
                </span>{' '}
                (n={f.n}) — a <span className="rq-mono" style={{ color: 'var(--text-hi)' }}>{f.strength}</span>{' '}
                relationship.
              </>
            )}
          </AnalystNote>
          <Recommendation
            takeaway={
              worstStrength === 'weak'
                ? `Pilot an SLA test on ${worstCorrState.customer_state}'s ${worstCorrState.delivered_orders} orders — r is weak, not grounds for a full rollout.`
                : `Run an SLA intervention in ${worstCorrState.customer_state} — r=${worstCorrState.delivery_review_correlation!.toFixed(3)} (${worstStrength}) on ${worstCorrState.delivered_orders} orders.`
            }
          >
            {worstStrength === 'weak' ? (
              <>
                At r={worstCorrState.delivery_review_correlation!.toFixed(3)}, this is a real but modest signal — not
                grounds for a full logistics-investment case on its own. Worth an SLA test isolated to{' '}
                <span className="rq-mono" style={{ color: 'var(--accent-hi)' }}>
                  {worstCorrState.customer_state}
                </span>
                &apos;s <span className="rq-mono" style={{ color: 'var(--accent-hi)' }}>{worstCorrState.delivered_orders}</span>{' '}
                affected orders — small enough to pilot cheaply — before committing broader delivery-quality spend. A
                stronger correlation on more data would justify scaling the intervention statewide.
              </>
            ) : (
              <>
                At r={worstCorrState.delivery_review_correlation!.toFixed(3)} ({worstStrength}), late delivery in{' '}
                <span className="rq-mono" style={{ color: 'var(--accent-hi)' }}>
                  {worstCorrState.customer_state}
                </span>{' '}
                is a real driver of review score on{' '}
                <span className="rq-mono" style={{ color: 'var(--accent-hi)' }}>
                  {worstCorrState.delivered_orders}
                </span>{' '}
                delivered orders — an SLA intervention here is defensible on its own, not just as a pilot.
              </>
            )}
          </Recommendation>
        </div>
      )}

      {!isDrillDown && (
        <Panel title="Late-Delivery Rate by State — ranked" sqlModel="mart_logistics" style={{ marginBottom: 16 }}>
          <LogisticsRankedBar data={tableRows} />
        </Panel>
      )}

      <LogisticsFilters states={states} />

      <Panel title={panelTitle} sqlModel="mart_logistics">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-strong)' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>
                {isDrillDown ? 'Month' : 'State'}
              </th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>N (delivered)</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Avg Days</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Late Rate</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Avg Review</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Delta-Review Corr</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((r) => {
              const sufficient = hasSufficientSample(r.delivered_orders);
              const strength = correlationStrength(r.delivery_review_correlation);
              return (
                <tr
                  key={isDrillDown ? r.order_month : r.customer_state}
                  style={{ borderBottom: '1px solid var(--border)', opacity: sufficient ? 1 : 0.5 }}
                >
                  <td className="mono" style={{ padding: '8px 12px', color: 'var(--text)' }}>
                    {isDrillDown ? (
                      r.order_month
                    ) : (
                      <Link
                        href={`/app/logistics?state=${encodeURIComponent(r.customer_state)}`}
                        style={{ color: 'var(--info)', textDecoration: 'underline dotted' }}
                      >
                        {r.customer_state}
                      </Link>
                    )}
                  </td>
                  <td className="mono" style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-dim)' }}>
                    {r.delivered_orders ?? '—'}
                  </td>
                  <td className="mono" style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                    {r.avg_delivery_days?.toFixed(1) ?? '—'}d
                  </td>
                  <td className="mono" style={{ padding: '8px 12px', textAlign: 'right' }}>
                    {sufficient ? (
                      <Rate value={r.late_rate_pct} warnAt={10} badAt={20} />
                    ) : (
                      <span className="mono" style={{ color: 'var(--text-dim)' }}>
                        † {r.late_rate_pct.toFixed(1)}%
                      </span>
                    )}
                  </td>
                  <td className="mono" style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                    {r.avg_review_score?.toFixed(2) ?? '—'}
                  </td>
                  <td
                    className="mono"
                    style={{
                      padding: '8px 12px',
                      textAlign: 'right',
                      color: !sufficient || strength === 'weak' ? 'var(--text-dim)' : (r.delivery_review_correlation ?? 0) < 0 ? 'var(--negative)' : 'var(--text-muted)',
                    }}
                  >
                    {r.delivery_review_correlation != null ? (
                      <>
                        {r.delivery_review_correlation.toFixed(3)}
                        {strength && <span style={{ marginLeft: 4, fontSize: 10 }}>({strength})</span>}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
            {tableRows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 16, color: 'var(--text-dim)', textAlign: 'center' }}>
                  No logistics data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 10 }}>
          † Rows below {MIN_SAMPLE_ORDERS} delivered orders are dimmed — the late rate is shown but treated as
          low-confidence, not suppressed outright (this table is the full record; the ranked chart above excludes
          them). Correlation strength bands: weak |r|&lt;0.4, moderate 0.4–0.7, strong &gt;0.7 — a weak correlation
          is a real but modest signal, not grounds for a strong action on its own.
        </p>
      </Panel>
    </>
  );
}

export default function LogisticsPage() {
  return (
    <Suspense fallback={<PageHeader eyebrow="LOGISTICS" title="Logistics & Ops" />}>
      <LogisticsPageContent />
    </Suspense>
  );
}
