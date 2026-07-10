import DeltaFigure from './DeltaFigure';
import { CountUp } from './motion';

/**
 * v2 KPI primitive (PRD §5.2). `countTo` + `format` opt into the one-shot
 * count-up (§5.7); a plain `value` string renders static — matches the
 * reference prototype, where only the two headline totals (revenue,
 * orders) animate and the derived/secondary KPIs (AOV, latest month) don't.
 */
export default function Kpi({
  label,
  value,
  countTo,
  format,
  delta,
}: {
  label: string;
  value?: string;
  countTo?: number;
  format?: 'brl' | 'int';
  delta?: { value: number | null; confidence?: 'normal' | 'low'; footnote?: string };
}) {
  return (
    <div
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--line-subtle)',
        borderRadius: 'var(--r-lg)',
        padding: 'var(--s-5)',
      }}
    >
      <div className="rq-eyebrow">{label}</div>
      <div
        className="rq-mono"
        style={{
          fontSize: 'var(--t-kpi)',
          color: 'var(--text-hi)',
          fontWeight: 500,
          marginTop: 'var(--s-2)',
          letterSpacing: '-0.01em',
        }}
      >
        {countTo !== undefined && format ? <CountUp target={countTo} format={format} /> : value}
      </div>
      {delta && (
        <div style={{ marginTop: 'var(--s-2)' }}>
          <DeltaFigure value={delta.value} confidence={delta.confidence} footnote={delta.footnote} />
        </div>
      )}
    </div>
  );
}
