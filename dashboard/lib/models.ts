import rawModels from '@/generated/models.json';

export type ModelLayer = 'raw' | 'staging' | 'intermediate' | 'mart';

export interface ModelTest {
  name: string;
  column: string;
  config?: unknown;
}

export interface ModelHighlight {
  id: string;
  note: string;
  lines: number[];
}

export interface BundledModel {
  layer: ModelLayer;
  sql: string | null;
  description: string;
  tests: ModelTest[];
  lineage: { ref: string[]; source: string[] };
  rowcount: number | null;
  highlight: ModelHighlight | null;
}

export const MODELS = rawModels as unknown as Record<string, BundledModel>;

export interface LineageNode {
  name: string;
  layer: ModelLayer;
}

/**
 * Single representative dependency chain from raw source to this model
 * (PRD §5.5's "raw → stg_x → int_y → THIS" strip). Takes the first ref/
 * source at each hop — a model with multiple upstream parents (e.g.
 * mart_logistics joins two intermediate models) only shows one path here;
 * the full DAG with every edge is the Methodology page's job (R4), not
 * this per-panel drawer's.
 */
export function buildLineageChain(modelName: string): LineageNode[] {
  const chain: LineageNode[] = [];
  let current: string | undefined = modelName;
  const visited = new Set<string>();

  while (current && !visited.has(current)) {
    visited.add(current);
    const entry: BundledModel | undefined = MODELS[current];
    if (!entry) break;
    chain.unshift({ name: current, layer: entry.layer });
    if (entry.lineage.ref.length > 0) {
      current = entry.lineage.ref[0];
    } else if (entry.lineage.source.length > 0) {
      current = entry.lineage.source[0]; // resolves to a raw.* entry in MODELS, itself a leaf
    } else {
      current = undefined;
    }
  }
  return chain;
}
