import { MODELS } from '@/lib/models';

const TECHNIQUE_LABEL: Record<string, string> = {
  'gap-and-island': 'Gap-and-island',
  ntile: 'NTILE(n)',
  percentile_cont: 'PERCENTILE_CONT()',
  corr: 'CORR()',
  percent_rank: 'PERCENT_RANK()',
  rank: 'RANK()',
  'window-lag-sum': 'LAG() / SUM() OVER()',
};

/**
 * The explicit SQL-proficiency proof (PRD §7.2) — every advanced construct
 * detected during the model bundling pass (dashboard/scripts/bundle-
 * models.mjs), which mart uses it, and why. Derived entirely from the
 * bundled models.json, not hand-maintained — add a new construct to
 * bundle-models.mjs's SHOWCASE_CONSTRUCTS and it appears here automatically.
 */
export default function TechniquesIndex() {
  const byTechnique = new Map<string, { note: string; models: string[] }>();
  for (const [name, model] of Object.entries(MODELS)) {
    if (!model.highlight) continue;
    const entry = byTechnique.get(model.highlight.id) ?? { note: model.highlight.note, models: [] };
    entry.models.push(name);
    byTechnique.set(model.highlight.id, entry);
  }

  const rows = [...byTechnique.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  if (rows.length === 0) return null;

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-sm)' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--line-strong)' }}>
          <th style={{ textAlign: 'left', padding: 'var(--s-2) var(--s-3)', color: 'var(--text-lo)', fontWeight: 500 }}>Technique</th>
          <th style={{ textAlign: 'left', padding: 'var(--s-2) var(--s-3)', color: 'var(--text-lo)', fontWeight: 500 }}>Used by</th>
          <th style={{ textAlign: 'left', padding: 'var(--s-2) var(--s-3)', color: 'var(--text-lo)', fontWeight: 500 }}>Why this technique here</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([id, { note, models }]) => (
          <tr key={id} style={{ borderBottom: '1px solid var(--line-subtle)' }}>
            <td className="rq-mono" style={{ padding: 'var(--s-2) var(--s-3)', color: 'var(--text-hi)', whiteSpace: 'nowrap' }}>
              {TECHNIQUE_LABEL[id] ?? id}
            </td>
            <td className="rq-mono" style={{ padding: 'var(--s-2) var(--s-3)', color: 'var(--accent)' }}>
              {models.join(', ')}
            </td>
            <td style={{ padding: 'var(--s-2) var(--s-3)', color: 'var(--text-mid)', lineHeight: 'var(--lh-body)' }}>{note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
