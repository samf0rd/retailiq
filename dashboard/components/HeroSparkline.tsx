'use client';

import { useEffect, useRef } from 'react';

/**
 * The landing hero's "live, tiny animated proof" (PRD §9.1) — a real
 * revenue sparkline (same monthly series Exec Summary's chart uses, passed
 * in from the server component that fetched it), drawing itself in once on
 * load via stroke-dashoffset. One-shot, never loops (§9.4) — respects
 * prefers-reduced-motion by skipping straight to the fully-drawn state.
 */
export default function HeroSparkline({ data }: { data: { order_month: string; revenue: number }[] }) {
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const len = path.getTotalLength();
    if (reduce) {
      path.style.strokeDasharray = 'none';
      path.style.strokeDashoffset = '0';
      return;
    }
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = String(len);
    path.getBoundingClientRect(); // force layout before the transition starts
    path.style.transition = 'stroke-dashoffset var(--dur-hero) var(--ease-out)';
    requestAnimationFrame(() => {
      path.style.strokeDashoffset = '0';
    });
  }, [data]);

  if (data.length < 2) return null;

  const width = 320;
  const height = 72;
  const values = data.map((d) => d.revenue);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d.revenue - min) / range) * height;
    return `${x},${y}`;
  });
  const d = `M ${points.join(' L ')}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} preserveAspectRatio="none" aria-hidden="true">
      <path ref={pathRef} d={d} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
