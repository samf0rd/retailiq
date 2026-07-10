/**
 * Shared logistics data-honesty rules (PRD §8.4–8.5). A state/month cell
 * built on too few delivered orders can show a "clean" 0.0% late rate or an
 * extreme correlation purely from a small denominator, not real performance
 * — see e.g. AP (2 delivered orders, 0.0% late) vs SP (3,164 delivered
 * orders, 8.79% late) in the live warehouse. 30 is the same rule-of-thumb
 * minimum-n used for a stable proportion/correlation estimate that the
 * Cohorts page already applies informally ("cohorts under 5 customers");
 * here it's promoted to a named, reusable constant instead of one-off prose.
 */
export const MIN_SAMPLE_ORDERS = 30;

export function hasSufficientSample(deliveredOrders: number | null | undefined): boolean {
  return deliveredOrders != null && deliveredOrders >= MIN_SAMPLE_ORDERS;
}

export type CorrelationStrength = 'weak' | 'moderate' | 'strong';

/** Strength bands per PRD §8.5 — never let a weak |r| be described with a strong verb. */
export function correlationStrength(r: number | null | undefined): CorrelationStrength | null {
  if (r === null || r === undefined) return null;
  const abs = Math.abs(r);
  if (abs >= 0.7) return 'strong';
  if (abs >= 0.4) return 'moderate';
  return 'weak';
}
