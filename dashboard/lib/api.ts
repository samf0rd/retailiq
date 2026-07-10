const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Fetch JSON from the FastAPI backend. Every dashboard page uses this —
 * never fetches ad hoc — so error/loading handling stays consistent.
 * Server components can call this directly (no client-side waterfall).
 */
export async function apiGet<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const qs = params
    ? '?' +
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';

  const res = await fetch(`${API_BASE}${path}${qs}`, {
    // Marts refresh on a batch cadence (dbt/ML run), not per-request —
    // short revalidation window is enough to feel live without hammering DuckDB.
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new ApiError(detail || `Request failed: ${path}`, res.status);
  }

  return res.json();
}

// ── Typed row shapes (mirrors the dbt mart column lists) ───────────────────

export interface RevenueRow {
  order_month: string;
  category_name_en: string;
  order_count: number;
  item_count: number;
  product_revenue: number;
  freight_revenue: number;
  gross_revenue: number;
  avg_item_price: number;
  total_gross_revenue: number;
  total_orders: number;
  revenue_share_pct: number;
  prev_month_revenue: number | null;
  cumulative_revenue: number;
  cumulative_total_revenue: number;
  category_rank_in_month: number;
  mom_growth_pct: number | null;
  is_top3_category: boolean;
}

export interface RevenueSummary {
  total_revenue: number;
  total_orders: number;
  aov: number;
  latest_month: string;
  latest_month_revenue: number;
  latest_top_category_growth: number | null;
  latest_total_revenue_growth: number | null;
}

export interface SellerRow {
  seller_id: string;
  seller_city: string;
  seller_state: string;
  total_orders: number;
  total_items: number;
  categories_sold: number;
  total_gross_revenue: number;
  avg_delivery_days: number;
  late_delivery_rate_pct: number;
  cancellation_rate_pct: number;
  avg_review_score: number;
  negative_review_rate_pct: number;
  revenue_rank: number;
  revenue_percentile: number;
  review_rank: number;
  seller_tier: string;
}

export interface LogisticsRow {
  customer_state: string;
  order_month: string;
  delivered_orders: number;
  avg_delivery_days: number;
  avg_estimated_days: number;
  avg_delta_days: number;
  median_delivery_days: number;
  p95_delivery_days: number;
  late_rate_pct: number;
  avg_review_score: number;
  avg_review_score_late: number;
  avg_review_score_ontime: number;
  delivery_review_correlation: number;
  avg_freight_value: number;
  total_freight_revenue: number;
  latest_streak_start: string | null;
  latest_streak_end: string | null;
  latest_streak_length: number | null;
}

export interface CohortRow {
  cohort_month: string;
  periods_since_first_order: number;
  cohort_size: number;
  active_customers: number;
  retention_rate_pct: number;
  period_churn: number | null;
}

export interface KmeansSegmentEconomics {
  kmeans_segment: string;
  customer_count: number;
  avg_recency_days: number;
  avg_orders: number;
  avg_ltv: number;
  total_revenue: number;
  pct_of_customers: number;
  pct_of_revenue: number;
}

export interface RetentionTarget {
  propensity_tier: string;
  customer_count: number;
  avg_propensity_pct: number;
  avg_first_order_value: number;
  total_first_order_value: number;
  already_repeated: number;
}

export interface RfmRow {
  customer_unique_id: string;
  recency_days: number;
  frequency: number;
  monetary_value: number;
  r_score: number;
  f_score: number;
  m_score: number;
  rfm_score: number;
  rfm_segment: string;
  first_order_at: string;
  last_order_at: string;
  order_count: number;
}

export interface RepeatPropensityRow {
  customer_unique_id: string;
  is_repeat: number;
  repeat_propensity: number;
  propensity_tier: string;
}

export interface KmeansCustomerRow {
  customer_unique_id: string;
  recency_days: number;
  frequency: number;
  monetary_value: number;
  kmeans_segment: string;
}

