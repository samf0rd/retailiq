import type { ReactNode } from 'react';

/**
 * v2 Caveat (PRD §5.4) — a first-class citizen, not a footnote afterthought.
 * The auto-detection engine (§6.2, `ai/caveats.ts`) is R2 scope; this is
 * just the presentational primitive it will eventually drive. For R0 it's
 * hand-placed where a real caveat applies (the 2018-08 truncated tail).
 */
export default function Caveat({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--s-2)',
        alignItems: 'flex-start',
        marginTop: 'var(--s-3)',
        fontSize: 'var(--t-cap)',
        color: 'var(--text-lo)',
      }}
    >
      <span
        style={{
          width: 'var(--s-1)',
          height: 'var(--s-1)',
          borderRadius: '50%',
          background: 'var(--warn)',
          marginTop: 'var(--s-1)',
          flexShrink: 0,
        }}
      />
      <span>{children}</span>
    </div>
  );
}
