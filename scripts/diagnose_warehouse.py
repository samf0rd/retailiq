"""
scripts/diagnose_warehouse.py
──────────────────────────────────────────────────────────────────────────────
One-shot health check for the DuckDB warehouse. Run this any time the
dashboard shows empty data or "Warehouse unavailable" and you're not sure
whether the problem is the data, the API, or the frontend.

Run from repo root:
    python scripts/diagnose_warehouse.py
"""
import duckdb

DB_PATH = "warehouse/retailiq.duckdb"

con = duckdb.connect(DB_PATH, read_only=True)

print(f"\n{'─'*70}\n  Warehouse: {DB_PATH}\n{'─'*70}\n")

# ── 1. What schemas/tables actually exist ───────────────────────────────────
print("Schemas & tables:")
tables = con.execute("""
    select table_schema, table_name
    from information_schema.tables
    where table_schema not in ('information_schema', 'pg_catalog')
    order by 1, 2
""").fetchdf()
print(tables.to_string(index=False))

# ── 2. Row counts for every mart + ml table (catches "exists but empty") ───
print(f"\n{'─'*70}\nRow counts:\n")
for _, row in tables.iterrows():
    schema, name = row["table_schema"], row["table_name"]
    try:
        n = con.execute(f"select count(*) from {schema}.{name}").fetchone()[0]
        print(f"  {schema}.{name:<28} {n:>8,} rows")
    except Exception as e:
        print(f"  {schema}.{name:<28} ERROR: {e}")

# ── 3. Run the EXACT query the API uses for /api/revenue ───────────────────
print(f"\n{'─'*70}\nSimulating GET /api/revenue (no filters):\n")
try:
    df = con.execute("""
        select
            strftime(order_month, '%Y-%m') as order_month,
            category_name_en, order_count, item_count, product_revenue,
            freight_revenue, gross_revenue, avg_item_price, total_gross_revenue,
            total_orders, revenue_share_pct, prev_month_revenue, cumulative_revenue,
            cumulative_total_revenue, category_rank_in_month, mom_growth_pct,
            is_top3_category
        from main_marts.mart_revenue
        where 1=1
        order by order_month, category_rank_in_month
    """).fetchdf()
    print(f"  Rows returned: {len(df)}")
    if len(df) > 0:
        print(f"  order_month sample values: {df['order_month'].unique()[:5].tolist()}")
        print(f"\n{df.head(3).to_string(index=False)}")
    else:
        print("  ⚠  Zero rows — the query itself filters everything out, "
              "even though the table has data. Check the WHERE clause / column types.")
except Exception as e:
    print(f"  ⚠  Query failed: {e}")

print(f"\n{'─'*70}\n")
con.close()
