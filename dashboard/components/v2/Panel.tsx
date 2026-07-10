import type { ReactNode, CSSProperties } from 'react';
import { ViewSqlTrigger } from './SqlDrawer';

/**
 * v2 base container (PRD §5.1). `sqlModel` renders the "View SQL" affordance
 * (§5.5) in the panel's top-right when the panel renders data from a real
 * dbt mart — pass the model name exactly as it appears in dbt/models/
 * (e.g. "mart_revenue"). Omit it for panels backed by ml/ outputs or
 * non-mart data, where there's no dbt SQL to show.
 */
export default function Panel({
  title,
  eyebrow,
  sqlModel,
  sqlTriggerId,
  children,
  style,
}: {
  title?: string;
  eyebrow?: string;
  sqlModel?: string;
  /** DOM id for the "View SQL" button — only needed to target it from the tour config. */
  sqlTriggerId?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      className="rq-panel"
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--line-subtle)',
        borderRadius: 'var(--r-lg)',
        padding: 'var(--s-6)',
        boxShadow: 'var(--shadow-panel)',
        position: 'relative',
        ...style,
      }}
    >
      {(title || eyebrow || sqlModel) && (
        <div style={{ marginBottom: 'var(--s-5)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            {eyebrow && (
              <div className="rq-eyebrow" style={{ marginBottom: 'var(--s-1)' }}>
                {eyebrow}
              </div>
            )}
            {title && (
              <div
                style={{
                  color: 'var(--text-hi)',
                  fontSize: 'var(--t-h2)',
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {title}
              </div>
            )}
          </div>
          {sqlModel && <ViewSqlTrigger modelName={sqlModel} id={sqlTriggerId} />}
        </div>
      )}
      {children}
    </div>
  );
}
