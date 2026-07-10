export default function WarehouseNotice({ error }: { error: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-card)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        background: 'var(--surface)',
        padding: 'var(--space-card-padding)',
        maxWidth: 640,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--negative)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Warehouse Unavailable
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        The API couldn&apos;t reach the DuckDB warehouse. Run <code className="mono">dbt build</code> from{' '}
        <code className="mono">dbt/</code>, then start the API with{' '}
        <code className="mono">uvicorn api.main:app --reload --port 8000</code>.
      </p>
      <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 12 }}>{error}</p>
    </div>
  );
}
