/**
 * Delta (▲/▼) is for true period-over-period changes, where "up" is
 * unambiguously good news (revenue growth). Late-delivery rate, negative-
 * review rate, etc. are raw current-state percentages with no "previous
 * value" being compared — reusing Delta on them wrongly implies a rising
 * late-delivery rate is "gaining," when it's actually getting worse.
 *
 * Rate renders the number plainly and colors it by a business threshold
 * instead: everything under `warnAt` is neutral, `warnAt`–`badAt` is amber,
 * above `badAt` is red. Lower-is-worse metrics (e.g. review score) pass
 * `invert` to flip the direction.
 */
export default function Rate({
  value,
  warnAt = 10,
  badAt = 20,
  invert = false,
  suffix = '%',
}: {
  value: number | null | undefined;
  warnAt?: number;
  badAt?: number;
  invert?: boolean;
  suffix?: string;
}) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return (
      <span className="mono" style={{ color: 'var(--text-dim)' }}>
        —
      </span>
    );
  }

  const bad = invert ? value < badAt : value >= badAt;
  const warn = invert ? value < warnAt : value >= warnAt;
  const color = bad ? 'var(--negative)' : warn ? 'var(--warning)' : 'var(--text-muted)';

  return (
    <span className="mono" style={{ color, fontSize: 13 }}>
      {value.toFixed(1)}
      {suffix}
    </span>
  );
}
