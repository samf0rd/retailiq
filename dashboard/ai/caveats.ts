/**
 * The caveat engine (PRD §6.2) — a pure function that takes a metric's real
 * context and returns zero or more caveats. Runs BEFORE an <AnalystNote>
 * renders; the note only ever consumes this engine's output, never invents
 * its own hedging language. Every rule here traces to a real dataset fact,
 * not a guess:
 *
 *  - Truncated tail: 2018-08 is the dataset's final month (data collection
 *    stopped mid-month) and Sep 2016–Feb 2017 is Olist's launch window
 *    (real but tiny volume, some months under 10 orders) — a period-over-
 *    period delta computed at either edge is a data-collection artifact
 *    risk, not necessarily a business signal.
 *  - Small-n: below a stated minimum-sample threshold, a rate or
 *    correlation is as likely to be noise as signal (see dashboard's
 *    Logistics small-n suppression, lib/logistics.ts, same 30-order floor).
 *  - Weak correlation: |r| < 0.4 must never be described with a strong verb
 *    ("drives", "requires intervention") — see PRD §6.3's Logistics example.
 */

export const FINAL_MONTH = '2018-08';
export const LAUNCH_WINDOW_END = '2017-02';
export const DEFAULT_MIN_SAMPLE = 30;
export const WEAK_CORRELATION_MAX = 0.4;
export const MODERATE_CORRELATION_MAX = 0.7;

export type CorrelationStrength = 'weak' | 'moderate' | 'strong';

export function isTruncatedPeriod(period: string): boolean {
  return period === FINAL_MONTH || period <= LAUNCH_WINDOW_END;
}

export function correlationStrength(r: number): CorrelationStrength {
  const abs = Math.abs(r);
  if (abs >= MODERATE_CORRELATION_MAX) return 'strong';
  if (abs >= WEAK_CORRELATION_MAX) return 'moderate';
  return 'weak';
}

export interface MetricContext {
  /** YYYY-MM period this metric is computed for, if the metric is period-scoped. */
  period?: string;
  /** Sample size (order/customer/observation count) backing this metric. */
  sampleSize?: number;
  /** Override the default minimum-sample floor (30) for this metric's domain. */
  sampleSizeThreshold?: number;
  /** Correlation coefficient, if this metric is a correlation. */
  correlation?: number;
}

export interface EngineCaveat {
  id: 'truncated-tail' | 'small-n' | 'weak-correlation';
  text: string;
}

export function getCaveats(ctx: MetricContext): EngineCaveat[] {
  const caveats: EngineCaveat[] = [];

  if (ctx.period && isTruncatedPeriod(ctx.period)) {
    caveats.push({
      id: 'truncated-tail',
      text:
        ctx.period === FINAL_MONTH
          ? `${FINAL_MONTH} is the final month in the dataset and may be partially truncated; month-over-month at the series edge is treated as low-confidence.`
          : `${ctx.period} falls in Olist's Sep 2016–Feb 2017 launch window — real but tiny order volume; rates from this period are directional, not conclusive.`,
    });
  }

  const threshold = ctx.sampleSizeThreshold ?? DEFAULT_MIN_SAMPLE;
  if (ctx.sampleSize !== undefined && ctx.sampleSize < threshold) {
    caveats.push({
      id: 'small-n',
      text: `Based on n=${ctx.sampleSize}, below the ${threshold}-observation floor this dashboard uses for a stable estimate — treat as directional, not conclusive.`,
    });
  }

  if (ctx.correlation !== undefined && correlationStrength(ctx.correlation) === 'weak') {
    caveats.push({
      id: 'weak-correlation',
      text: `|r|=${Math.abs(ctx.correlation).toFixed(3)} is a weak correlation (<${WEAK_CORRELATION_MAX}) — real, but not strong enough to describe as "driving" or to justify on its own.`,
    });
  }

  return caveats;
}
