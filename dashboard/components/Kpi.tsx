export default function Kpi({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        padding: '16px 20px',
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: 26, color: 'var(--text)', marginTop: 6, fontWeight: 600 }}>
        {value}
      </div>
      {sublabel && <div style={{ marginTop: 4 }}>{sublabel}</div>}
    </div>
  );
}
