'use client';

import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine } from 'recharts';
import { SellerRow } from '@/lib/api';
import { fmtBRL } from '@/lib/format';

const TIER_COLOR: Record<string, string> = {
  Elite: 'var(--viz-1)',
  Established: 'var(--viz-2)',
  Growing: 'var(--viz-4)',
  New: 'var(--viz-6)',
};
const TIERS = ['Elite', 'Established', 'Growing', 'New'];

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export default function SellersQuadrantScatter({ data }: { data: SellerRow[] }) {
  const withReview = data.filter((s) => s.avg_review_score != null);
  if (withReview.length === 0) {
    return <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>No seller data.</span>;
  }

  const medianRevenue = median(withReview.map((s) => s.total_gross_revenue));
  const medianReview = median(withReview.map((s) => s.avg_review_score));

  return (
    <ResponsiveContainer width="100%" height={390}>
      <ScatterChart margin={{ top: 8, right: 30, bottom: 30, left: 10 }}>
        <CartesianGrid stroke="var(--border)" />
        <XAxis
          type="number"
          dataKey="total_gross_revenue"
          name="Revenue"
          scale="log"
          domain={['auto', 'auto']}
          tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
          tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
          label={{ value: 'Total Revenue (log scale)', position: 'insideBottom', offset: -5, fill: 'var(--text-muted)', fontSize: 11 }}
        />
        <YAxis
          type="number"
          dataKey="avg_review_score"
          name="Avg review score"
          domain={[1, 5]}
          tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
          label={{ value: 'Avg Review Score', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 11 }}
        />
        <ReferenceLine x={medianRevenue} stroke="var(--border-strong)" strokeDasharray="3 3" />
        <ReferenceLine y={medianReview} stroke="var(--border-strong)" strokeDasharray="3 3" />
        <Tooltip
          cursor={{ stroke: 'var(--border-strong)' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const s = payload[0].payload as SellerRow;
            return (
              <div
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  padding: '10px 12px',
                  fontSize: 12,
                }}
              >
                <div style={{ color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>
                  {s.seller_city}, {s.seller_state}{' '}
                  <span className="mono" style={{ color: 'var(--text-dim)', fontWeight: 400 }}>
                    ({s.seller_id.slice(0, 8)}…)
                  </span>
                </div>
                <div className="mono" style={{ color: 'var(--text-muted)' }}>
                  {fmtBRL(s.total_gross_revenue)} revenue · {s.avg_review_score?.toFixed(2)} avg review
                </div>
                <div className="mono" style={{ color: 'var(--text-dim)' }}>
                  {s.seller_tier} tier · {s.late_delivery_rate_pct}% late rate
                </div>
              </div>
            );
          }}
        />
        <Legend
          verticalAlign="top"
          align="center"
          wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', paddingBottom: 12 }}
        />
        {TIERS.map((tier) => (
          <Scatter
            key={tier}
            name={tier}
            data={withReview.filter((s) => s.seller_tier === tier)}
            fill={TIER_COLOR[tier]}
            fillOpacity={0.75}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
