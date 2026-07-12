'use client';

/**
 * Last-resort boundary for errors thrown above/within the root layout
 * itself (not caught by any nested error.tsx). Per Next.js App Router
 * requirements, this file fully replaces the root layout when it activates
 * — so, unlike every other file in app/, it must define its own <html> and
 * <body>. It can't rely on globals.css/tokens.css (the root layout that
 * imports them isn't rendered at all here), hence the inline styles.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b0d10',
          color: '#e8eaed',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif',
        }}
      >
        <div style={{ maxWidth: 440, textAlign: 'center', padding: 24 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: '#9aa0a6', marginBottom: 20 }}>
            {error.message || 'An unexpected error occurred while loading this page.'}
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: '#3ddc84',
              color: '#05130a',
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
      </body>
    </html>
  );
}
