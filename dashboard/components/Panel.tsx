import { ViewSqlTrigger } from './v2/SqlDrawer';

/**
 * `sqlModel` renders the "View SQL" affordance (PRD §5.5) in the panel's
 * top-right — pass the dbt model name exactly as it appears in
 * dbt/models/ (e.g. "mart_revenue"). SqlDrawer's own token scope is
 * self-contained (wraps itself in .rq-v2), so it renders correctly here
 * even though this v1 Panel otherwise uses the v1 token system.
 */
export default function Panel({
  title,
  sqlModel,
  children,
  style,
}: {
  title?: string;
  sqlModel?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        padding: 'var(--space-card-padding)',
        ...style,
      }}
    >
      {(title || sqlModel) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          {title && (
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-muted)',
                letterSpacing: 0.2,
              }}
            >
              {title}
            </div>
          )}
          {sqlModel && <ViewSqlTrigger modelName={sqlModel} />}
        </div>
      )}
      {children}
    </div>
  );
}
