import type { ReactNode } from 'react';
import Link from 'next/link';
import { MODELS, buildLineageChain, type ModelLayer } from '@/lib/models';

/**
 * The model-detail content (PRD §5.5) — SQL, description, row count,
 * lineage chain, tests. Shared by <SqlDrawer> (the per-panel popup) and the
 * Methodology page's node-click panel (§7.2: "Per-node panel reuses
 * <SqlDrawer> content inline") — same body, different chrome around it.
 */

const LAYER_LABEL: Record<ModelLayer, string> = {
  raw: 'raw',
  staging: 'staging',
  intermediate: 'intermediate',
  mart: 'mart',
};

const SQL_KEYWORDS = new Set([
  'select', 'from', 'where', 'with', 'as', 'and', 'or', 'on', 'join', 'inner', 'left', 'right', 'full', 'outer',
  'cross', 'group', 'by', 'order', 'partition', 'over', 'case', 'when', 'then', 'else', 'end', 'distinct', 'filter',
  'is', 'not', 'null', 'in', 'between', 'desc', 'asc', 'union', 'having', 'all', 'using', 'limit', 'offset',
  'within', 'rows', 'unbounded', 'preceding', 'current', 'row',
]);

export function highlightSqlLine(line: string, keyPrefix: string): ReactNode {
  if (line.trim().startsWith('--')) {
    return (
      <span key={keyPrefix} style={{ color: 'var(--text-lo)' }}>
        {line}
      </span>
    );
  }
  const tokenRe = /('[^']*'|\b\w+\b)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = tokenRe.exec(line))) {
    if (match.index > lastIndex) parts.push(line.slice(lastIndex, match.index));
    const tok = match[0];
    const isFn = line[tokenRe.lastIndex] === '(' && /^[a-zA-Z_]\w*$/.test(tok);
    const lower = tok.toLowerCase();
    if (tok.startsWith("'")) {
      parts.push(
        <span key={`${keyPrefix}-${i++}`} style={{ color: 'var(--accent-hi)' }}>
          {tok}
        </span>
      );
    } else if (isFn) {
      parts.push(
        <span key={`${keyPrefix}-${i++}`} style={{ color: 'var(--accent-hi)' }}>
          {tok}
        </span>
      );
    } else if (SQL_KEYWORDS.has(lower)) {
      parts.push(
        <span key={`${keyPrefix}-${i++}`} style={{ color: 'var(--info)' }}>
          {tok}
        </span>
      );
    } else {
      parts.push(tok);
    }
    lastIndex = tokenRe.lastIndex;
  }
  if (lastIndex < line.length) parts.push(line.slice(lastIndex));
  return <>{parts}</>;
}

