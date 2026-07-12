'use client';

/**
 * Error boundary for routes under the root layout. Unlike global-error.tsx,
 * this renders inside the root layout's <html>/<body>, so it must not
 * define its own — it can rely on globals.css/tokens.css same as any page.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ maxWidth: 440, textAlign: 'center', padding: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-dim, #9aa0a6)', marginBottom: 20 }}>
          {error.message || 'An unexpected error occurred while loading this page.'}
        </p>
        <button
          onClick={() => reset()}
          style={{
            background: 'var(--accent, #3ddc84)',
            color: 'var(--accent-ink, #05130a)',
            border: 'none',
            borderRadius: 6,
            padding: '8px 18px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
