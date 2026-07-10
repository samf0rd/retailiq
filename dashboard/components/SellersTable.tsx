'use client';

import { Fragment, useState } from 'react';
import Rate from '@/components/Rate';
import { SellerRow } from '@/lib/api';
import { fmtBRL } from '@/lib/format';

const TIER_COLOR: Record<string, string> = {
  Elite: 'var(--accent)',
  Established: 'var(--info)',
  Growing: 'var(--text-muted)',
  New: 'var(--text-dim)',
};

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 500 }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: 13, marginTop: 2 }}>
        {children}
      </div>
    </div>
  );
}

// Row expand/collapse is a transient UI disclosure, not a filtered view — it
// doesn't need to be shareable, so it stays local component state rather
// than a URL search param (unlike the tier filter above it).
export default function SellersTable({ rows }: { rows: SellerRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border-strong)' }}>
          <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Rank</th>
          <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Seller</th>
          <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Tier</th>
          <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Revenue</th>
          <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Late Rate</th>
          <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Avg Review</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const isExpanded = expandedId === r.seller_id;
          return (
            <Fragment key={r.seller_id}>
              <tr
                onClick={() => setExpandedId(isExpanded ? null : r.seller_id)}
                style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--border)', cursor: 'pointer' }}
              >
                <td className="mono" style={{ padding: '8px 12px', color: 'var(--text-dim)' }}>{r.revenue_rank}</td>
                <td style={{ padding: '8px 12px' }}>
                  {/* City + state are the actionable identity per REDESIGN_SPEC.md §3.3;
                      the hashed ID stays mono, small, secondary. */}
                  <div style={{ color: 'var(--text)' }}>
                    {r.seller_city}, {r.seller_state}
                  </div>
                  <div className="mono" style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 1 }}>
                    {r.seller_id.slice(0, 10)}…
                  </div>
                </td>
                <td style={{ padding: '8px 12px', color: TIER_COLOR[r.seller_tier] ?? 'var(--text-muted)' }}>{r.seller_tier}</td>
                <td className="mono" style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtBRL(r.total_gross_revenue)}</td>
                <td className="mono" style={{ padding: '8px 12px', textAlign: 'right' }}>
                  <Rate value={r.late_delivery_rate_pct} warnAt={10} badAt={20} />
                </td>
                <td className="mono" style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                  {r.avg_review_score?.toFixed(2) ?? '—'}
                </td>
              </tr>
              {isExpanded && (
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td colSpan={6} style={{ padding: '4px 12px 14px', background: 'var(--surface-2)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, padding: '10px 12px' }}>
                      <DetailField label="Avg Delivery Days">{r.avg_delivery_days?.toFixed(1) ?? '—'}d</DetailField>
                      <DetailField label="Cancellation Rate">
                        <Rate value={r.cancellation_rate_pct} warnAt={5} badAt={10} />
                      </DetailField>
                      <DetailField label="Categories Sold">{r.categories_sold}</DetailField>
                      <DetailField label="Total Items">{r.total_items.toLocaleString()}</DetailField>
                      <DetailField label="Revenue Percentile">{r.revenue_percentile}%</DetailField>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
        {rows.length === 0 && (
          <tr>
            <td colSpan={6} style={{ padding: 16, color: 'var(--text-dim)', textAlign: 'center' }}>
              No seller data.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
