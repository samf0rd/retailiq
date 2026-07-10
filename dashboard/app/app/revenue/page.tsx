import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import Panel from '@/components/Panel';
import Delta from '@/components/Delta';
import WarehouseNotice from '@/components/WarehouseNotice';
import RevenueFilters from '@/components/RevenueFilters';
import RevenueStackedArea from '@/components/RevenueStackedArea';
import AnalystNote from '@/components/v2/AnalystNote';
import Recommendation from '@/components/v2/Recommendation';
import { apiGet, ApiError, RevenueRow } from '@/lib/api';
import { fmtBRL } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function RevenuePage({
  searchParams,
}: {
  searchParams: { category?: string; start_month?: string; end_month?: string };
}) {
  const category = searchParams.category || undefined;
  const startMonth = searchParams.start_month || undefined;
  const endMonth = searchParams.end_month || undefined;
  const hasMonthFilter = Boolean(startMonth || endMonth);
  const isDrillDown = Boolean(category);

  let allRows: RevenueRow[] = []; // unfiltered — populates the month dropdown + default (no-filter) view
  let displayRows: RevenueRow[] = []; // real, backend-filtered rows actually rendered in the table
  let categories: string[] = [];
  let error: string | null = null;

  try {
    const [all, cats] = await Promise.all([
      apiGet<RevenueRow[]>('/api/revenue'),
      apiGet<{ category_name_en: string }[]>('/api/meta/categories'),
    ]);
    allRows = all;
    categories = cats.map((c) => c.category_name_en);

    displayRows =
      category || hasMonthFilter
        ? await apiGet<RevenueRow[]>('/api/revenue', { category, start_month: startMonth, end_month: endMonth })
        : allRows;
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Unknown error';
  }

  if (error) {
    return (
      <>
        <PageHeader eyebrow="REVENUE" title="Revenue Deep Dive" />
        <WarehouseNotice error={error} />
      </>
    );
  }

  const allMonths = Array.from(new Set(allRows.map((r) => r.order_month))).sort();

  let tableRows: RevenueRow[];
  let panelTitle: string;
  let subtitle: string;

  if (isDrillDown) {
    // Drill-down: one category, its full trend across whichever months matched.
    tableRows = [...displayRows].sort((a, b) => a.order_month.localeCompare(b.order_month));
    const range = hasMonthFilter ? `${startMonth ?? allMonths[0]}–${endMonth ?? allMonths[allMonths.length - 1]}` : 'all months';
    panelTitle = `${category} — Monthly Trend`;
    subtitle = `Category-level monthly revenue with month-over-month growth and revenue share. Showing ${category} across ${range}.`;
  } else if (hasMonthFilter) {
    // Explicit month filter, no category: leaderboard across whichever month(s) matched.
    tableRows = [...displayRows].sort(
      (a, b) => a.order_month.localeCompare(b.order_month) || a.category_rank_in_month - b.category_rank_in_month
    );
    const monthLabel = startMonth && endMonth && startMonth !== endMonth ? `${startMonth}–${endMonth}` : startMonth ?? endMonth ?? '—';
    panelTitle = `Category Breakdown — ${monthLabel}`;
    subtitle = `Category-level monthly revenue with month-over-month growth and revenue share. Grain: order_month × category. Showing ${monthLabel}.`;
  } else {
    // Default: latest month, all categories — original behavior.
    const latestMonth = displayRows.reduce((max, r) => (r.order_month > max ? r.order_month : max), '');
    tableRows = displayRows.filter((r) => r.order_month === latestMonth).sort((a, b) => a.category_rank_in_month - b.category_rank_in_month);
    panelTitle = `Category Breakdown — ${latestMonth || '—'}`;
    subtitle = `Category-level monthly revenue with month-over-month growth and revenue share. Grain: order_month × category. Showing ${latestMonth || '—'}.`;
  }

  // Grounding for the AnalystNote below, computed live from `allRows` (the
  // unfiltered /api/revenue fetch, already excludes incomplete trailing
  // months server-side) — independent of whatever drill-down/filter the
  // visitor currently has applied, so the concentration framing stays
  // consistent no matter which view they're on.
  const latestCompleteMonth = allRows.reduce((max, r) => (r.order_month > max ? r.order_month : max), '');
  const latestMonthRows = [...allRows]
    .filter((r) => r.order_month === latestCompleteMonth)
    .sort((a, b) => a.category_rank_in_month - b.category_rank_in_month);
  const top5Share = latestMonthRows
    .filter((r) => r.category_rank_in_month <= 5)
    .reduce((s, r) => s + r.revenue_share_pct, 0);
  const topCategory = latestMonthRows[0];
  const totalCategoryCount = categories.length;

  return (
    <>
      <PageHeader eyebrow="REVENUE" title="Revenue Deep Dive" subtitle={subtitle} />

      {topCategory && (
        <div className="rq-v2" style={{ marginBottom: 20 }}>
          <AnalystNote
            figures={{
              month: latestCompleteMonth,
              topCategory: topCategory.category_name_en,
              topShare: topCategory.revenue_share_pct,
              top5Share: top5Share.toFixed(1),
              totalCategories: totalCategoryCount,
            }}
          >
            {(f) => (
              <>
                <span className="rq-mono" style={{ color: 'var(--text-hi)' }}>
                  {f.topCategory}
                </span>{' '}
                is the largest category in{' '}
                <span className="rq-mono" style={{ color: 'var(--text-hi)' }}>
                  {f.month}
                </span>{' '}
                at{' '}
                <span className="rq-mono" style={{ color: 'var(--text-hi)' }}>
                  {f.topShare}%
                </span>{' '}
                of gross revenue — and the top 5 of {f.totalCategories} categories together account for{' '}
                <span className="rq-mono" style={{ color: 'var(--text-hi)' }}>
                  {f.top5Share}%
                </span>
                .
              </>
            )}
          </AnalystNote>
          <Recommendation
            takeaway={`Track category concentration monthly — top 5 of ${totalCategoryCount} categories are ${top5Share.toFixed(1)}% of revenue.`}
          >
            A 20% demand shock to{' '}
            <span className="rq-mono" style={{ color: 'var(--accent-hi)' }}>
              {topCategory.category_name_en}
            </span>{' '}
            alone ({topCategory.revenue_share_pct}% of revenue) would be roughly a{' '}
            <span className="rq-mono" style={{ color: 'var(--accent-hi)' }}>
              {(topCategory.revenue_share_pct * 0.2).toFixed(1)}%
            </span>{' '}
            hit to total monthly revenue. Worth tracking category-level concentration as a standing risk metric —
            re-check this 5-category share monthly — rather than launching a diversification program without a
            specific trigger threshold.
          </Recommendation>
        </div>
      )}

      <Panel title="Revenue by Category — Top 6 Over Time" sqlModel="mart_revenue" style={{ marginBottom: 28 }}>
        <RevenueStackedArea data={allRows} />
      </Panel>

      <RevenueFilters months={allMonths} categories={categories} />

      <Panel title={panelTitle} sqlModel="mart_revenue">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-strong)' }}>
              {isDrillDown ? (
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Month</th>
              ) : (
                <>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Rank</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Category</th>
                </>
              )}
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Gross Revenue</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Share</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>MoM Growth</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Orders</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((r) => (
              <tr key={`${r.order_month}:${r.category_name_en}`} style={{ borderBottom: '1px solid var(--border)' }}>
                {isDrillDown ? (
                  <td className="mono" style={{ padding: '8px 12px', color: 'var(--text)' }}>{r.order_month}</td>
                ) : (
                  <>
                    <td className="mono" style={{ padding: '8px 12px', color: r.is_top3_category ? 'var(--accent)' : 'var(--text-dim)' }}>
                      {r.category_rank_in_month}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text)' }}>
                      <Link
                        href={`/app/revenue?category=${encodeURIComponent(r.category_name_en)}`}
                        style={{ color: 'var(--info)', textDecoration: 'underline dotted' }}
                      >
                        {r.category_name_en}
                      </Link>
                    </td>
                  </>
                )}
                <td className="mono" style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtBRL(r.gross_revenue)}</td>
                <td className="mono" style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>{r.revenue_share_pct}%</td>
                <td className="mono" style={{ padding: '8px 12px', textAlign: 'right' }}>
                  <Delta value={r.mom_growth_pct} />
                </td>
                <td className="mono" style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>{r.order_count}</td>
              </tr>
            ))}
            {tableRows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 16, color: 'var(--text-dim)', textAlign: 'center' }}>
                  No rows for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
