"""
ml/diagnose_nulls.py
──────────────────────────────────────────────────────────────────────────────
One-off diagnostic: find out exactly which rows in mart_rfm have NaN values
and why, before deciding how to fix it.

Run from repo root:
    python ml/diagnose_nulls.py
"""

import duckdb

con = duckdb.connect("warehouse/retailiq.duckdb")
df = con.execute("SELECT * FROM main_marts.mart_rfm").fetchdf()

print(f"Total rows in mart_rfm: {len(df):,}\n")

print("NaN counts per column:")
print(df[["recency_days", "frequency", "monetary_value"]].isna().sum())
print()

nan_rows = df[df[["recency_days", "frequency", "monetary_value"]].isna().any(axis=1)]
print(f"Rows with at least one NaN: {len(nan_rows)}\n")

if len(nan_rows) > 0:
    print("Sample of affected rows:")
    print(nan_rows.head(10).to_string())
    print()

    # Check: do these customers have any orders at all?
    sample_ids = nan_rows["customer_unique_id"].head(5).tolist()
    print("Cross-checking these customers against int_orders_enriched:")
    ids_sql = ", ".join(f"'{i}'" for i in sample_ids)
    check = con.execute(f"""
        SELECT customer_unique_id, order_id, order_status, purchased_at
        FROM main_intermediate.int_orders_enriched
        WHERE customer_unique_id IN ({ids_sql})
    """).fetchdf()
    print(check.to_string())

con.close()
