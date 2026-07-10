#!/usr/bin/env node
/**
 * dashboard/scripts/bundle-models.mjs
 * ----------------------------------------------------------------------------
 * Prebuild step (PRD §7.3) — the dbt model `.sql` files are the source of
 * truth for the SQL shown in <SqlDrawer> and the Methodology page. This
 * script copies them into a bundled JSON at build time so the browser reads
 * a static file, never a live database connection:
 *
 *   1. Walk dbt/models/{staging,intermediate,marts}/*.sql — the SQL text.
 *   2. Parse each directory's schema.yml (js-yaml) — model descriptions and
 *      dbt tests (unique / not_null / accepted_values / relationships).
 *   3. Regex-extract every {{ ref('x') }} / {{ source('raw','x') }} call in
 *      each model's SQL to build the lineage graph (edges, not just a flat
 *      list) — this also feeds the Methodology page's DAG (R4).
 *   4. Detect the "showcase" SQL construct per model (window functions,
 *      NTILE, CORR, PERCENTILE_CONT, gap-and-island row_number() streaks)
 *      by scanning for known keywords, and record which lines to highlight.
 *   5. Shell out to `python scripts/rowcounts.py` (repo root) for row
 *      counts — a one-shot DuckDB query. Kept in Python rather than adding
 *      a native `duckdb` Node dependency, since the Python venv already
 *      has `duckdb` installed for the FastAPI layer (api/main.py).
 *
 * Output: dashboard/generated/models.json, shape:
 *   { [model_name]: { layer, sql, description, tests[], lineage: {ref[], source[]}, rowcount, highlight } }
 *
 * Run via `npm run prebuild` (wired into package.json's `prebuild` hook,
 * which npm runs automatically before `npm run build`).
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const MODELS_ROOT = join(REPO_ROOT, 'dbt', 'models');
const OUT_DIR = join(__dirname, '..', 'generated');
const OUT_FILE = join(OUT_DIR, 'models.json');

const LAYERS = [
  { dir: 'staging', layer: 'staging' },
  { dir: 'intermediate', layer: 'intermediate' },
  { dir: 'marts', layer: 'mart' },
];

// ── Step 5 helper: row counts via the Python venv's DuckDB connection ──────
function getRowCounts() {
  const candidates = [
    join(REPO_ROOT, '.venv', 'Scripts', 'python.exe'), // Windows venv
    join(REPO_ROOT, '.venv', 'bin', 'python'), // POSIX venv
    'python',
  ];
  for (const py of candidates) {
    try {
      const out = execFileSync(py, [join(REPO_ROOT, 'scripts', 'rowcounts.py')], {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
      });
      return JSON.parse(out.trim());
    } catch {
      continue;
    }
  }
  console.warn('[bundle-models] could not run scripts/rowcounts.py with any candidate Python — row counts will be null');
  return {};
}

// ── Step 3: lineage — every ref()/source() call in a model's SQL ───────────
function extractLineage(sql) {
  const refs = [...sql.matchAll(/\{\{\s*ref\(\s*['"]([\w]+)['"]\s*\)\s*\}\}/g)].map((m) => m[1]);
  const sources = [...sql.matchAll(/\{\{\s*source\(\s*['"]([\w]+)['"]\s*,\s*['"]([\w]+)['"]\s*\)\s*\}\}/g)].map(
    (m) => `${m[1]}.${m[2]}`
  );
  return { ref: [...new Set(refs)], source: [...new Set(sources)] };
}

// ── Step 4: showcase construct detection — one per model, first match wins,
// ordered by "most advanced technique first" so e.g. a model with both a
// window function AND NTILE gets credited for the rarer one. Each entry's
// `test` matches the construct; `lineFilter` finds the specific line(s) to
// highlight in the drawer; `note` is the margin note shown next to it. ────
const SHOWCASE_CONSTRUCTS = [
  {
    id: 'gap-and-island',
    test: /row_number\(\)\s*over[\s\S]{0,400}?row_number\(\)\s*over/i,
    lineFilter: (line) => /row_number\(\)\s*over/i.test(line) || /\brn_\w+\s*-\s*rn_\w+/i.test(line) || /group by[\s\S]*\brn_/i.test(line),
    note: 'Gap-and-island — two row_number() calls (global position vs. position within the flagged subgroup); their difference is constant for each consecutive run, so GROUP BY on that difference isolates each streak without a procedural loop.',
  },
  {
    id: 'ntile',
    test: /ntile\s*\(/i,
    lineFilter: (line) => /ntile\s*\(/i.test(line),
    note: 'NTILE(n) — splits ranked rows into n equal-sized buckets (quintiles here) in one pass, the SQL-native way to do quantile bucketing.',
  },
  {
    id: 'percentile_cont',
    test: /percentile_cont\s*\(/i,
    lineFilter: (line) => /percentile_cont\s*\(/i.test(line),
    note: 'PERCENTILE_CONT — interpolated percentile (median, p95) computed inside the database, no client-side sort required.',
  },
  {
    id: 'corr',
    test: /\bcorr\s*\(/i,
    lineFilter: (line) => /\bcorr\s*\(/i.test(line),
    note: "CORR() — Pearson correlation as a single aggregate function; the database computes the statistic directly rather than the app pulling rows to compute it.",
  },
  {
    id: 'percent_rank',
    test: /percent_rank\s*\(/i,
    lineFilter: (line) => /percent_rank\s*\(/i.test(line),
    note: 'PERCENT_RANK() — relative standing (0-1) within a partition, one window function instead of a manual count/total division.',
  },
  {
    id: 'rank',
    test: /\brank\s*\(\s*\)\s*over/i,
    lineFilter: (line) => /\brank\s*\(\s*\)\s*over/i.test(line),
    note: 'RANK() OVER — ranks rows within a partition (e.g. category-within-month), ties handled natively instead of a manual tie-break.',
  },
  {
    id: 'window-lag-sum',
    test: /\blag\s*\(|sum\s*\([\w.]+\)\s*over/i,
    lineFilter: (line) => /\blag\s*\(|sum\s*\([\w.]+\)\s*over/i.test(line),
    note: 'LAG()/SUM() OVER — period-over-period comparison and running totals computed with window functions, no self-join required.',
  },
];

// Detection ignores full-line SQL comments (`-- ...`) — every model's header
// comment narrates ALL the techniques it uses (including ones "shown in
// mart_x" for a related model, as mart_cohorts's header does for NTILE), so
// matching comment text produces false positives on techniques the model
// only mentions, never actually runs.
function stripCommentLines(sqlLines) {
  return sqlLines.map((line) => (line.trim().startsWith('--') ? '' : line));
}

function detectShowcase(sqlLines) {
  const codeLines = stripCommentLines(sqlLines);
  const code = codeLines.join('\n');
  for (const construct of SHOWCASE_CONSTRUCTS) {
    if (construct.test.test(code)) {
      const lines = [];
      codeLines.forEach((line, i) => {
        if (construct.lineFilter(line)) lines.push(i + 1); // 1-indexed for display
      });
      if (lines.length > 0) {
        return { id: construct.id, note: construct.note, lines };
      }
    }
  }
  return null;
}

// ── Steps 1-2: walk each layer dir, read SQL + parse schema.yml ────────────
function loadLayerModels(dirName, layer) {
  const dirPath = join(MODELS_ROOT, dirName);
  const files = readdirSync(dirPath).filter((f) => f.endsWith('.sql'));

  let schemaDocs = {};
  const yamlCandidates = readdirSync(dirPath).filter((f) => f.endsWith('.yml'));
  for (const yf of yamlCandidates) {
    const parsed = yaml.load(readFileSync(join(dirPath, yf), 'utf-8'));
    for (const m of parsed?.models ?? []) {
      schemaDocs[m.name] = m;
    }
  }

  const models = {};
  for (const file of files) {
    const name = file.replace(/\.sql$/, '');
    const sql = readFileSync(join(dirPath, file), 'utf-8');
    const doc = schemaDocs[name];
    const tests = (doc?.columns ?? []).flatMap((col) =>
      (col.tests ?? []).map((t) => {
        if (typeof t === 'string') return { name: t, column: col.name };
        const testName = Object.keys(t)[0];
        return { name: testName, column: col.name, config: t[testName] };
      })
    );

    models[name] = {
      layer,
      sql,
      description: (doc?.description ?? '').trim(),
      tests,
      lineage: extractLineage(sql),
      highlight: detectShowcase(sql.split('\n')),
      rowcount: null, // filled in below
    };
  }
  return models;
}

// ── Raw sources — the DAG's 9 root nodes (dbt/models/staging/sources.yml).
// These aren't dbt models (no SQL, dbt doesn't "run" them), so they get a
// lighter record: description + column tests from the YAML, no sql/lineage/
// highlight. Bundled anyway so the Methodology page's DAG (R4) has real
// descriptions for its root column instead of bare table names.
function loadRawSources() {
  const sourcesPath = join(MODELS_ROOT, 'staging', 'sources.yml');
  if (!existsSync(sourcesPath)) return {};
  const parsed = yaml.load(readFileSync(sourcesPath, 'utf-8'));
  const rawSource = (parsed?.sources ?? []).find((s) => s.name === 'raw');
  if (!rawSource) return {};

  const sources = {};
  for (const table of rawSource.tables ?? []) {
    const tests = (table.columns ?? []).flatMap((col) =>
      (col.tests ?? []).map((t) => {
        if (typeof t === 'string') return { name: t, column: col.name };
        const testName = Object.keys(t)[0];
        return { name: testName, column: col.name, config: t[testName] };
      })
    );
    sources[`raw.${table.name}`] = {
      layer: 'raw',
      sql: null,
      description: (table.description ?? '').trim(),
      tests,
      lineage: { ref: [], source: [] },
      rowcount: null, // filled in below, keyed by bare table name
      highlight: null,
      _rowcountKey: table.name,
    };
  }
  return sources;
}

function main() {
  const rowCounts = getRowCounts();
  let models = { ...loadRawSources() };
  for (const { dir, layer } of LAYERS) {
    models = { ...models, ...loadLayerModels(dir, layer) };
  }

  for (const [name, model] of Object.entries(models)) {
    const key = model._rowcountKey ?? name;
    model.rowcount = rowCounts[key] ?? null;
    delete model._rowcountKey;
  }

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(models, null, 2));
  console.log(`[bundle-models] wrote ${Object.keys(models).length} models to ${OUT_FILE}`);
}

main();
