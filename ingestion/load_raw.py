"""
ingestion/load_raw.py
─────────────────────────────────────────────────────────────────────────────
Loads all 9 Olist CSVs from data/raw/ into the `raw` schema of the DuckDB
warehouse (warehouse/retailiq.duckdb).

Design decisions:
  - Uses DuckDB's native read_csv_auto — faster than Pandas round-trip and
    lets DuckDB infer types directly; we'll cast/clean in dbt staging models.
  - Runs idempotently: CREATE OR REPLACE TABLE drops and reloads each time.
    This means you can re-run safely after updating CSVs.
  - Validates row counts after load and prints a summary table.

Usage (from repo root):
    python ingestion/load_raw.py

Optional flags:
    --raw-dir   path to CSV folder (default: data/raw)
    --db-path   path to DuckDB file  (default: warehouse/retailiq.duckdb)
"""

import argparse
import sys
from pathlib import Path

import duckdb


# ── Table registry ────────────────────────────────────────────────────────────
# Maps table name in the `raw` schema → CSV filename.
# Explicit mapping = no magic; easy to audit.

RAW_TABLES: dict[str, str] = {
    "orders":                   "olist_orders_dataset.csv",
    "order_items":              "olist_order_items_dataset.csv",
    "order_payments":           "olist_order_payments_dataset.csv",
    "order_reviews":            "olist_order_reviews_dataset.csv",
    "customers":                "olist_customers_dataset.csv",
    "sellers":                  "olist_sellers_dataset.csv",
    "products":                 "olist_products_dataset.csv",
    "geolocation":              "olist_geolocation_dataset.csv",
    "product_category_name_translation": "product_category_name_translation.csv",
}


def load_raw(raw_dir: Path, db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    raw_dir = raw_dir.resolve()

    print(f"\n{'─'*60}")
    print(f"  RetailIQ — Raw ingestion")
    print(f"  Source  : {raw_dir}")
    print(f"  Warehouse: {db_path}")
    print(f"{'─'*60}\n")

    # Validate all CSVs exist before touching the DB
    missing = [
        fname for fname in RAW_TABLES.values()
        if not (raw_dir / fname).exists()
    ]
    if missing:
        print("ERROR — missing CSV files:")
        for f in missing:
            print(f"  ✗  {f}")
        sys.exit(1)

    con = duckdb.connect(str(db_path))
    con.execute("CREATE SCHEMA IF NOT EXISTS raw")

    results = []

    for table_name, csv_file in RAW_TABLES.items():
        csv_path = raw_dir / csv_file
        fq_table = f"raw.{table_name}"

        print(f"  Loading  raw.{table_name:<45} ", end="", flush=True)

        con.execute(f"""
            CREATE OR REPLACE TABLE {fq_table} AS
            SELECT * FROM read_csv_auto('{csv_path}', header=true)
        """)

        row_count = con.execute(f"SELECT COUNT(*) FROM {fq_table}").fetchone()[0]
        col_count = len(con.execute(f"DESCRIBE {fq_table}").fetchall())

        results.append((table_name, row_count, col_count))
        print(f"✓  {row_count:>8,} rows  {col_count:>3} cols")

    con.close()

    # Summary
    total_rows = sum(r[1] for r in results)
    print(f"\n{'─'*60}")
    print(f"  ✓  Loaded {len(results)} tables  /  {total_rows:,} total rows")
    print(f"  Warehouse: {db_path}")
    print(f"{'─'*60}\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Load Olist CSVs into DuckDB raw schema.")
    parser.add_argument("--raw-dir", type=Path, default=Path("data/raw"),
                        help="Directory containing the 9 Olist CSV files (default: data/raw)")
    parser.add_argument("--db-path", type=Path, default=Path("warehouse/retailiq.duckdb"),
                        help="Path to the DuckDB database file (default: warehouse/retailiq.duckdb)")
    args = parser.parse_args()

    load_raw(args.raw_dir, args.db_path)


if __name__ == "__main__":
    main()
