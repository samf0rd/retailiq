import type { ReactNode } from 'react';

/**
 * v2 Recommendation (PRD §6.3, two-tier contract) — Samuel's judgment, not
 * the model's. Not in §5's explicit primitive list, but a faithful Exec
 * Summary restyle needs somewhere for human-authored, quantified judgment
 * to live — exactly the surface the "AI describes, never decides" rule
 * (§6.1) hands off to. Content must be hand-written per page, validated
 * against real numbers, never LLM-generated.
 *
 * Two tiers, not one paragraph (added after a stakeholder-skim review
 * found the decision itself got lost in prose weight-matched to
 * surrounding text):
 *   - `takeaway` — one bolded line: the action + the headline number
 *     (e.g. "Win back 247 Potential Loyalists → ~R$286K opportunity").
 *     This is the thing a skimming stakeholder must not miss.
 *   - `children` — the existing reasoning paragraph (the "why"), kept at
 *     the previous, lighter text-hi/t-body weight underneath.
 * Both are required — a Recommendation without a one-line takeaway is
 * exactly the failure mode this two-tier structure exists to prevent.
 */
export default function Recommendation({ takeaway, children }: { takeaway: ReactNode; children: ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--line-subtle)',
        borderRadius: 'var(--r-lg)',
        padding: 'var(--s-5) var(--s-6)',
        marginTop: 'var(--s-6)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--s-3)' }}>
        <div className="rq-eyebrow">Recommendation</div>
        <span
          className="rq-mono"
          style={{
            fontSize: 'var(--t-cap)',
            color: 'var(--accent)',
            border: '1px solid var(--line-accent)',
            borderRadius: 'var(--r-sm)',
            padding: '1px 6px',
          }}
        >
          Author: analysis
        </span>
      </div>
      <p
        style={{
          color: 'var(--text-hi)',
          fontSize: 'var(--t-body)',
          fontWeight: 600,
          maxWidth: '76ch',
          lineHeight: 'var(--lh-tight)',
          marginBottom: 'var(--s-2)',
        }}
      >
        {takeaway}
      </p>
      <p style={{ color: 'var(--text-mid)', fontSize: 'var(--t-body)', maxWidth: '76ch', lineHeight: 'var(--lh-body)' }}>
        {children}
      </p>
    </div>
  );
}
