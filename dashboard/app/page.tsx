'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, TrendingUp, Layers, PieChart, Store, Truck } from 'lucide-react';
import HeroSparkline from '@/components/HeroSparkline';
import { StaggerIn } from '@/components/v2/motion';
import { apiGet, RevenueRow } from '@/lib/api';

const AREAS = [
  { icon: LayoutDashboard, label: 'Exec Summary', href: '/app', hook: 'The 30-second version — headline revenue, growth, and where it’s really coming from.' },
  { icon: TrendingUp, label: 'Revenue', href: '/app/revenue', hook: 'Which categories drive the business, and how concentrated is that risk?' },
  { icon: Layers, label: 'Cohorts', href: '/app/cohorts', hook: 'When — if ever — do customers come back, and how short is the win-back window?' },
  { icon: PieChart, label: 'Segments', href: '/app/segments', hook: 'Which customers actually drive revenue, and where’s the upside?' },
  { icon: Store, label: 'Sellers', href: '/app/sellers', hook: 'Which sellers carry the platform, and which ones are a delivery-quality risk?' },
  { icon: Truck, label: 'Logistics', href: '/app/logistics', hook: 'Where does late delivery actually hurt customer satisfaction?' },
];

const CREDIBILITY_CHIPS = [
  'Real dataset · Olist, 2016–2018',
  'dbt-tested warehouse',
  'Code-built, no BI tool',
  'Live — not a screenshot',
];

/**
 * The public landing page (PRD §9.1) — "in 15 seconds a hiring manager
 * understands what this is and why it's credible." Not the dashboard: one
 * scroll, hero → credibility strip → 6-area grid → "Enter dashboard".
 * Green used exactly once here (the sparkline + the single CTA), per the
 * restraint rule (PRD §1).
 */
export default function LandingPage() {
  const [monthlyTotals, setMonthlyTotals] = useState<{ order_month: string; revenue: number }[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiGet<RevenueRow[]>('/api/revenue')
      .then((revenue) => {
        if (cancelled) return;
        const totals = Object.values(
          revenue.reduce<Record<string, { order_month: string; revenue: number }>>((acc, r) => {
            acc[r.order_month] = acc[r.order_month] ?? { order_month: r.order_month, revenue: 0 };
            acc[r.order_month].revenue += r.gross_revenue;
            return acc;
          }, {})
        ).sort((a, b) => a.order_month.localeCompare(b.order_month));
        setMonthlyTotals(totals);
      })
      .catch(() => {
        // Landing must never hard-fail just because the warehouse is cold —
        // the hero's sparkline is a nice-to-have proof, not the page's substance.
        if (!cancelled) setMonthlyTotals([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rq-v2" style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: 'var(--s-12) var(--s-6) var(--s-16)' }}>
        <StaggerIn>
          {/* ── Hero ─────────────────────────────────────────────────── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.3fr 1fr',
              gap: 'var(--s-8)',
              alignItems: 'center',
              marginBottom: 'var(--s-10)',
              minHeight: 260,
            }}
          >
            <div>
              <div className="rq-eyebrow" style={{ marginBottom: 'var(--s-3)' }}>
                RetailIQ · Olist, Brazil
              </div>
              <h1
                style={{
                  fontSize: 40,
                  color: 'var(--text-hi)',
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.15,
                  marginBottom: 'var(--s-4)',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Decision-support analytics on{' '}
                <span className="rq-mono" style={{ color: 'var(--accent)' }}>
                  98,699
                </span>{' '}
                real Olist orders.
              </h1>
              <p style={{ fontSize: 'var(--t-body)', color: 'var(--text-mid)', lineHeight: 'var(--lh-body)', maxWidth: 480, marginBottom: 'var(--s-6)' }}>
                A real business decision, backed by a real query. Every number here traces to a dbt model you can
                open and read — the AI describes what&apos;s on screen; the judgment is human, quantified, and
                tagged as such.
              </p>
              <Link
                href="/app"
                className="rq-mono"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--accent)',
                  color: 'var(--accent-ink)',
                  fontWeight: 600,
                  fontSize: 'var(--t-sm)',
                  padding: '10px 20px',
                  borderRadius: 'var(--r-md)',
                }}
              >
                Enter dashboard →
              </Link>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              {monthlyTotals.length > 1 ? (
                <div
                  style={{
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--line-subtle)',
                    borderRadius: 'var(--r-lg)',
                    padding: 'var(--s-5)',
                    boxShadow: 'var(--shadow-panel)',
                  }}
                >
                  <div className="rq-eyebrow" style={{ marginBottom: 'var(--s-2)' }}>
                    Monthly gross revenue
                  </div>
                  <HeroSparkline data={monthlyTotals} />
                </div>
              ) : (
                <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text-lo)' }}>Warehouse cold — proof unavailable right now.</div>
              )}
            </div>
          </div>

          {/* ── Credibility strip ───────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 'var(--s-3)', flexWrap: 'wrap', marginBottom: 'var(--s-10)' }}>
            {CREDIBILITY_CHIPS.map((c) => (
              <span
                key={c}
                className="rq-mono"
                style={{
                  fontSize: 'var(--t-cap)',
                  color: 'var(--text-lo)',
                  border: '1px solid var(--line-subtle)',
                  borderRadius: 'var(--r-sm)',
                  padding: '4px 10px',
                }}
              >
                {c}
              </span>
            ))}
          </div>

          {/* ── What you can explore ────────────────────────────────────── */}
          <div style={{ marginBottom: 'var(--s-10)' }}>
            <div className="rq-eyebrow" style={{ marginBottom: 'var(--s-4)' }}>
              What you can explore
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--s-4)' }}>
              {AREAS.map((a) => {
                const Icon = a.icon;
                return (
                  <Link
                    key={a.href}
                    href={a.href}
                    className="rq-panel"
                    style={{
                      display: 'block',
                      background: 'var(--bg-panel)',
                      border: '1px solid var(--line-subtle)',
                      borderRadius: 'var(--r-lg)',
                      padding: 'var(--s-5)',
                    }}
                  >
                    <Icon size={16} strokeWidth={2} color="var(--text-lo)" style={{ marginBottom: 'var(--s-3)' }} />
                    <div style={{ color: 'var(--text-hi)', fontWeight: 600, fontSize: 'var(--t-sm)', marginBottom: 'var(--s-1)' }}>{a.label}</div>
                    <p style={{ fontSize: 'var(--t-cap)', color: 'var(--text-mid)', lineHeight: 'var(--lh-body)' }}>{a.hook}</p>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* ── Footer ───────────────────────────────────────────────────── */}
          <div style={{ borderTop: '1px solid var(--line-subtle)', paddingTop: 'var(--s-5)' }}>
            <p style={{ fontSize: 'var(--t-sm)', color: 'var(--text-lo)' }}>
              Built by Samuel —{' '}
              <a href="https://samvgarcia.com" style={{ color: 'var(--accent)' }}>
                samvgarcia.com
              </a>
            </p>
          </div>
        </StaggerIn>
      </div>
    </div>
  );
}
