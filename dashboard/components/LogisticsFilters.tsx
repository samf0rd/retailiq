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

export default function LogisticsFilters({ states }: { states: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentState = searchParams.get('state') ?? '';

  function updateState(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set('state', value);
    } else {
      params.delete('state');
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
      <select
        aria-label="Filter by state"
        value={currentState}
        onChange={(e) => updateState(e.target.value)}
        style={selectStyle}
      >
        <option value="">All states (latest month)</option>
        {states.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      {currentState && (
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
