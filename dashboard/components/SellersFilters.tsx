'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

const TIERS = ['Elite', 'Established', 'Growing', 'New'];

const selectStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-control)',
  color: 'var(--text)',
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  padding: '6px 10px',
};

export default function SellersFilters() {
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
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
      <select
        aria-label="Filter by tier"
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
