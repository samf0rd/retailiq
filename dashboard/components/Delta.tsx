/**
 * The signature element: every rate-of-change number in the dashboard
 * renders through this component, so ▲/▼ + color always means the same
 * thing everywhere — a real ticker convention, applied consistently.
 */
export default function Delta({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return (
      <span className="mono" style={{ color: 'var(--text-dim)' }}>
        —
      </span>
    );
  }
  const up = value >= 0;
  return (
    <span className={`mono ${up ? 'delta-up' : 'delta-down'}`} style={{ fontSize: 13 }}>
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(1)}%
    </span>
  );
}
