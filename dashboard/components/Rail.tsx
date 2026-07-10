'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, TrendingUp, Layers, PieChart, Store, Truck, HelpCircle, GitBranch } from 'lucide-react';
import AboutModal from '@/components/AboutModal';

const PAGES = [
  { icon: LayoutDashboard, label: 'Exec Summary', href: '/app' },
  { icon: TrendingUp, label: 'Revenue', href: '/app/revenue' },
  { icon: Layers, label: 'Cohorts', href: '/app/cohorts' },
  { icon: PieChart, label: 'Segments', href: '/app/segments' },
  { icon: Store, label: 'Sellers', href: '/app/sellers' },
  { icon: Truck, label: 'Logistics', href: '/app/logistics' },
];

export default function Rail() {
  const pathname = usePathname();
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <nav
      style={{
        width: 'var(--rail-width)',
        flexShrink: 0,
        borderRight: '1px solid var(--border)',
        background: 'var(--surface)',
        padding: '24px 0',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div id="tour-rail-wordmark" style={{ padding: '0 20px 24px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: -0.01, fontFamily: 'var(--font-display)' }}>
          RetailIQ
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>Olist · Brazil</div>
      </div>

      <div id="tour-rail-nav">
        {PAGES.map((p) => {
          const active = pathname === p.href;
          const Icon = p.icon;
          return (
            <Link
              key={p.href}
              href={p.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 20px',
                background: active ? 'var(--surface-2)' : 'transparent',
                borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              <Icon size={16} strokeWidth={2} color={active ? 'var(--accent)' : 'var(--text-dim)'} />
              <span style={{ fontSize: 13, color: active ? 'var(--text)' : 'var(--text-muted)' }}>
                {p.label}
              </span>
            </Link>
          );
        })}
      </div>

      <div style={{ padding: '0 20px', marginTop: 8 }}>
        <Link
          href="/app/methodology"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 0',
            color: pathname === '/app/methodology' ? 'var(--accent)' : 'var(--text-dim)',
          }}
        >
          <GitBranch size={14} strokeWidth={2} />
          <span style={{ fontSize: 12 }}>Methodology</span>
        </Link>
      </div>

      <div style={{ marginTop: 'auto', padding: '20px' }}>
        <button
          id="tour-about-button"
          onClick={() => setAboutOpen(true)}
          aria-label="About this project"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-dim)',
            padding: 0,
            marginBottom: 10,
          }}
        >
          <HelpCircle size={14} strokeWidth={2} />
          <span style={{ fontSize: 12 }}>About this project</span>
        </button>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>samvgarcia.com</div>
      </div>

      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
    </nav>
  );
}
