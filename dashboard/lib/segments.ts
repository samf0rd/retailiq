/**
 * Canonical K-Means segment taxonomy (PRD §8.3 — "one canonical set of
 * names ... identical in the bubble legend, the economics table, the
 * AnalystNote, and the recommendation"). `ml/segmentation.py`'s BASE_NAMES
 * is the source of truth for these 6 labels; only 4 occur in the current
 * training run (Champions, Potential Loyalists, Need Attention, Hibernating)
 * but all 6 get a fixed color so a re-run that produces "At Risk" or "Loyal
 * Customers" doesn't silently fall back to an unassigned chart color.
 *
 * mart_rfm's rule-based scoring produces a separate 8-label set (adds
 * "Recent Customers" / "Cannot Lose Them") used only for the RFM↔K-Means
 * agreement-rate comparison on the Segments page — those labels are never
 * rendered standalone in the UI, so they're intentionally not part of this
 * canonical set.
 */
export const SEGMENT_NAMES = [
  'Champions',
  'Loyal Customers',
  'Potential Loyalists',
  'At Risk',
  'Need Attention',
  'Hibernating',
] as const;

export const SEGMENT_COLOR: Record<string, string> = {
  Champions: 'var(--viz-1)',
  'Loyal Customers': 'var(--viz-2)',
  'Potential Loyalists': 'var(--viz-3)',
  'At Risk': 'var(--viz-5)',
  'Need Attention': 'var(--viz-4)',
  Hibernating: 'var(--viz-6)',
};
