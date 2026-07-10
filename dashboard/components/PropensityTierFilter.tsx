'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

const TIERS = ['Very High', 'High', 'Medium', 'Low'];

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
 * Filters the raw per-customer propensity table only — the aggregated
 * Retention Targeting table above it is a separate endpoint (already one
 * row per tier) and is intentionally unaffected by this control.
 */
export default function PropensityTierFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentTier = searchParams.get('tier') ?? '';

  function updateTier(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set('tier', value);
    } else {
      params.delete('tier');
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
      <select
        aria-label="Filter customers by propensity tier"
        value={currentTier}
        onChange={(e) => updateTier(e.target.value)}
        style={selectStyle}
      >
        <option value="">All tiers</option>
        {TIERS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      {currentTier && (
        <button
          onClick={() => updateTier('')}
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
