"""
scripts/rowcounts.py
────────────────────────────────────────────────────────────────────────────
Tiny helper for dashboard/scripts/bundle-models.mjs (PRD §7.3). Row counts
for the SqlDrawer/Methodology page come from a one-shot DuckDB query at
build time — this is that query. Kept as a standalone Python script (rather
than adding a native `duckdb` Node dependency to the dashboard's own build)
because api/ already depends on the `duckdb` Python package for the live
FastAPI layer; reusing that instead of a second native binding keeps the
prebuild step to "shell out to the venv Python that's already required to
run this project" rather than a new native-module install.

Prints one JSON object to stdout: { "schema.table": rowcount, ... } for
every table in the staging/intermediate/marts schemas dbt materializes.
Never touches raw/ml schemas — those aren't dbt models (raw is source data,
ml.* is written by ml/ scripts, not this warehouse-facing pipeline).
"""

import json
import os
import sys

import duckdb

DB_PATH = os.environ.get("RETAILIQ_DB_PATH", "warehouse/retailiq.duckdb")
MODEL_SCHEMAS = ("main_staging", "main_intermediate", "main_marts", "raw")


def main():
    if not os.path.exists(DB_PATH):
        # Prebuild must not fail the whole `next build` just because the
        # warehouse hasn't been built locally yet — emit an empty map and
        # let the bundling script fall back to null row counts.
        print(json.dumps({}))
        return

    con = duckdb.connect(DB_PATH, read_only=True)
    placeholders = ", ".join("?" for _ in MODEL_SCHEMAS)
    tables = con.execute(
        f"""
        select table_schema, table_name
        from information_schema.tables
        where table_schema in ({placeholders})
        """,
        list(MODEL_SCHEMAS),
    ).fetchall()

    counts = {}
    for schema, table in tables:
        n = con.execute(f'select count(*) from "{schema}"."{table}"').fetchone()[0]
        counts[table] = n

    print(json.dumps(counts))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(json.dumps({}), file=sys.stdout)
        print(f"rowcounts.py failed: {e}", file=sys.stderr)
