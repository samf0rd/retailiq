"""
ml/propensity.py
──────────────────────────────────────────────────────────────────────────────
MODEL 2 of 2: Repeat-Purchase Propensity

Question answered: "Which customers are most likely to place a second order,
and is it worth spending retention budget on them?"

Prediction setup:
  - Target: did customer place ≥ 2 orders? (binary 0/1)
  - Features: extracted from their FIRST ORDER ONLY
    (simulates standing at the moment of first purchase, making a forward call)
  - Training data: all customers where we know the ground truth

Why first-order features only?
  In production this model fires the moment a customer completes order #1.
  You don't have order #2 yet — that's what you're predicting. Using future
  order data to predict future orders is data leakage and produces invalid results.

Three models compared, winner selected by ROC-AUC + interpretability:
  1. Logistic Regression  — the interpretable baseline
  2. Random Forest        — handles non-linearity, clean feature importance
  3. XGBoost              — highest raw accuracy, SHAP for explainability

Business output:
  - Per-customer propensity score (0.0–1.0)
  - Propensity tier: Low / Medium / High / Very High
  - Retention target table: how many customers per tier, avg first-order value

Outputs written to DuckDB (ml schema):
  - ml.repeat_propensity    per-customer scores
  - ml.retention_targets    aggregated decision table

Metrics saved to:
  - ml/outputs/propensity_metrics.json   ROC-AUC comparison, feature importance

Run from repo root:
    python ml/propensity.py
"""

import argparse
import json
import sys
import warnings
from pathlib import Path
from scipy import optimize
warnings.filterwarnings("ignore", category=optimize.OptimizeWarning)

import duckdb
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    classification_report,
    roc_auc_score,
)
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier


OUTPUT_DIR   = Path("ml/outputs")
RANDOM_STATE = 42
MIN_ROWS     = 100
TEST_SIZE    = 0.20


# ── Feature engineering ───────────────────────────────────────────────────────

def build_first_order_features(con: duckdb.DuckDBPyConnection) -> pd.DataFrame:
    """
    Build the feature matrix using ONLY each customer's first order.

    This is the key modelling decision: we take a temporal snapshot —
    we act as if we're standing at the moment of first purchase and trying
    to predict the future. No future data is allowed in the features.

    Features chosen based on what's knowable at first-order completion:
      - first_order_value:   how much did they spend? (proxy for commitment)
      - paid_installments:   did they finance it? (suggests lower-income / big purchase)
      - delivery_delta_days: was the delivery late? (experience quality signal)
      - review_score:        how satisfied were they? (strongest retention signal)
      - approval_lag_hours:  how fast was the order approved? (operational signal)
      - payment_credit_card: binary — did they use credit card vs boleto/other?
        (credit card buyers are typically higher-income, more likely to return)
      - category_*:          one-hot encoded product category of first purchase
      - customer_state:      region (dummy encoded — some states have better logistics)

    Target:
      - is_repeat: 1 if customer placed ≥ 2 orders, 0 otherwise
    """
    return con.execute("""
        WITH
        -- All customers and their total order count
        customer_order_count AS (
            SELECT
                customer_unique_id,
                COUNT(DISTINCT order_id)    AS total_orders,
                CASE WHEN COUNT(DISTINCT order_id) >= 2 THEN 1 ELSE 0 END AS is_repeat
            FROM main_intermediate.int_orders_enriched
            WHERE order_status IN ('delivered', 'shipped', 'invoiced', 'approved')
              AND customer_unique_id IS NOT NULL
            GROUP BY customer_unique_id
        ),

        -- Each customer's first order (by purchase date)
        first_orders AS (
            SELECT
                o.customer_unique_id,
                o.order_id,
                o.purchased_at,
                o.total_payment_value           AS first_order_value,
                o.total_installments            AS paid_installments,
                o.delivery_delta_days,
                o.review_score,
                o.approval_lag_hours,
                o.primary_payment_type,
                o.customer_state,
                -- rank orders per customer by date; we'll keep rank=1 only
                ROW_NUMBER() OVER (
                    PARTITION BY o.customer_unique_id
                    ORDER BY o.purchased_at ASC
                ) AS order_rank
            FROM main_intermediate.int_orders_enriched o
            WHERE o.order_status IN ('delivered', 'shipped', 'invoiced', 'approved')
              AND o.customer_unique_id IS NOT NULL
        ),

        -- First order's product category
        first_order_categories AS (
            SELECT
                fo.customer_unique_id,
                COALESCE(oi.category_name_en, 'unknown') AS first_category
            FROM first_orders fo
            INNER JOIN main_intermediate.int_order_items_enriched oi
                ON fo.order_id = oi.order_id
            WHERE fo.order_rank = 1
            QUALIFY ROW_NUMBER() OVER (
                PARTITION BY fo.customer_unique_id
                ORDER BY oi.item_price DESC   -- if multi-item, take most expensive category
            ) = 1
        )

        SELECT
            fo.customer_unique_id,
            coc.is_repeat,                          -- TARGET

            -- ── FEATURES ──────────────────────────────────────────────────
            COALESCE(fo.first_order_value, 0)       AS first_order_value,
            COALESCE(fo.paid_installments, 1)       AS paid_installments,
            COALESCE(fo.delivery_delta_days, 0)     AS delivery_delta_days,
            COALESCE(fo.review_score, 3)            AS review_score,
            COALESCE(fo.approval_lag_hours, 0)      AS approval_lag_hours,
            CASE WHEN fo.primary_payment_type = 'credit_card' THEN 1 ELSE 0
            END                                     AS paid_credit_card,
            COALESCE(fc.first_category, 'unknown')  AS first_category,
            COALESCE(fo.customer_state, 'unknown')  AS customer_state

        FROM first_orders fo
        INNER JOIN customer_order_count coc
            ON fo.customer_unique_id = coc.customer_unique_id
        LEFT JOIN first_order_categories fc
            ON fo.customer_unique_id = fc.customer_unique_id
        WHERE fo.order_rank = 1
    """).fetchdf()


