'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

const selectStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-control)',
  color: 'var(--text)',
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  padding: '6px 10px',
};

/**
 * Filter controls read/write the URL search params directly (not local
 * state) so a filtered view is a shareable, bookmarkable link — the same
 * pattern used across every filterable page in this dashboard.
 */
export default function RevenueFilters({ months, categories }: { months: string[]; categories: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentMonth = searchParams.get('start_month') ?? '';
  const currentCategory = searchParams.get('category') ?? '';
  const hasFilter = Boolean(currentMonth || currentCategory);

  function updateParam(key: 'start_month' | 'category', value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
      if (key === 'start_month') params.set('end_month', value);
    } else {
      params.delete(key);
      if (key === 'start_month') params.delete('end_month');
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
      <select
        aria-label="Filter by month"
        value={currentMonth}
        onChange={(e) => updateParam('start_month', e.target.value)}
        style={selectStyle}
      >
        <option value="">All months (latest)</option>
        {months.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by category"
        value={currentCategory}
        onChange={(e) => updateParam('category', e.target.value)}
        style={selectStyle}
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      {hasFilter && (
        <button
          onClick={() => router.push(pathname)}
            style={{
            background: 'transparent',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-control)',
            color: 'var(--text-dim)',
            fontSize: 13,
            padding: '6px 10px',
            cursor: 'pointer',
          }}
        >
          Clear filter
        </button>
      )}
    </div>
  );
}
