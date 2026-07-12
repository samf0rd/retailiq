'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import Panel from '@/components/Panel';
import WarehouseNotice from '@/components/WarehouseNotice';
import PropensityTierFilter from '@/components/PropensityTierFilter';
import SegmentsBubbleChart from '@/components/SegmentsBubbleChart';
import AnalystNote from '@/components/v2/AnalystNote';
import Recommendation from '@/components/v2/Recommendation';
import { fmtBRL } from '@/lib/format';
import {
  apiGet,
  ApiError,
  KmeansSegmentEconomics,
  RetentionTarget,
  RepeatPropensityRow,
  KmeansCustomerRow,
} from '@/lib/api';

interface SegMetrics {
  kmeans: { silhouette_score: number; k: number };
  alignment: { agreement_rate_pct: number };
}

const TIER_COLOR: Record<string, string> = {
  'Very High': 'var(--accent)',
  High: 'var(--info)',
  Medium: 'var(--text-muted)',
  Low: 'var(--text-dim)',
};

// Second-order rate (share of segment with order_count >= 2 in mart_rfm) isn't
// exposed by /api/segments/economics — verified directly against the
// warehouse (`ml.kmeans_segments` joined to `mart_rfm`) rather than left as a
// live join the frontend would have to perform. Same convention api/commentary.py's
// FALLBACK_FINDINGS uses for numbers checked once against the real data.
//
// Champions' 100% is definitional, not behavioral — verified against the
// warehouse: ml.kmeans_segments' Champions cluster has min(frequency) = 2
// (a hard floor, zero exceptions across all 2,846 members), and of the
// 2,876 customers platform-wide with frequency >= 2, 2,846 land in
// Champions — K-Means effectively rediscovered "placed a second order" as
// its own cluster boundary, since that's such a sparse, discriminating
// signal (98.4% of customers are frequency = 1). The copy below says this
// plainly rather than presenting it as an organic loyalty finding.
const SECOND_ORDER_RATE: Record<string, number> = {
  'Potential Loyalists': 1.2,
  Champions: 100,
};

