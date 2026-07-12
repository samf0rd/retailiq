'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import MethodologyGraph from '@/components/v2/MethodologyGraph';
import TechniquesIndex from '@/components/v2/TechniquesIndex';

/**
 * The Methodology page (PRD §7.2) — "the dashboard is the conclusion; this
 * page is the work." An interactive DAG of the warehouse (raw → staging →
 * intermediate → marts), a plain-English explainer of that layering
 * pattern, and the SQL-techniques index — the explicit SQL-proficiency
 * proof every other page's "View SQL" drawer is a shortcut into.
 */
function MethodologyPageContent() {
  const searchParams = useSearchParams();
  const model = searchParams.get('model') || undefined;

  return (
    <div className="rq-v2">
      <div style={{ marginBottom: 'var(--s-8)' }}>
        <div className="rq-eyebrow">Methodology</div>
        <h1
          style={{
            fontSize: 'var(--t-display)',
            color: 'var(--text-hi)',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            lineHeight: 'var(--lh-tight)',
            margin: '6px 0',
            fontFamily: 'var(--font-sans)',
          }}
        >
          How this warehouse is built
        </h1>
        <div style={{ color: 'var(--text-mid)', fontSize: 'var(--t-sm)', maxWidth: 720, lineHeight: 'var(--lh-body)' }}>
          Every number on this dashboard traces back through a fixed layering pattern —{' '}
          <span className="rq-mono" style={{ color: 'var(--text-hi)' }}>
            raw
          </span>{' '}
          (source CSVs, loaded as-is) →{' '}
          <span className="rq-mono" style={{ color: 'var(--text-hi)' }}>
            staging
          </span>{' '}
          (one model per source table: types cast, columns renamed, nothing joined yet) →{' '}
          <span className="rq-mono" style={{ color: 'var(--text-hi)' }}>
            intermediate
          </span>{' '}
          (the join hubs — enrichment logic defined once, reused by many marts) →{' '}
          <span className="rq-mono" style={{ color: 'var(--text-hi)' }}>
            marts
          </span>{' '}
          (the business-grain tables the dashboard actually queries). Click any node below to see its real SQL,
          its dbt tests, and where it sits in this chain.
        </div>
      </div>

      <MethodologyGraph initialModel={model} />

      <div style={{ marginTop: 'var(--s-10)' }}>
        <div style={{ marginBottom: 'var(--s-5)' }}>
          <div className="rq-eyebrow" style={{ marginBottom: 'var(--s-1)' }}>
            SQL proficiency index
          </div>
          <div style={{ color: 'var(--text-hi)', fontSize: 'var(--t-h2)', fontWeight: 600 }}>
            Advanced constructs used in this warehouse
          </div>
        </div>
        <div
          style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--line-subtle)',
            borderRadius: 'var(--r-lg)',
            padding: 'var(--s-5) var(--s-6)',
            boxShadow: 'var(--shadow-panel)',
          }}
        >
          <TechniquesIndex />
        </div>
      </div>
    </div>
  );
}

export default function MethodologyPage() {
  return (
    <Suspense fallback={null}>
      <MethodologyPageContent />
    </Suspense>
  );
}
