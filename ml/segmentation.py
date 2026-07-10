"""
ml/segmentation.py
──────────────────────────────────────────────────────────────────────────────
MODEL 1 of 2: Customer Segmentation

Question answered: "Who are our customers, and what makes each group distinct?"

Two methods run independently on the same data, then compared:
  A) RFM scoring (already in mart_rfm — rule-based quintiles from SQL)
  B) K-Means clustering (data-driven — algorithm finds natural groups)

The comparison is the insight. Where they agree, the rules are validated.
Where they disagree, the data is telling you something the rules missed.

Outputs written to DuckDB (ml schema):
  - ml.kmeans_segments      one row per customer with cluster label
  - ml.segment_economics    one row per segment with avg LTV, size, recency

Metrics saved to:
  - ml/outputs/segmentation_metrics.json   silhouette score, k choice, alignment

Run from repo root:
    python ml/segmentation.py
"""
import os
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"

import argparse
import json
import sys
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import MiniBatchKMeans


# ── Constants ─────────────────────────────────────────────────────────────────

N_CLUSTERS    = 5      # matches RFM quintile logic — validated via elbow plot
RANDOM_STATE  = 42
MIN_ROWS      = 100    # skip ML gracefully on toy data

OUTPUT_DIR    = Path("ml/outputs")


# ── Data loading ──────────────────────────────────────────────────────────────

def load_rfm(con: duckdb.DuckDBPyConnection) -> pd.DataFrame:
    """
    Load mart_rfm — the pre-computed customer feature table from DuckDB.
    One row per customer_unique_id with R, F, M metrics and quintile scores.
    """
    return con.execute("""
        SELECT
            customer_unique_id,
            recency_days,
            frequency,
            monetary_value,
            r_score,
            f_score,
            m_score,
            rfm_score,
            rfm_segment
        FROM main_marts.mart_rfm
    """).fetchdf()


# ── Elbow analysis: choose k ───────────────────────────────────────────────────

def elbow_analysis(X: np.ndarray, k_range: range) -> dict:
    """
    Compute inertia (within-cluster sum of squares) for k=2..10.
    The "elbow" — where adding more clusters gives diminishing returns — is k.

    We compute this programmatically (the elbow is the k where the second
    derivative of inertia is maximised), then cross-check with silhouette scores.

    Uses MiniBatchKMeans here (approximate, fast) purely to find a good k.
    The final production clustering in run_kmeans() still uses full KMeans —
    exploratory search can be approximate, the deliverable output can't.
    """

    inertias    = {}
    silhouettes = {}

    for k in k_range:
        print(f"    fitting k={k}...", flush=True)
        km = MiniBatchKMeans(n_clusters=k, random_state=RANDOM_STATE, n_init=3, batch_size=2048)
        labels = km.fit_predict(X)
        inertias[k] = round(km.inertia_, 2)
        if k > 1:
            silhouettes[k] = round(silhouette_score(X, labels), 4)

    # Find elbow: k where second derivative of inertia is largest
    ks = sorted(inertias.keys())
    inertia_vals = [inertias[k] for k in ks]
    if len(ks) >= 3:
        second_deriv = [
            inertia_vals[i-1] - 2*inertia_vals[i] + inertia_vals[i+1]
            for i in range(1, len(ks)-1)
        ]
        elbow_k = ks[1 + second_deriv.index(max(second_deriv))]
    else:
        elbow_k = N_CLUSTERS

    return {
        "inertias":    inertias,
        "silhouettes": silhouettes,
        "elbow_k":     elbow_k,
    }


# ── K-Means fitting ───────────────────────────────────────────────────────────

