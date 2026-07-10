'use client';

import { useEffect, useState, type ReactNode, type CSSProperties } from 'react';
import { fmtBRL } from '@/lib/format';

/**
 * v2 motion primitives (PRD §5.7). Both are one-shot — StaggerIn runs once
 * per mount (route change remounts it, matching "runs once per route
 * mount"); CountUp animates 0→target once and stays there. Neither loops —
 * per §9.4, looping motion reads as "AI-generated toy," one-shot reads as
 * "engineered."
 */

export function StaggerIn({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div className="rq-stagger" style={style}>
      {children}
    </div>
  );
}

function useCountUp(target: number, durationMs = 900) {
  const [value, setValue] = useState(0);

  // No "already started" ref guard here — a prior version had one, and it
  // broke this exact animation under React 18 Strict Mode's dev-only
  // double-invoke of effects: (1) first invocation starts the rAF loop,
  // (2) Strict Mode immediately fires the cleanup, cancelling that rAF
  // before it ever paints a frame, (3) Strict Mode's simulated remount
  // re-runs the effect, but the ref (which survives the simulated
  // unmount/remount, since the component never actually unmounts) was
  // already true, so the guard returned early and no new rAF loop ever
  // started — value stayed at its initial 0 forever. The effect's own
  // dependency array already prevents unwanted restarts on unrelated
  // re-renders, so the guard was redundant even for its intended purpose.
  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setValue(target);
      return;
    }

    let raf: number;
    let start: number | null = null;
    function step(ts: number) {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - p, 3); // cubic ease-out, matches --ease-out's decelerate feel
      setValue(target * eased);
      if (p < 1) {
        raf = requestAnimationFrame(step);
      } else {
        setValue(target);
      }
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return value;
}

// `format` is a serializable token, not a function — a Server Component
// parent (Exec Summary is one) cannot pass a closure as a prop into a
// Client Component (this one) across the RSC boundary; only plain
// JSON-serializable values (strings, numbers) can cross it. Add a case here
// rather than widening this back to a function prop.
const FORMATTERS: Record<'brl' | 'int', (n: number) => string> = {
  brl: (n) => fmtBRL(n),
  int: (n) => Math.round(n).toLocaleString('en-US'),
};

export function CountUp({
  target,
  format,
  durationMs = 900,
}: {
  target: number;
  format: 'brl' | 'int';
  durationMs?: number;
}) {
  const value = useCountUp(target, durationMs);
  return <>{FORMATTERS[format](value)}</>;
}
