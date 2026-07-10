'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, X } from 'lucide-react';
import { LayoutDashboard, TrendingUp, Layers, PieChart, Store, Truck } from 'lucide-react';
import { useTour } from '@/components/TourProvider';

const PAGE_HOOKS = [
  { icon: LayoutDashboard, label: 'Exec Summary', href: '/app', hook: 'The 30-second version — headline revenue, growth, and where it’s really coming from.' },
  { icon: TrendingUp, label: 'Revenue', href: '/app/revenue', hook: 'Which categories drive the business, and how concentrated is that risk?' },
  { icon: Layers, label: 'Cohorts', href: '/app/cohorts', hook: 'When — if ever — do customers come back, and how short is the win-back window?' },
  { icon: PieChart, label: 'Segments', href: '/app/segments', hook: 'Which customers actually drive revenue, and where’s the upside?' },
  { icon: Store, label: 'Sellers', href: '/app/sellers', hook: 'Which sellers carry the platform, and which ones are a delivery-quality risk?' },
  { icon: Truck, label: 'Logistics', href: '/app/logistics', hook: 'Where does late delivery actually hurt customer satisfaction?' },
];

function AccordionSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '12px 0',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
        <ChevronDown
          size={15}
          strokeWidth={2}
          color="var(--text-dim)"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
        />
      </button>
      {open && <div style={{ paddingBottom: 16 }}>{children}</div>}
    </div>
  );
}

/**
 * Reachable from "About this project" in the Rail on every page — covers a
 * visitor landing directly on e.g. /logistics via a shared link, who'd
 * otherwise never see the Exec Summary intro banner or tour. Restructured
 * into an accordion (REDESIGN follow-up): "What is this?" opens by
 * default so a 3-second glance gets the gist; everything else is a click
 * away for someone who wants depth, instead of one dense wall of text.
 */
export default function AboutModal({ onClose }: { onClose: () => void }) {
  const { startTour } = useTour();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function replayTour() {
    onClose();
    startTour();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          background: 'var(--bg)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-card)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          padding: 32,
          maxWidth: 640,
          width: '100%',
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-dim)',
            padding: 4,
          }}
        >
          <X size={18} strokeWidth={2} />
        </button>

        <h2 style={{ fontSize: 20, color: 'var(--text)', marginBottom: 4 }}>RetailIQ</h2>
        <button
          onClick={replayTour}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 12, padding: 0, marginBottom: 8 }}
        >
          ↻ Replay the guided tour
        </button>

        <AccordionSection title="What is this?" defaultOpen>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Revenue, retention, segmentation, and logistics intelligence for a real e-commerce
            marketplace — built to show the kind of decision-support analysis a data/analytics
            team ships internally.
          </p>
        </AccordionSection>

        <AccordionSection title="About the data">
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            This dashboard runs on <strong style={{ color: 'var(--text)' }}>Olist</strong>, a real
            Brazilian e-commerce marketplace —{' '}
            <strong style={{ color: 'var(--text)' }}>98,699 valid orders</strong> across{' '}
            <strong style={{ color: 'var(--text)' }}>74 product categories</strong>, spanning{' '}
            <strong style={{ color: 'var(--text)' }}>2016–2018</strong>. This is real, anonymized
            commercial transaction data — not synthetic or generated.
          </p>
        </AccordionSection>

        <AccordionSection title="What you can explore">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {PAGE_HOOKS.map((p) => {
              const Icon = p.icon;
              return (
                <Link
                  key={p.href}
                  href={p.href}
                  onClick={onClose}
                  style={{
                    display: 'block',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-control)',
                    padding: '10px 12px',
                    background: 'var(--surface)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Icon size={14} strokeWidth={2} color="var(--accent)" />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{p.label}</span>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{p.hook}</p>
                </Link>
              );
            })}
          </div>
        </AccordionSection>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
          <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            Built by Samuel — <a href="https://samvgarcia.com" style={{ color: 'var(--accent)' }}>samvgarcia.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}
