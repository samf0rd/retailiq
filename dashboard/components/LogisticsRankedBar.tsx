'use client';

import { Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LabelList } from 'recharts';
import { LogisticsRow } from '@/lib/api';
import { MIN_SAMPLE_ORDERS, hasSufficientSample } from '@/lib/logistics';

// Status color job (not identity) — late-delivery rate is a severity
// threshold, the same good/warning/critical scale Rate.tsx already uses
// (warnAt=10, badAt=20) for this exact metric everywhere else in the app.
function severityColor(pct: number) {
  if (pct >= 20) return 'var(--negative)';
  if (pct >= 10) return 'var(--warning)';
  return 'var(--positive)';
}

// PRD §8.4: a state's "0.0% late" reading is meaningless on a handful of
// delivered orders (e.g. AP: 2 delivered, 0.0% late) — it looks identical
// to genuine perfect performance on a real sample. States below the shared
// sample-size floor are suppressed from the ranked comparison and rendered
// separately as "insufficient sample," never colored/ranked alongside
// states with an actual statistically meaningful reading.
export default function LogisticsRankedBar({ data }: { data: LogisticsRow[] }) {
  if (data.length === 0) {
    return <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>No logistics data.</span>;
  }

  const ranked = data.filter((r) => hasSufficientSample(r.delivered_orders));
  const suppressed = data.filter((r) => !hasSufficientSample(r.delivered_orders));
  const sorted = [...ranked].sort((a, b) => b.late_rate_pct - a.late_rate_pct);
  const height = Math.max(240, sorted.length * 22);

  return (
    <div>
      {sorted.length > 0 ? (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
            <CartesianGrid stroke="var(--border)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="customer_state"
              tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={false}
              width={36}
            />
            <Tooltip
              cursor={{ fill: 'var(--surface-2)' }}
              contentStyle={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
              }}
              labelStyle={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}
              formatter={(v: number, _name, item) => [`${v}% (n=${item.payload.delivered_orders})`, 'Late rate']}
            />
            <Bar dataKey="late_rate_pct" radius={[0, 4, 4, 0]} maxBarSize={16}>
              {sorted.map((r) => (
                <Cell key={r.customer_state} fill={severityColor(r.late_rate_pct)} />
              ))}
              <LabelList
                dataKey="late_rate_pct"
                position="right"
                formatter={(v: number) => `${v.toFixed(1)}%`}
                style={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>No state has a sufficient sample this period.</span>
      )}

      {suppressed.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--border)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--warning)', marginTop: 4, flexShrink: 0 }} />
            <span>
              Insufficient sample (below {MIN_SAMPLE_ORDERS} delivered orders) — excluded from the ranking above; a
              &quot;0.0% late&quot; reading here is as likely a small-n artifact as real performance.
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
            {[...suppressed]
              .sort((a, b) => (b.delivered_orders ?? 0) - (a.delivered_orders ?? 0))
              .map((r) => (
                <span key={r.customer_state} className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  {r.customer_state} <span style={{ opacity: 0.7 }}>(n={r.delivered_orders ?? 0}, {r.late_rate_pct.toFixed(1)}%)</span>
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
