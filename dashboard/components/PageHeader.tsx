export default function PageHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div
        style={{
          fontSize: 11,
          color: 'var(--accent)',
          letterSpacing: 1,
          marginBottom: 6,
          textTransform: 'uppercase',
          fontWeight: 600,
        }}
      >
        {eyebrow}
      </div>
      <h1 style={{ fontSize: 22, color: 'var(--text)' }}>{title}</h1>
      {subtitle && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, maxWidth: 640 }}>{subtitle}</p>
      )}
    </div>
  );
}
