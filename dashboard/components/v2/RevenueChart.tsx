'use client';

import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea } from 'recharts';
import { fmtBRL } from '@/lib/format';

// Same launch-period window as the v1 chart — Olist's first few months
// (Sep 2016–Feb 2017) are real but tiny (some under 10 orders) before the
// business reaches its stable baseline in Mar 2017.
const LAUNCH_PERIOD_END = '2017-02';

export default function RevenueChart({ data }: { data: { order_month: string; revenue: number }[] }) {
  if (data.length === 0) {
    return (
      <span style={{ fontSize: 'var(--t-sm)', color: 'var(--text-lo)' }}>No revenue data.</span>
    );
  }

  const launchMonths = data.filter((d) => d.order_month <= LAUNCH_PERIOD_END);

  return (
    <div style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--line-subtle)" vertical={false} />
          <XAxis
            dataKey="order_month"
            tick={{ fill: 'var(--text-faint)', fontSize: 'var(--t-cap)', fontFamily: 'var(--font-mono)' }}
            axisLine={{ stroke: 'var(--line-subtle)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--text-faint)', fontSize: 'var(--t-cap)', fontFamily: 'var(--font-mono)' }}
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-inset)',
              border: '1px solid var(--line-strong)',
              borderRadius: 'var(--r-md)',
              fontSize: 'var(--t-sm)',
              fontFamily: 'var(--font-mono)',
            }}
            labelStyle={{ color: 'var(--text-mid)', fontFamily: 'var(--font-sans)' }}
            formatter={(v: number) => [fmtBRL(v), 'Revenue']}
          />
          {launchMonths.length > 0 && (
            <ReferenceArea
              x1={launchMonths[0].order_month}
              x2={launchMonths[launchMonths.length - 1].order_month}
              fill="var(--line-subtle)"
              fillOpacity={0.5}
              stroke="none"
              ifOverflow="extendDomain"
            />
          )}
          <Line type="monotone" dataKey="revenue" stroke="var(--accent)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