export function ModelDetail({ modelName, showMethodologyLink = false }: { modelName: string; showMethodologyLink?: boolean }) {
  const model = MODELS[modelName];
  if (!model) {
    return <p style={{ fontSize: 'var(--t-sm)', color: 'var(--text-lo)' }}>Unknown model: {modelName}</p>;
  }

  const chain = buildLineageChain(modelName);
  const sqlLines = model.sql ? model.sql.split('\n') : [];
  const highlightedLineSet = new Set(model.highlight?.lines ?? []);

  return (
    <div>
      <span
        className="rq-mono"
        style={{
          display: 'inline-block',
          fontSize: 'var(--t-cap)',
          color: 'var(--accent)',
          background: 'var(--accent-wash)',
          border: '1px solid var(--line-accent)',
          borderRadius: 4,
          padding: '1px 7px',
          marginBottom: 'var(--s-4)',
        }}
      >
        {LAYER_LABEL[model.layer]}
      </span>

      <h3
        className="rq-mono"
        style={{ color: 'var(--text-hi)', fontSize: 'var(--t-h2)', fontWeight: 600, marginBottom: 'var(--s-1)' }}
      >
        {modelName}
      </h3>
      {model.description && (
        <p style={{ fontSize: 'var(--t-sm)', color: 'var(--text-mid)', lineHeight: 'var(--lh-body)' }}>
          {model.description}
        </p>
      )}
      {model.rowcount !== null && (
        <p className="rq-mono" style={{ fontSize: 'var(--t-cap)', color: 'var(--text-lo)', marginTop: 'var(--s-1)' }}>
          {model.rowcount.toLocaleString()} rows
        </p>
      )}

      {chain.length > 1 && (
        <div
          className="rq-mono"
          style={{
            display: 'flex',
            gap: 'var(--s-1)',
            flexWrap: 'wrap',
            alignItems: 'center',
            margin: 'var(--s-4) 0',
            fontSize: 'var(--t-cap)',
          }}
        >
          {chain.map((node, i) => (
            <span key={node.name} style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-1)' }}>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 'var(--r-sm)',
                  color: node.name === modelName ? 'var(--accent)' : 'var(--text-lo)',
                  border: `1px solid ${node.name === modelName ? 'var(--line-accent)' : 'var(--line-subtle)'}`,
                  background: node.name === modelName ? 'var(--accent-wash)' : 'transparent',
                }}
              >
                {node.name}
              </span>
              {i < chain.length - 1 && <span style={{ color: 'var(--text-faint)' }}>→</span>}
            </span>
          ))}
        </div>
      )}

      {model.sql ? (
        <>
          <pre
            className="rq-mono"
            style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--line-subtle)',
              borderRadius: 'var(--r-md)',
              padding: 'var(--s-4)',
              overflowX: 'auto',
              fontSize: 12,
              lineHeight: 1.7,
              color: 'var(--text-mid)',
              margin: 'var(--s-3) 0',
            }}
          >
            {sqlLines.map((line, i) => {
              const lineNo = i + 1;
              const isHighlighted = highlightedLineSet.has(lineNo);
              return (
                <div
                  key={lineNo}
                  style={
                    isHighlighted
                      ? { background: 'var(--accent-wash)', margin: '0 -4px', padding: '0 4px', borderLeft: '2px solid var(--accent)' }
                      : undefined
                  }
                >
                  {highlightSqlLine(line, String(lineNo)) || ' '}
                </div>
              );
            })}
          </pre>
          {model.highlight && (
            <div style={{ fontSize: 'var(--t-cap)', color: 'var(--accent)', margin: 'var(--s-1) 0 var(--s-3)', paddingLeft: 'var(--s-3)' }}>
              ↑ Line{model.highlight.lines.length > 1 ? 's' : ''} {model.highlight.lines.join(', ')} — {model.highlight.note}
            </div>
          )}
        </>
      ) : (
        <p style={{ fontSize: 'var(--t-sm)', color: 'var(--text-lo)', margin: 'var(--s-3) 0' }}>
          Raw source table — loaded directly from CSV (ingestion/load_raw.py), no dbt SQL to show. The first
          transformation happens one hop downstream, in staging.
        </p>
      )}

      <div className="rq-eyebrow" style={{ marginTop: 'var(--s-6)' }}>
        Tests on this model
      </div>
      {model.tests.length > 0 ? (
        <ul style={{ listStyle: 'none', marginTop: 'var(--s-3)' }}>
          {model.tests.map((t, i) => (
            <li key={i} className="rq-mono" style={{ fontSize: 'var(--t-sm)', color: 'var(--text-mid)', padding: 'var(--s-1) 0', display: 'flex', gap: 'var(--s-2)' }}>
              <span style={{ color: 'var(--accent)' }}>✓</span>
              {t.name}({t.column})
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: 'var(--t-sm)', color: 'var(--text-lo)', marginTop: 'var(--s-2)' }}>
          No column-level tests declared for this model.
        </p>
      )}

      {showMethodologyLink && (
        <div style={{ marginTop: 'var(--s-6)' }}>
          <Link href={`/app/methodology?model=${encodeURIComponent(modelName)}`} className="rq-mono" style={{ color: 'var(--accent)', fontSize: 'var(--t-sm)' }}>
            Open in Methodology →
          </Link>
        </div>
      )}
    </div>
  );
}
