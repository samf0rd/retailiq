/**
 * v2 inline mono delta (PRD §5.6), reused by <Kpi> (§5.2) and by tables.
 * Low-confidence rule (truncated tail / small-n, §6.2): no arrow, no
 * pos/neg color — render in --text-lo with a † marker instead. The real
 * value still shows when we have one; low-confidence means "treat with
 * caution," not "hide the number."
 */
export default function DeltaFigure({
  value,
  confidence = 'normal',
  footnote,
}: {
  value: number | null;
  confidence?: 'normal' | 'low';
  footnote?: string;
}) {
  if (value === null && !footnote) {
    return (
      <span className="rq-mono" style={{ color: 'var(--text-lo)', fontSize: 'var(--t-sm)' }}>
        —
      </span>
    );
  }

  if (confidence === 'low') {
    return (
      <span className="rq-mono" style={{ color: 'var(--text-lo)', fontSize: 'var(--t-sm)' }}>
        † {value !== null ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}% ` : ''}
        {footnote}
      </span>
    );
  }

  const positive = (value ?? 0) >= 0;
  return (
    <span className="rq-mono" style={{ color: positive ? 'var(--pos)' : 'var(--neg)', fontSize: 'var(--t-sm)' }}>
      {positive ? '▲' : '▼'} {Math.abs(value ?? 0).toFixed(1)}%
    </span>
  );
}
