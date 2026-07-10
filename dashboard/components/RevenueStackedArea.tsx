'use client';

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { RevenueRow } from '@/lib/api';
import { fmtBRL } from '@/lib/format';

// Fixed categorical order — never reassigned when the filtered category set
// changes, so a color always means the same category across renders.
const SERIES_COLORS = ['var(--viz-1)', 'var(--viz-2)', 'var(--viz-3)', 'var(--viz-4)', 'var(--viz-5)', 'var(--viz-6)'];
const OTHER_COLOR = 'var(--text-dim)';

export default function RevenueStackedArea({ data }: { data: RevenueRow[] }) {
  if (data.length === 0) {
    return <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>No revenue data.</span>;
  }

  // Rank categories by total revenue across the whole series (a stable
  // ranking "over time" — not re-picked per month, which would make the
  // top-6 set flicker between months).
  const totalsByCategory = new Map<string, number>();
  for (const r of data) {
    totalsByCategory.set(r.category_name_en, (totalsByCategory.get(r.category_name_en) ?? 0) + r.gross_revenue);
  }
  const top6 = [...totalsByCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name]) => name);
  const top6Set = new Set(top6);

  const months = [...new Set(data.map((r) => r.order_month))].sort();
  const chartData = months.map((month) => {
    const row: Record<string, string | number> = { order_month: month };
    let otherTotal = 0;
    for (const r of data.filter((d) => d.order_month === month)) {
      if (top6Set.has(r.category_name_en)) {
        row[r.category_name_en] = (row[r.category_name_en] as number | undefined ?? 0) + r.gross_revenue;
      } else {
        otherTotal += r.gross_revenue;
      }
    }
    row['Other'] = Math.round(otherTotal * 100) / 100;
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="order_month"
          tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
          axisLine={false}
          tickLine={false}
          width={64}
          tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
          }}
          labelStyle={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}
          formatter={(v: number) => fmtBRL(v)}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', paddingTop: 8 }}
        />
        {top6.map((cat, i) => (
          <Area
            key={cat}
            type="monotone"
            dataKey={cat}
            stackId="1"
            stroke={SERIES_COLORS[i]}
            strokeWidth={2}
            fill={SERIES_COLORS[i]}
            fillOpacity={0.5}
          />
        ))}
        <Area type="monotone" dataKey="Other" stackId="1" stroke={OTHER_COLOR} strokeWidth={2} fill={OTHER_COLOR} fillOpacity={0.25} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
