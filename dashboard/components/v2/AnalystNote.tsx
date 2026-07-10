import type { ReactNode } from 'react';
import Caveat from './Caveat';

type Figures = Record<string, string | number>;

/**
 * v2 AnalystNote (PRD §5.3) — replaces the old "Key Finding" card. AI
 * DESCRIBES, never decides (§6.1): this component only ever renders prose
 * built from a `figures` object passed in by the caller, never free text
 * with numbers baked in by an LLM. Every key in `figures` must be present
 * (not null/undefined) or this throws in dev — an ungrounded number simply
 * cannot ship, by construction, not by discipline.
 *
 * Visual: NOT the old big glowing green card — a quiet inset, small "AI"
 * chip (grey, not accent-colored), sits below the numbers it describes.
 */
export default function AnalystNote({
  figures,
  children,
  caveat,
}: {
  figures: Record<string, string | number | null | undefined>;
  children: (f: Figures) => ReactNode;
  caveat?: ReactNode;
}) {
  if (process.env.NODE_ENV !== 'production') {
    for (const [key, val] of Object.entries(figures)) {
      if (val === null || val === undefined) {
        throw new Error(
          `AnalystNote: figure "${key}" is missing — ungrounded copy cannot ship. Check the mart query that feeds this page.`
        );
      }
    }
  }

  return (
    <div
      style={{
        background: 'var(--bg-inset)',
        border: '1px solid var(--line-subtle)',
        borderLeft: '2px solid var(--line-accent)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--s-4) var(--s-5)',
        marginTop: 'var(--s-4)',
        position: 'relative',
      }}
    >
      <span
        className="rq-mono"
        style={{
          position: 'absolute',
          top: 'var(--s-3)',
          right: 'var(--s-4)',
          fontSize: 'var(--t-cap)',
          color: 'var(--text-lo)',
          border: '1px solid var(--line-subtle)',
          borderRadius: 'var(--r-sm)',
          padding: '1px 5px',
        }}
      >
        AI
      </span>
      <p style={{ color: 'var(--text-mid)', fontSize: 'var(--t-sm)', maxWidth: '70ch', paddingRight: 'var(--s-8)' }}>
        {children(figures as Figures)}
      </p>
      {caveat && <Caveat>{caveat}</Caveat>}
    </div>
  );
}
