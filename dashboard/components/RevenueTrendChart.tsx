'use client';

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceArea } from 'recharts';
import { fmtBRL } from '@/lib/format';

// Olist's first few months as a marketplace (Sep 2016–Feb 2017) have real but
// tiny order volumes — some months under 10 orders — before the business
// reaches its stable ~2,600+/month baseline in Mar 2017. That data is real
// and stays in the chart (no "real numbers only" violation), but shown at
// the same visual weight as the baseline it reads as volatility rather than
// what it actually is: a small sample size during the company's launch.
const LAUNCH_PERIOD_END = '2017-02';

export default function RevenueTrendChart({ data }: { data: { order_month: string; revenue: number }[] }) {
  if (data.length === 0) {
    return <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>No revenue data.</span>;
  }

  const launchMonths = data.filter((d) => d.order_month <= LAUNCH_PERIOD_END);
  const hasLaunchPeriod = launchMonths.length > 0;

  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
            width={70}
            tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border-strong)',
              borderRadius: 3,
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
            }}
            labelStyle={{ color: 'var(--text-muted)' }}
            formatter={(v: number) => [fmtBRL(v), 'Revenue']}
          />
          {hasLaunchPeriod && (
            <ReferenceArea
              x1={launchMonths[0].order_month}
              x2={launchMonths[launchMonths.length - 1].order_month}
              fill="var(--border-strong)"
              fillOpacity={0.35}
              stroke="none"
              ifOverflow="extendDomain"
            />
          )}
          <Line type="monotone" dataKey="revenue" stroke="var(--accent)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
      {hasLaunchPeriod && (
        <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8, textAlign: 'center' }}>
          Sep 2016–Feb 2017: launch period, small sample size (some months under 10 orders) — trend becomes stable
          from Mar 2017.
        </p>
      )}
    </div>
  );
}
