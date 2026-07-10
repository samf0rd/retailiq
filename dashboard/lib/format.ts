/**
 * Canonical BRL formatter (PRD §8.2 — "one formatting util, used
 * everywhere"). Only wired into the v2 Exec Summary this phase; the sweep
 * to replace ad hoc `R$ ${n.toLocaleString()}` calls on the other pages is
 * R1 (Consistency & data-honesty pass).
 */
export function fmtBRL(value: number, decimals = 0): string {
  return `R$ ${value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}