def run_kmeans(df: pd.DataFrame, k: int) -> tuple[pd.DataFrame, dict]:
    """
    Fit K-Means on standardised RFM features.

    Why standardise (StandardScaler)?
    K-Means uses Euclidean distance. Without scaling, monetary_value
    (hundreds of BRL) drowns out frequency (single digits). Scaling puts
    all three dimensions on equal footing.

    Cluster labelling: inspect centroids after fitting, rank by composite
    "quality score" (high spend, high frequency, low recency = best),
    then assign human labels matching the RFM playbook.
    """
    FEATURE_COLS = ["recency_days", "frequency", "monetary_value"]

    scaler = StandardScaler()
    X      = scaler.fit_transform(df[FEATURE_COLS])

    km     = KMeans(n_clusters=k, random_state=RANDOM_STATE, n_init=10)
    labels = km.fit_predict(X)

    sil_score = round(silhouette_score(X, labels), 4)

    # Decode centroids back to original scale for interpretability
    centroids = pd.DataFrame(
        scaler.inverse_transform(km.cluster_centers_),
        columns=FEATURE_COLS
    )
    # Composite quality: high frequency + high monetary + LOW recency = best
    max_monetary = centroids["monetary_value"].max() or 1
    max_recency  = centroids["recency_days"].max() or 1
    centroids["quality_score"] = (
        centroids["frequency"] * 2
        + centroids["monetary_value"] / max_monetary
        - centroids["recency_days"]   / max_recency
    )

    # Segment names scale to whatever k was actually chosen — always anchor
    # the worst and best clusters to Hibernating/Champions regardless of k,
    # and space the names in between evenly across the quality spectrum.
    BASE_NAMES = ["Hibernating", "At Risk", "Need Attention",
                  "Potential Loyalists", "Loyal Customers", "Champions"]

    def names_for_k(k: int) -> list[str]:
        if k <= len(BASE_NAMES):
            idx = np.linspace(0, len(BASE_NAMES) - 1, k)
            return [BASE_NAMES[round(i)] for i in idx]
        return [f"Segment {i+1}" for i in range(k)]

    quality_rank = centroids["quality_score"].rank(method="first").astype(int) - 1
    segment_names = names_for_k(k)
    cluster_to_name = {
        cluster_id: segment_names[rank]
        for cluster_id, rank in quality_rank.items()
    }

    df = df.copy()
    df["kmeans_cluster"]    = labels
    df["kmeans_segment"]    = df["kmeans_cluster"].map(cluster_to_name)
    df["kmeans_silhouette"] = sil_score

    metrics = {
        "silhouette_score": sil_score,
        "k":                k,
        "centroids": centroids[FEATURE_COLS + ["quality_score"]].round(2).to_dict(),
    }

    return df, metrics


# ── RFM vs K-Means alignment ──────────────────────────────────────────────────

def compute_alignment(df: pd.DataFrame) -> dict:
    """
    Cross-tabulate RFM segment labels vs K-Means segment labels.
    Agreement rate = % of customers where both methods assign the same label.
    Disagreement highlights where rule-based buckets miss data structure.
    """
    cross = pd.crosstab(df["rfm_segment"], df["kmeans_segment"])
    total = len(df)

    # Agreement: customers where both methods used the same label name
    label_intersection = set(df["rfm_segment"].unique()) & set(df["kmeans_segment"].unique())
    agreed = sum(
        cross.loc[label, label]
        for label in label_intersection
        if label in cross.index and label in cross.columns
    )
    agreement_rate = round(agreed / total * 100, 1) if total > 0 else 0.0

    return {
        "agreement_rate_pct": agreement_rate,
        "cross_tab":          cross.to_dict(),
    }


# ── Segment economics ─────────────────────────────────────────────────────────

def build_segment_economics(df: pd.DataFrame) -> pd.DataFrame:
    """
    Aggregate economics per K-Means segment — this is what the dashboard
    segment cards display (avg LTV, customer count, share of revenue).
    """
    total_revenue = df["monetary_value"].sum() or 1
    total_customers = len(df)

    econ = (
        df.groupby("kmeans_segment")
          .agg(
              customer_count  =("customer_unique_id", "count"),
              avg_recency_days=("recency_days",        "mean"),
              avg_orders      =("frequency",           "mean"),
              avg_ltv         =("monetary_value",      "mean"),
              total_revenue   =("monetary_value",      "sum"),
          )
          .round(2)
          .reset_index()
    )
    econ["pct_of_customers"] = (econ["customer_count"] / total_customers * 100).round(1)
    econ["pct_of_revenue"]   = (econ["total_revenue"]  / total_revenue   * 100).round(1)
    return econ.sort_values("avg_ltv", ascending=False)


# ── Write to DuckDB ───────────────────────────────────────────────────────────

