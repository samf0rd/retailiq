'use client';

import { useCallback, useEffect, useState } from 'react';

export interface TourStep {
  target: string; // DOM id of the element to spotlight
  title?: string;
  body: string;
  placement?: 'top' | 'bottom';
}

const PAD = 8;
const TOOLTIP_WIDTH = 280;

/**
 * <Tour> (PRD §9.3) — replaces the old bespoke ProductTour.tsx. Same
 * spotlight technique (a `box-shadow: 0 0 0 9999px <dim>` cutout, measured
 * via getBoundingClientRect() against each step's real DOM element — no
 * SVG mask, no 4-div overlay needed), but config-driven: steps are plain
 * data (TourStep[]), not JSX, so retargeting the tour to new surfaces is a
 * data change, not a component rewrite. Self-contained token scope (wraps
 * its own render in .rq-v2, same pattern as <SqlDrawer>) so its motion
 * reads --dur-fast/--ease-out and respects prefers-reduced-motion even
 * though TourProvider mounts it outside any specific page's own .rq-v2
 * wrapper.
 *
 * If a step's target isn't found in the DOM, that step is skipped
 * automatically rather than showing a broken spotlight.
 */
export default function Tour({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const step = steps[stepIndex];

  const measure = useCallback(() => {
    if (!step) return;
    const el = document.getElementById(step.target);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  useEffect(() => {
    if (!step) return;
    const el = document.getElementById(step.target);
    if (!el) {
      if (stepIndex < steps.length - 1) {
        const t = setTimeout(() => setStepIndex((i) => i + 1), 0);
        return () => clearTimeout(t);
      }
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') back();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  function next() {
    if (stepIndex >= steps.length - 1) {
      onClose();
    } else {
      setStepIndex((i) => i + 1);
    }
  }

  function back() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  if (!step || !rect) return null;

  const highlightTop = rect.top - PAD;
  const highlightLeft = rect.left - PAD;
  const highlightWidth = rect.width + PAD * 2;
  const highlightHeight = rect.height + PAD * 2;

  const spaceBelow = window.innerHeight - (highlightTop + highlightHeight);
  const placeBelow = step.placement ? step.placement === 'bottom' : spaceBelow > 160;
  const tooltipTop = placeBelow ? highlightTop + highlightHeight + 12 : highlightTop - 12;
  const tooltipLeft = Math.min(Math.max(highlightLeft, 16), window.innerWidth - TOOLTIP_WIDTH - 16);

  return (
    <div className="rq-v2">
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'fixed', inset: 0, zIndex: 200, pointerEvents: 'auto', background: 'transparent' }}
      />
      <div
        style={{
          position: 'fixed',
          top: highlightTop,
          left: highlightLeft,
          width: highlightWidth,
          height: highlightHeight,
          borderRadius: 'var(--r-md)',
          border: '2px solid var(--accent)',
          boxShadow: '0 0 0 9999px rgba(5, 7, 10, 0.78)',
          pointerEvents: 'none',
          zIndex: 201,
          transition: `top var(--dur-base) var(--ease-out), left var(--dur-base) var(--ease-out), width var(--dur-base) var(--ease-out), height var(--dur-base) var(--ease-out)`,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Guided tour"
        style={{
          position: 'fixed',
          top: placeBelow ? tooltipTop : undefined,
          bottom: placeBelow ? undefined : window.innerHeight - tooltipTop,
          left: tooltipLeft,
          width: TOOLTIP_WIDTH,
          background: 'var(--bg-inset)',
          border: '1px solid var(--line-strong)',
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--shadow-pop)',
          padding: 'var(--s-4)',
          zIndex: 202,
        }}
      >
        {step.title && (
          <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text-hi)', fontWeight: 600, marginBottom: 'var(--s-1)' }}>
            {step.title}
          </div>
        )}
        <p style={{ fontSize: 'var(--t-sm)', color: 'var(--text-mid)', lineHeight: 'var(--lh-body)', marginBottom: 'var(--s-3)' }}>
          {step.body}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="rq-mono" style={{ fontSize: 'var(--t-cap)', color: 'var(--text-lo)' }}>
            {stepIndex + 1} of {steps.length}
          </span>
          <div style={{ display: 'flex', gap: 'var(--s-2)', alignItems: 'center' }}>
            <button onClick={onClose} style={linkButtonStyle}>
              Skip
            </button>
            {stepIndex > 0 && (
              <button onClick={back} style={linkButtonStyle}>
                Back
              </button>
            )}
            <button onClick={next} style={primaryButtonStyle}>
              {stepIndex >= steps.length - 1 ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const linkButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-lo)',
  fontSize: 12,
  cursor: 'pointer',
  padding: '4px 2px',
};

const primaryButtonStyle: React.CSSProperties = {
  background: 'var(--accent)',
  border: 'none',
  color: 'var(--accent-ink)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  padding: '5px 12px',
  borderRadius: 'var(--r-sm)',
};
