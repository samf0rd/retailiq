'use client';

import { useEffect, useState } from 'react';
import { Info, X } from 'lucide-react';
import { useTour } from '@/components/TourProvider';

const STORAGE_KEY = 'retailiq_intro_dismissed';

/**
 * A single slim line above the page title on Exec Summary — NOT a content
 * block. The real interface (KPIs, DecisionCard, charts) stays the first
 * thing a visitor actually sees; this just offers a way in for anyone who
 * wants the guided version, via the tour. Deep "about this project" copy
 * lives in the About modal (Rail → "About this project"), not here.
 *
 * Dismissing hides the banner entirely for the session (localStorage) —
 * there's no need to bring it back once dismissed, since the same content
 * is always one click away via the About modal.
 */
export default function IntroHero() {
  const [dismissed, setDismissed] = useState(false);
  const { startTour } = useTour();

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) === 'true') {
      setDismissed(true);
    }
  }, []);

  function dismiss() {
    setDismissed(true);
    window.localStorage.setItem(STORAGE_KEY, 'true');
  }

  if (dismissed) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '8px 14px',
        marginBottom: 16,
        background: 'var(--accent-wash)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-control)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <Info size={14} strokeWidth={2} color="var(--accent)" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          RetailIQ — decision-support analytics on real Olist marketplace data (2016–2018)
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <button
          onClick={startTour}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 12, padding: 0 }}
        >
          Take a 60-second tour →
        </button>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 2 }}
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