def encode_features(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """
    One-hot encode categorical features, return feature matrix and column names.

    We encode category and state because tree-based models benefit from
    explicit dummies. Logistic regression also works better with dummies
    than label-encoded categories for non-ordinal features.

    High-cardinality states (27 Brazilian states): we keep all of them —
    with 96k rows the model has enough data to learn state effects.
    High-cardinality categories (70+): we keep top 15 by frequency,
    group the rest as 'other' to avoid feature explosion.
    """
    # Cap categories: keep top 15, rest → 'other'
    top_cats = df["first_category"].value_counts().nlargest(15).index
    df = df.copy()
    df["first_category"] = df["first_category"].where(
        df["first_category"].isin(top_cats), other="other"
    )

    numeric_cols = [
        "first_order_value", "paid_installments", "delivery_delta_days",
        "review_score", "approval_lag_hours", "paid_credit_card",
    ]
    cat_cols = ["first_category", "customer_state"]

    dummies = pd.get_dummies(df[cat_cols], drop_first=True, dtype=int)
    feature_df = pd.concat([df[numeric_cols], dummies], axis=1)

    return feature_df, list(feature_df.columns)


# ── Model comparison ──────────────────────────────────────────────────────────

def compare_models(
    X_train: np.ndarray,
    X_test: np.ndarray,
    y_train: pd.Series,
    y_test: pd.Series,
    feature_names: list[str],
) -> tuple[object, dict]:
    """
    Train three classifiers. Compare by ROC-AUC on the held-out test set.
    Also run 5-fold cross-validation on training set to detect overfitting.

    Why these three:
      Logistic Regression — baseline; coefficients are directly interpretable.
        If LR matches the others, the problem is linearly separable and the
        simpler model is better.
      Random Forest — handles non-linearity, feature importance without SHAP.
        Usually the best tradeoff between performance and explainability.
      XGBoost — gradient-boosted trees; highest raw accuracy in most tabular
        problems. Samuel already knows it from Macro-Alpha. SHAP-compatible.

    Winner: highest ROC-AUC, tiebreaker = simpler model.
    """
    models = {
        "Logistic Regression": LogisticRegression(
            max_iter=1000, class_weight="balanced", random_state=RANDOM_STATE
        ),
        "Random Forest": RandomForestClassifier(
            n_estimators=200, max_depth=8, class_weight="balanced",
            random_state=RANDOM_STATE, n_jobs=-1
        ),
        "XGBoost": XGBClassifier(
            n_estimators=200, max_depth=6, learning_rate=0.05,
            scale_pos_weight=1,  # set dynamically below
            eval_metric="logloss", random_state=RANDOM_STATE,
            verbosity=0,
        ),
    }

    # XGBoost scale_pos_weight: ratio of negatives to positives for imbalance
    neg = (y_train == 0).sum()
    pos = (y_train == 1).sum()
    models["XGBoost"].set_params(scale_pos_weight=neg / max(pos, 1))

    results   = {}
    best_name = None
    best_auc  = 0.0
    best_model = None

    # Scale for LR (trees don't need it, but we scale all and it doesn't hurt RF/XGB)
    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s  = scaler.transform(X_test)

    print(f"\n  {'Model':<24} {'CV AUC (train)':>16} {'Test AUC':>10}")
    print(f"  {'─'*24} {'─'*16} {'─'*10}")

    for name, model in models.items():
        # 5-fold CV on training set
        cv_aucs = cross_val_score(
            model, X_train_s, y_train,
            cv=5, scoring="roc_auc", n_jobs=-1
        )
        model.fit(X_train_s, y_train)
        y_proba = model.predict_proba(X_test_s)[:, 1]
        test_auc = roc_auc_score(y_test, y_proba)

        results[name] = {
            "cv_auc_mean":  round(cv_aucs.mean(), 4),
            "cv_auc_std":   round(cv_aucs.std(),  4),
            "test_auc":     round(test_auc, 4),
        }
        print(f"  {name:<24} {cv_aucs.mean():.4f} ± {cv_aucs.std():.4f}  {test_auc:.4f}")

        if test_auc > best_auc:
            best_auc   = test_auc
            best_name  = name
            best_model = (model, scaler)

    print(f"\n  → Winner: {best_name} (ROC-AUC = {best_auc:.4f})")

    # Feature importance for the winning model
    winner_model, _ = best_model
    importance = extract_importance(winner_model, best_name, feature_names)
    print(f"\n  Top 10 features ({best_name}):")
    for feat, imp in list(importance.items())[:10]:
        bar = "█" * int(imp * 40)
        print(f"    {feat:<35} {imp:.4f}  {bar}")

    # Detailed report on winner
    winner_model_fitted, winner_scaler = best_model
    y_pred = winner_model_fitted.predict(scaler.transform(X_test))
    print(f"\n  Classification report ({best_name}, test set):")
    print(classification_report(y_test, y_pred, target_names=["one-time", "repeat"]))

    return best_model, {
        "model_comparison":   results,
        "winner":             best_name,
        "winner_test_auc":    best_auc,
        "feature_importance": importance,
    }


def extract_importance(model, model_name: str, feature_names: list[str]) -> dict:
    """Extract feature importance regardless of model type."""
    if model_name == "Logistic Regression":
        importances = np.abs(model.coef_[0])
    else:
        importances = model.feature_importances_

    total = importances.sum() or 1
    norm  = importances / total
    ranked = sorted(zip(feature_names, norm), key=lambda x: x[1], reverse=True)
    return {feat: round(float(imp), 5) for feat, imp in ranked[:20]}


# ── Score all customers ───────────────────────────────────────────────────────

def score_customers(
    df_features: pd.DataFrame,
    best_model: tuple,
    feature_cols: list[str],
    y: pd.Series,
) -> pd.DataFrame:
    """Apply the best model to all customers, assign propensity tier."""
    winner_model, scaler = best_model
    X_all = scaler.transform(df_features[feature_cols].values)
    scores = winner_model.predict_proba(X_all)[:, 1]

    df_out = df_features[["customer_unique_id"]].copy()  # only ID column
    df_out["is_repeat"]          = y.values
    df_out["repeat_propensity"]  = scores.round(4)
    df_out["propensity_tier"]    = pd.qcut(
        df_out["repeat_propensity"],
        q=[0, 0.50, 0.80, 0.95, 1.0],
        labels=["Low", "Medium", "High", "Very High"],
        duplicates="drop",
    ).astype(str)

    return df_out


# ── Retention decision table ──────────────────────────────────────────────────

def build_retention_targets(
    df_propensity: pd.DataFrame,
    df_raw: pd.DataFrame,
) -> pd.DataFrame:
    """
    Join propensity scores to first-order value for the business decision table.
    Answers: "If I spend €X per customer on a win-back campaign, which tier breaks even?"
    """
    df_joined = df_propensity.merge(
        df_raw[["customer_unique_id", "first_order_value"]],
        on="customer_unique_id",
        how="left",
    )

    retention = (
        df_joined.groupby("propensity_tier")
          .agg(
              customer_count       =("customer_unique_id",   "count"),
              avg_propensity_pct   =("repeat_propensity",    lambda x: round(x.mean() * 100, 1)),
              avg_first_order_value=("first_order_value",    lambda x: round(x.mean(), 2)),
              total_first_order_value=("first_order_value",  lambda x: round(x.sum(), 2)),
              already_repeated     =("is_repeat",            "sum"),
          )
          .reset_index()
          .sort_values("avg_propensity_pct", ascending=False)
    )
    return retention


# ── Write to DuckDB ───────────────────────────────────────────────────────────

def write_outputs(
    con,
    df_propensity: pd.DataFrame,
    df_retention: pd.DataFrame,
) -> None:
    con.execute("CREATE SCHEMA IF NOT EXISTS ml")

    con.execute("CREATE OR REPLACE TABLE ml.repeat_propensity   AS SELECT * FROM df_propensity")
    print(f"  ✓  ml.repeat_propensity     ({len(df_propensity):,} rows)")

    con.execute("CREATE OR REPLACE TABLE ml.retention_targets   AS SELECT * FROM df_retention")
    print(f"  ✓  ml.retention_targets     ({len(df_retention)} rows)")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-path", type=Path, default=Path("warehouse/retailiq.duckdb"))
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"\n{'─'*60}")
    print(f"  RetailIQ — Propensity Model (Model 2 of 2)")
    print(f"{'─'*60}\n")

    con = duckdb.connect(str(args.db_path))

    # ── Feature engineering ───────────────────────────────────────────────────
    print("  Step 1 — Building first-order feature matrix")
    df_raw = build_first_order_features(con)
    print(f"  {len(df_raw):,} customers × {df_raw.shape[1]} raw columns")
    repeat_rate = df_raw["is_repeat"].mean()
    print(f"  Repeat purchase rate: {repeat_rate:.1%}  (this is the base rate to beat)\n")

    if len(df_raw) < MIN_ROWS:
        print(f"  ⚠  Only {len(df_raw)} rows — skipping ML, writing placeholders.")
        df_raw["repeat_propensity"] = df_raw["is_repeat"].astype(float)
        df_raw["propensity_tier"]   = "Low"
        retention = build_retention_targets(
            df_raw[["customer_unique_id","is_repeat","repeat_propensity","propensity_tier"]],
            df_raw,
        )
        write_outputs(con, df_raw[["customer_unique_id","is_repeat","repeat_propensity","propensity_tier"]], retention)
        con.close()
        return

    # ── Encode ───────────────────────────────────────────────────────────────
    print("  Step 2 — Encoding features")
    X_df, feature_cols = encode_features(df_raw)
    print(f"  Feature matrix: {X_df.shape[0]:,} rows × {X_df.shape[1]} features")

    y = df_raw["is_repeat"]
    X_df_with_id = X_df.copy()
    X_df_with_id["customer_unique_id"] = df_raw["customer_unique_id"].values

    # Stratified split preserves the repeat-purchase class ratio in both sets
    X_train, X_test, y_train, y_test = train_test_split(
        X_df.values, y, test_size=TEST_SIZE,
        random_state=RANDOM_STATE, stratify=y
    )
    print(f"  Train: {len(y_train):,}  |  Test: {len(y_test):,}")
    print(f"  Repeat rate — train: {y_train.mean():.1%}  test: {y_test.mean():.1%}\n")

    # ── Model comparison ──────────────────────────────────────────────────────
    print("  Step 3 — Training and comparing 3 models")
    best_model, metrics = compare_models(
        X_train, X_test, y_train, y_test, feature_cols
    )

    # ── Score all customers ───────────────────────────────────────────────────
    print("\n  Step 4 — Scoring all customers")
    df_prop = score_customers(X_df_with_id, best_model, feature_cols, y)

    print("\n  Propensity tier distribution:")
    tier_summary = df_prop.groupby("propensity_tier").agg(
        n=("customer_unique_id","count"),
        avg_score=("repeat_propensity", lambda x: f"{x.mean():.1%}"),
        actual_repeat_rate=("is_repeat", lambda x: f"{x.mean():.1%}"),
    )
    print(tier_summary.to_string())

    # ── Retention decision table ──────────────────────────────────────────────
    print("\n  Step 5 — Retention target table")
    df_retention = build_retention_targets(df_prop, df_raw)
    print(df_retention.to_string(index=False))

    # ── Write outputs ─────────────────────────────────────────────────────────
    print("\n  Writing outputs to DuckDB...")
    write_outputs(con, df_prop, df_retention)

    # Save metrics JSON
    metrics_path = OUTPUT_DIR / "propensity_metrics.json"
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2, default=str)
    print(f"  ✓  {metrics_path}")

    con.close()
    print(f"\n{'─'*60}")
    print(f"  Propensity model complete.")
    print(f"  Winner: {metrics['winner']} — ROC-AUC: {metrics['winner_test_auc']}")
    print(f"{'─'*60}\n")


if __name__ == "__main__":
    main()