function SegmentsPageContent() {
  const searchParams = useSearchParams();
  const tier = searchParams.get('tier') || undefined;
  const segment = searchParams.get('segment') || undefined;

  const [econ, setEcon] = useState<KmeansSegmentEconomics[]>([]);
  const [targets, setTargets] = useState<RetentionTarget[]>([]);
  const [metrics, setMetrics] = useState<SegMetrics | null>(null);
  const [propensityRows, setPropensityRows] = useState<RepeatPropensityRow[]>([]);
  const [segmentCustomers, setSegmentCustomers] = useState<KmeansCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      apiGet<KmeansSegmentEconomics[]>('/api/segments/economics'),
      apiGet<RetentionTarget[]>('/api/segments/retention-targets'),
      apiGet<SegMetrics>('/api/segments/metrics'),
      apiGet<RepeatPropensityRow[]>('/api/segments/propensity', { tier }),
      segment
        ? apiGet<KmeansCustomerRow[]>('/api/segments/kmeans', { segment, limit: 50 })
        : Promise.resolve([] as KmeansCustomerRow[]),
    ])
      .then(([econRes, targetsRes, metricsRes, propensityRes, segmentRes]) => {
        if (cancelled) return;
        setEcon(econRes);
        setTargets(targetsRes);
        setMetrics(metricsRes);
        setPropensityRows(propensityRes);
        setSegmentCustomers(segmentRes);
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
  }, [tier, segment]);

  if (loading) {
    return (
      <>
        <PageHeader eyebrow="SEGMENTS" title="Customer Segments" />
        <div className="rq-v2" style={{ color: 'var(--text-lo)', fontSize: 'var(--t-sm)' }}>
          Loading…
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader eyebrow="SEGMENTS" title="Customer Segments" />
        <WarehouseNotice error={error} />
      </>
    );
  }

  const sortedEcon = [...econ].sort((a, b) => b.avg_ltv - a.avg_ltv);
  const sortedTargets = [...targets].sort((a, b) => b.avg_propensity_pct - a.avg_propensity_pct);
  const sortedPropensity = [...propensityRows].sort((a, b) => b.repeat_propensity - a.repeat_propensity);

  const loyalists = econ.find((s) => s.kmeans_segment === 'Potential Loyalists');
  const champions = econ.find((s) => s.kmeans_segment === 'Champions');
  const loyalistsSecondOrderRate = SECOND_ORDER_RATE['Potential Loyalists'];
  const championsSecondOrderRate = SECOND_ORDER_RATE['Champions'];
  const winBackTargetCount = loyalists ? Math.round(loyalists.customer_count * 0.1) : null;
  const winBackOpportunity = loyalists && winBackTargetCount ? winBackTargetCount * loyalists.avg_ltv : null;

  return (
    <>
      <PageHeader
        eyebrow="SEGMENTS"
        title="Customer Segments"
        subtitle="K-Means clustering on RFM features (recency, frequency, monetary), run independently of the rule-based mart_rfm quintile labels. Where the two methods disagree, the data is telling you something the fixed buckets missed."
      />

      {loyalists && champions && (
        <div className="rq-v2" style={{ marginBottom: 20 }}>
          <AnalystNote
            figures={{
              count: loyalists.customer_count.toLocaleString(),
              pctCustomers: loyalists.pct_of_customers,
              pctRevenue: loyalists.pct_of_revenue,
              ltv: fmtBRL(loyalists.avg_ltv),
              loyalistsRate: loyalistsSecondOrderRate,
              championsLtv: fmtBRL(champions.avg_ltv),
              championsRate: championsSecondOrderRate,
            }}
          >
            {(f) => (
              <>
                Potential Loyalists (
                <span className="rq-mono" style={{ color: 'var(--text-hi)' }}>
                  {f.count}
                </span>{' '}
                customers, {f.pctCustomers}% of the base) carry the highest average LTV of any segment at{' '}
                <span className="rq-mono" style={{ color: 'var(--text-hi)' }}>
                  {f.ltv}
                </span>{' '}
                and account for {f.pctRevenue}% of total revenue — but only{' '}
                <span className="rq-mono" style={{ color: 'var(--text-hi)' }}>
                  {f.loyalistsRate}%
                </span>{' '}
                have placed a second order. Champions sit at{' '}
                <span className="rq-mono" style={{ color: 'var(--text-hi)' }}>
                  {f.championsRate}%
                </span>{' '}
                ({f.championsLtv} avg LTV) — by definition, not by behavior: K-Means&apos; Champions cluster is
                bounded at frequency ≥ 2 orders (every member qualifies by having a second order at all), so a 100%
                rate there restates the cluster&apos;s own boundary rather than an organic finding.
              </>
            )}
          </AnalystNote>
          <Recommendation
            takeaway={
              winBackTargetCount && winBackOpportunity
                ? `Win back ${winBackTargetCount} Potential Loyalists → ~R$${Math.round(winBackOpportunity / 1000)}K opportunity.`
                : 'Win back a slice of Potential Loyalists — see incremental revenue below.'
            }
          >
            Potential Loyalists&apos; {fmtBRL(loyalists.avg_ltv)} avg LTV comes almost entirely from a single large
            order — a{' '}
            <span className="rq-mono" style={{ color: 'var(--accent-hi)' }}>
              {loyalistsSecondOrderRate}%
            </span>{' '}
            second-order rate, against Champions&apos; definitional{' '}
            <span className="rq-mono" style={{ color: 'var(--accent-hi)' }}>
              {championsSecondOrderRate}%
            </span>{' '}
            (that cluster requires 2+ orders to qualify, so its rate isn&apos;t a target to replicate — it&apos;s the
            cluster boundary). Converting just 10% of this segment (≈
            <span className="rq-mono" style={{ color: 'var(--accent-hi)' }}>
              {winBackTargetCount}
            </span>{' '}
            customers) to a second order at their own average order value is worth ≈
            <span className="rq-mono" style={{ color: 'var(--accent-hi)' }}>
              {winBackOpportunity ? fmtBRL(winBackOpportunity) : '—'}
            </span>{' '}
            in incremental revenue — a targeted win-back on this{' '}
            <span className="rq-mono" style={{ color: 'var(--accent-hi)' }}>
              {loyalists.customer_count.toLocaleString()}
            </span>
            -customer segment, not a blanket retention program across the full customer base.
          </Recommendation>
        </div>
      )}

      <Panel title="Segments by Recency × Frequency — bubble size = total revenue" style={{ marginBottom: 16 }}>
        <SegmentsBubbleChart data={econ} />
      </Panel>

      {metrics && (
        <Panel title="Method Comparison" style={{ marginBottom: 16, borderColor: 'var(--border-strong)' }}>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 500 }}>
                K chosen (elbow + silhouette)
              </div>
              <div className="mono" style={{ fontSize: 20, marginTop: 4 }}>
                k = {metrics.kmeans.k}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 500 }}>
                Silhouette score
              </div>
              <div className="mono" style={{ fontSize: 20, marginTop: 4 }}>
                {metrics.kmeans.silhouette_score}
                <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 6 }}>(&gt;0.3 = reasonable)</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 500 }}>
                RFM ↔ K-Means agreement
              </div>
              <div className="mono" style={{ fontSize: 20, marginTop: 4, color: 'var(--negative)' }}>
                {metrics.alignment.agreement_rate_pct}%
              </div>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, maxWidth: 720, lineHeight: 1.6 }}>
            Low agreement means the rule-based RFM quintiles and the data-driven clusters are finding
            different structure. Below, the K-Means segment economics show why: a small cluster the rules
            wouldn&apos;t isolate carries a disproportionate share of revenue.
          </p>
        </Panel>
      )}

      <Panel title="Segment Economics (K-Means clusters, sorted by LTV) — click a segment for a customer sample">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-strong)' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Segment</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Customers</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>% of Base</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Avg LTV</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>% of Revenue</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Avg Recency</th>
            </tr>
          </thead>
          <tbody>
            {sortedEcon.map((s) => {
              // Flag disproportionate segments: small share of customers, outsized share of revenue
              const skew = s.pct_of_revenue - s.pct_of_customers;
              return (
                <tr key={s.kmeans_segment} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <Link
                      href={`/app/segments?segment=${encodeURIComponent(s.kmeans_segment)}${tier ? `&tier=${encodeURIComponent(tier)}` : ''}`}
                      style={{
                        color: segment === s.kmeans_segment ? 'var(--accent)' : 'var(--info)',
                        textDecoration: 'underline dotted',
                      }}
                    >
                      {s.kmeans_segment}
                    </Link>
                  </td>
                  <td className="mono" style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                    {s.customer_count.toLocaleString()}
                  </td>
                  <td className="mono" style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                    {s.pct_of_customers}%
                  </td>
                  <td className="mono" style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtBRL(s.avg_ltv)}</td>
                  <td
                    className="mono"
                    style={{
                      padding: '8px 12px',
                      textAlign: 'right',
                      color: skew > 5 ? 'var(--accent)' : 'var(--text-muted)',
                    }}
                  >
                    {s.pct_of_revenue}%
                  </td>
                  <td className="mono" style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-dim)' }}>
                    {s.avg_recency_days.toFixed(0)}d
                  </td>
                </tr>
              );
            })}
            {sortedEcon.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 16, color: 'var(--text-dim)', textAlign: 'center' }}>
                  No segment data. Run <code>python ml/segmentation.py</code>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>

      {segment && (
        <>
          <div style={{ height: 16 }} />
          <Panel title={`Sample Customers — ${segment} (up to 50)`}>
            <div style={{ marginBottom: 10 }}>
              <Link href="/app/segments" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                Clear drill-down
              </Link>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-strong)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Customer</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Recency (days)</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Frequency</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Monetary Value</th>
                </tr>
              </thead>
              <tbody>
                {segmentCustomers.map((c) => (
                  <tr key={c.customer_unique_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="mono" style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{c.customer_unique_id.slice(0, 12)}…</td>
                    <td className="mono" style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-dim)' }}>{c.recency_days}</td>
                    <td className="mono" style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>{c.frequency}</td>
                    <td className="mono" style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtBRL(c.monetary_value)}</td>
                  </tr>
                ))}
                {segmentCustomers.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: 16, color: 'var(--text-dim)', textAlign: 'center' }}>
                      No customers found for this segment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Panel>
        </>
      )}

      <div style={{ height: 16 }} />

      <Panel title="Retention Targeting (repeat-purchase propensity tiers)">
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, maxWidth: 720, lineHeight: 1.6 }}>
          Scored at the moment of first purchase — features are first-order-only, so this reflects what&apos;s
          knowable before a second order exists. Use this to decide which tier a win-back campaign budget
          should target.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-strong)' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Tier</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Customers</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Avg Propensity</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Avg 1st Order Value</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Already Repeated</th>
            </tr>
          </thead>
          <tbody>
            {sortedTargets.map((t) => (
              <tr key={t.propensity_tier} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 12px', color: TIER_COLOR[t.propensity_tier] ?? 'var(--text-muted)' }}>
                  {t.propensity_tier}
                </td>
                <td className="mono" style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                  {t.customer_count.toLocaleString()}
                </td>
                <td className="mono" style={{ padding: '8px 12px', textAlign: 'right' }}>{t.avg_propensity_pct}%</td>
                <td className="mono" style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                  {t.avg_first_order_value != null ? fmtBRL(t.avg_first_order_value) : '—'}
                </td>
                <td className="mono" style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-dim)' }}>
                  {t.already_repeated}
                </td>
              </tr>
            ))}
            {sortedTargets.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 16, color: 'var(--text-dim)', textAlign: 'center' }}>
                  No retention target data. Run <code>python ml/propensity.py</code>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>

      <div style={{ height: 16 }} />

      <Panel title="Individual Customer Propensity (raw scores, filterable by tier)">
        <PropensityTierFilter />
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-strong)' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Customer</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Tier</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Propensity</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Already Repeated</th>
            </tr>
          </thead>
          <tbody>
            {sortedPropensity.slice(0, 50).map((p) => (
              <tr key={p.customer_unique_id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="mono" style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{p.customer_unique_id.slice(0, 12)}…</td>
                <td style={{ padding: '8px 12px', color: TIER_COLOR[p.propensity_tier] ?? 'var(--text-muted)' }}>
                  {p.propensity_tier}
                </td>
                <td className="mono" style={{ padding: '8px 12px', textAlign: 'right' }}>{(p.repeat_propensity * 100).toFixed(1)}%</td>
                <td className="mono" style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-dim)' }}>{p.is_repeat ? 'Yes' : 'No'}</td>
              </tr>
            ))}
            {sortedPropensity.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 16, color: 'var(--text-dim)', textAlign: 'center' }}>
                  No propensity data for this tier.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

export default function SegmentsPage() {
  return (
    <Suspense fallback={<PageHeader eyebrow="SEGMENTS" title="Customer Segments" />}>
      <SegmentsPageContent />
    </Suspense>
  );
}
