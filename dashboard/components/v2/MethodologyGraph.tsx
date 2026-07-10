'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MODELS, type ModelLayer } from '@/lib/models';
import { ModelDetail } from './ModelDetail';

/**
 * The Methodology page's interactive DAG (PRD §7.2). Not a static image —
 * clicking a node selects it, highlights its full ancestor/descendant path,
 * and opens its detail (SQL, tests, description, row count) via the same
 * <ModelDetail> the SqlDrawer uses.
 *
 * Deliberately not React Flow (PRD explicitly allows the lighter option:
 * "an SVG columns-by-layer diagram with hover is acceptable"). Nodes are
 * laid out in fixed layer columns (plain flex/grid — no force layout to
 * fight with); edges are real SVG paths, positioned by measuring each
 * node's actual DOM rect (same getBoundingClientRect() technique
 * components/ProductTour.tsx already uses for its spotlight), redrawn on
 * resize and on selection change.
 */

const LAYER_ORDER: ModelLayer[] = ['raw', 'staging', 'intermediate', 'mart'];
const LAYER_TITLE: Record<ModelLayer, string> = {
  raw: 'Raw',
  staging: 'Staging',
  intermediate: 'Intermediate',
  mart: 'Marts',
};
const LAYER_COLOR: Record<ModelLayer, string> = {
  raw: 'var(--text-lo)',
  staging: 'var(--info)',
  intermediate: 'var(--warn)',
  mart: 'var(--accent)',
};

function directDeps(name: string): string[] {
  const m = MODELS[name];
  if (!m) return [];
  return [...m.lineage.ref, ...m.lineage.source];
}

function directDependents(name: string): string[] {
  return Object.entries(MODELS)
    .filter(([, m]) => m.lineage.ref.includes(name) || m.lineage.source.includes(name))
    .map(([n]) => n);
}

/** Every node reachable by walking up (ancestors) or down (descendants) from `name`. */
function connectedSet(name: string): Set<string> {
  const seen = new Set<string>([name]);
  const queue = [...directDeps(name), ...directDependents(name)];
  while (queue.length > 0) {
    const next = queue.pop()!;
    if (seen.has(next)) continue;
    seen.add(next);
    queue.push(...directDeps(next), ...directDependents(next));
  }
  return seen;
}

/** All direct edges in the graph, as [from, to] pairs (from = upstream). */
function allEdges(): [string, string][] {
  const edges: [string, string][] = [];
  for (const [name, m] of Object.entries(MODELS)) {
    for (const dep of [...m.lineage.ref, ...m.lineage.source]) {
      if (MODELS[dep]) edges.push([dep, name]);
    }
  }
  return edges;
}

export default function MethodologyGraph({ initialModel }: { initialModel?: string }) {
  const [selected, setSelected] = useState<string | null>(initialModel && MODELS[initialModel] ? initialModel : null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [paths, setPaths] = useState<{ d: string; active: boolean }[]>([]);
  const [, forceRecalc] = useState(0);

  const edges = useMemo(() => allEdges(), []);
  const highlighted = useMemo(() => (selected ? connectedSet(selected) : null), [selected]);

  const byLayer = useMemo(() => {
    const grouped: Record<ModelLayer, string[]> = { raw: [], staging: [], intermediate: [], mart: [] };
    for (const [name, m] of Object.entries(MODELS)) {
      grouped[m.layer].push(name);
    }
    for (const layer of LAYER_ORDER) grouped[layer].sort();
    return grouped;
  }, []);

  useLayoutEffect(() => {
    function recompute() {
      const container = containerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const next: { d: string; active: boolean }[] = [];

      for (const [from, to] of edges) {
        const fromEl = nodeRefs.current.get(from);
        const toEl = nodeRefs.current.get(to);
        if (!fromEl || !toEl) continue;
        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();
        const x1 = fromRect.right - containerRect.left;
        const y1 = fromRect.top - containerRect.top + fromRect.height / 2;
        const x2 = toRect.left - containerRect.left;
        const y2 = toRect.top - containerRect.top + toRect.height / 2;
        const midX = (x1 + x2) / 2;
        const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
        const active = highlighted ? highlighted.has(from) && highlighted.has(to) : false;
        next.push({ d, active });
      }
      setPaths(next);
    }

    recompute();
    window.addEventListener('resize', recompute);
    return () => window.removeEventListener('resize', recompute);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, highlighted, selected]);

  // Re-measure once after mount (fonts/layout can shift rects a frame late).
  useEffect(() => {
    const t = setTimeout(() => forceRecalc((n) => n + 1), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', gap: 'var(--s-5)', marginBottom: 'var(--s-5)', fontSize: 'var(--t-cap)' }}>
        {LAYER_ORDER.map((layer) => (
          <div key={layer} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-lo)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: LAYER_COLOR[layer] }} />
            {LAYER_TITLE[layer]}
          </div>
        ))}
      </div>

      <div
        ref={containerRef}
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 'var(--s-6)',
          background: 'var(--bg-panel)',
          border: '1px solid var(--line-subtle)',
          borderRadius: 'var(--r-lg)',
          padding: 'var(--s-6)',
        }}
      >
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          aria-hidden="true"
        >
          {paths.map((p, i) => (
            <path
              key={i}
              d={p.d}
              fill="none"
              stroke={p.active ? 'var(--accent)' : 'var(--line-subtle)'}
              strokeWidth={p.active ? 1.5 : 1}
              opacity={selected ? (p.active ? 1 : 0.25) : 0.6}
            />
          ))}
        </svg>

        {LAYER_ORDER.map((layer) => (
          <div key={layer} style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
            <div className="rq-eyebrow" style={{ marginBottom: 'var(--s-1)' }}>
              {LAYER_TITLE[layer]} ({byLayer[layer].length})
            </div>
            {byLayer[layer].map((name) => {
              const isSelected = selected === name;
              const isDimmed = highlighted ? !highlighted.has(name) : false;
              return (
                <button
                  key={name}
                  ref={(el) => {
                    if (el) nodeRefs.current.set(name, el);
                    else nodeRefs.current.delete(name);
                  }}
                  onClick={() => setSelected(isSelected ? null : name)}
                  className="rq-mono"
                  style={{
                    textAlign: 'left',
                    fontSize: 11,
                    padding: '6px 10px',
                    borderRadius: 'var(--r-sm)',
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--line-subtle)'}`,
                    background: isSelected ? 'var(--accent-wash)' : 'var(--bg-inset)',
                    color: isSelected ? 'var(--accent)' : 'var(--text-mid)',
                    opacity: isDimmed ? 0.35 : 1,
                    cursor: 'pointer',
                    transition: 'opacity var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)',
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 'var(--s-6)' }}>
        {selected ? (
          <div
            style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--line-subtle)',
              borderRadius: 'var(--r-lg)',
              padding: 'var(--s-6)',
              boxShadow: 'var(--shadow-panel)',
            }}
          >
            <ModelDetail modelName={selected} />
          </div>
        ) : (
          <p style={{ fontSize: 'var(--t-sm)', color: 'var(--text-lo)', textAlign: 'center', padding: 'var(--s-8) 0' }}>
            Click a node above to see its SQL, tests, description, and row count.
          </p>
        )}
      </div>
    </div>
  );
}