def write_outputs(con, df_segments: pd.DataFrame, df_economics: pd.DataFrame) -> None:
    con.execute("CREATE SCHEMA IF NOT EXISTS ml")

    seg_out = df_segments[[
        "customer_unique_id",
        "recency_days", "frequency", "monetary_value",
        "r_score", "f_score", "m_score", "rfm_score",
        "rfm_segment",
        "kmeans_cluster", "kmeans_segment", "kmeans_silhouette",
    ]]
    con.execute("CREATE OR REPLACE TABLE ml.kmeans_segments AS SELECT * FROM seg_out")
    print(f"  ✓  ml.kmeans_segments        ({len(seg_out):,} rows)")

    con.execute("CREATE OR REPLACE TABLE ml.segment_economics AS SELECT * FROM df_economics")
    print(f"  ✓  ml.segment_economics      ({len(df_economics)} rows)")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-path", type=Path, default=Path("warehouse/retailiq.duckdb"))
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"\n{'─'*60}")
    print(f"  RetailIQ — Segmentation (Model 1 of 2)")
    print(f"{'─'*60}\n")

    con = duckdb.connect(str(args.db_path))
    df  = load_rfm(con)
    print(f"  Loaded {len(df):,} customers from mart_rfm\n")

    if len(df) < MIN_ROWS:
        print(f"  ⚠  Only {len(df)} rows — need {MIN_ROWS}+ for meaningful clustering.")
        print("  Writing placeholder outputs. Run against full Olist data for real results.\n")
        df["kmeans_cluster"]    = 0
        df["kmeans_segment"]    = df["rfm_segment"]
        df["kmeans_silhouette"] = 0.0
        econ = build_segment_economics(df)
        write_outputs(con, df, econ)
        con.close()
        return

    # ── Elbow analysis ────────────────────────────────────────────────────────
    print("  Step 1 — Elbow analysis (choosing k)")
    from sklearn.preprocessing import StandardScaler
    scaler = StandardScaler()
    X = scaler.fit_transform(df[["recency_days", "frequency", "monetary_value"]])
    elbow = elbow_analysis(X, range(2, 11))
    best_k = elbow["elbow_k"]
    print(f"  Elbow method suggests k = {best_k}")
    print(f"  Silhouette scores: {elbow['silhouettes']}")

    # Use N_CLUSTERS if elbow result is same (typical for k=5 RFM alignment)
    k = best_k
    print(f"  → Using k = {k}\n")

    # ── K-Means ───────────────────────────────────────────────────────────────
    print("  Step 2 — K-Means clustering")
    df_seg, km_metrics = run_kmeans(df, k)
    print(f"  Silhouette score: {km_metrics['silhouette_score']}  (>0.3 = reasonable separation)")

    print("\n  Cluster summary (centroids in original scale):")
    for seg in df_seg.groupby("kmeans_segment")[["recency_days","frequency","monetary_value"]].mean().round(1).itertuples():
        print(f"    {seg.Index:<22} recency={seg.recency_days:>6.0f}d  freq={seg.frequency:.1f}  monetary=R${seg.monetary_value:>7.2f}")

    # ── Alignment ─────────────────────────────────────────────────────────────
    print("\n  Step 3 — Alignment: RFM rules vs K-Means discovery")
    alignment = compute_alignment(df_seg)
    print(f"  Agreement rate (same label): {alignment['agreement_rate_pct']}%")
    print("  Cross-tabulation (RFM rows × K-Means cols):")
    ct = pd.DataFrame(alignment["cross_tab"]).fillna(0).astype(int)
    print(ct.to_string())

    # ── Segment economics ─────────────────────────────────────────────────────
    print("\n  Step 4 — Segment economics")
    econ = build_segment_economics(df_seg)
    print(econ[["kmeans_segment","customer_count","avg_ltv","total_revenue","pct_of_revenue"]].to_string(index=False))

    # ── Write outputs ─────────────────────────────────────────────────────────
    print("\n  Writing outputs to DuckDB...")
    write_outputs(con, df_seg, econ)

    # Save metrics JSON for the notebook and dashboard
    all_metrics = {
        "elbow": elbow,
        "kmeans": km_metrics,
        "alignment": {
            "agreement_rate_pct": alignment["agreement_rate_pct"],
        },
        "segment_economics": econ.to_dict(orient="records"),
    }
    metrics_path = OUTPUT_DIR / "segmentation_metrics.json"
    with open(metrics_path, "w") as f:
        json.dump(all_metrics, f, indent=2, default=str)
    print(f"  ✓  {metrics_path}")

    con.close()
    print(f"\n{'─'*60}")
    print(f"  Segmentation complete. k={k}, silhouette={km_metrics['silhouette_score']}")
    print(f"{'─'*60}\n")


if __name__ == "__main__":
    main()
