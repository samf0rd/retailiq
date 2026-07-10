'use client';

import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell } from 'recharts';
import { KmeansSegmentEconomics } from '@/lib/api';
import { fmtBRL } from '@/lib/format';
import { SEGMENT_COLOR } from '@/lib/segments';

export default function SegmentsBubbleChart({ data }: { data: KmeansSegmentEconomics[] }) {
  if (data.length === 0) {
    return <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>No segment data.</span>;
  }

  return (
    <ResponsiveContainer width="100%" height={370}>
      <ScatterChart margin={{ top: 8, right: 30, bottom: 30, left: 10 }}>
        <CartesianGrid stroke="var(--border)" />
        <XAxis
          type="number"
          dataKey="avg_recency_days"
          name="Avg recency"
          unit=" days"
          tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
          label={{ value: 'Avg Recency (days since last order)', position: 'insideBottom', offset: -5, fill: 'var(--text-muted)', fontSize: 11 }}
        />
        <YAxis
          type="number"
          dataKey="avg_orders"
          name="Avg orders"
          tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
          label={{ value: 'Avg Orders (frequency)', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 11 }}
        />
        <ZAxis type="number" dataKey="total_revenue" range={[400, 4000]} name="Total revenue" />
        <Tooltip
          cursor={{ stroke: 'var(--border-strong)' }}
          contentStyle={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            fontSize: 12,
          }}
          labelStyle={{ color: 'var(--text-muted)' }}
          formatter={(value: number, name: string) => {
            if (name === 'Total revenue') return [fmtBRL(value), 'Total revenue'];
            if (name === 'Avg recency') return [`${value.toFixed(0)}d`, 'Avg recency'];
            return [value.toFixed(2), name];
          }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as KmeansSegmentEconomics;
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
                <div style={{ color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>{p.kmeans_segment}</div>
                <div className="mono" style={{ color: 'var(--text-muted)' }}>
                  {p.pct_of_customers}% of customers · {p.pct_of_revenue}% of revenue
                </div>
                <div className="mono" style={{ color: 'var(--text-muted)' }}>
                  {fmtBRL(p.total_revenue)} total · {fmtBRL(p.avg_ltv)} avg LTV
                </div>
                <div className="mono" style={{ color: 'var(--text-dim)' }}>
                  recency {p.avg_recency_days.toFixed(0)}d · {p.avg_orders.toFixed(2)} orders/customer
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
        {data.map((s) => (
          <Scatter key={s.kmeans_segment} name={s.kmeans_segment} data={[s]} fill={SEGMENT_COLOR[s.kmeans_segment] ?? 'var(--viz-3)'}>
            <Cell fill={SEGMENT_COLOR[s.kmeans_segment] ?? 'var(--viz-3)'} />
          </Scatter>
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
