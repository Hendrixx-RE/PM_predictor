from __future__ import annotations

from pathlib import Path

import joblib
import matplotlib.pyplot as plt
import pandas as pd
import shap

from .config import FEATURE_TABLE_NAME, MODELS_DIR, PLOTS_DIR, PROCESSED_DIR, TARGET_COLUMN, ensure_directories
from .modeling import chronological_split
from .visualization import plot_predicted_vs_actual, plot_residual_distribution


def save_feature_importance_bar(model, features: list[str], output_path: Path, top_k: int = 15) -> None:
    importance = (
        pd.DataFrame({"feature": features, "importance": model.feature_importances_})
        .sort_values("importance", ascending=False)
        .head(top_k)
        .sort_values("importance", ascending=True)
    )

    plt.figure(figsize=(9, 6))
    plt.barh(importance["feature"], importance["importance"], color="#2C6FB7")
    plt.xlabel("Importance")
    plt.title("Top Feature Importance")
    plt.tight_layout()
    plt.savefig(output_path, dpi=160)
    plt.close()


def save_monthly_bar(results: pd.DataFrame, output_path: Path) -> None:
    monthly = (
        results.groupby("time", as_index=False)
        .agg(actual=("actual", "mean"), predicted=("predicted", "mean"))
        .sort_values("time")
    )
    monthly["label"] = pd.to_datetime(monthly["time"]).dt.strftime("%Y-%m")

    plt.figure(figsize=(12, 5))
    x = range(len(monthly))
    width = 0.42
    plt.bar([i - width / 2 for i in x], monthly["actual"], width=width, label="Actual", color="#2C6FB7")
    plt.bar([i + width / 2 for i in x], monthly["predicted"], width=width, label="Predicted", color="#F28E2B")
    plt.xticks(list(x), monthly["label"], rotation=45, ha="right")
    plt.ylabel("PM2.5")
    plt.title("Monthly Actual vs Predicted PM2.5")
    plt.legend()
    plt.tight_layout()
    plt.savefig(output_path, dpi=160)
    plt.close()


def save_shap_assets(model, X: pd.DataFrame, output_dir: Path, top_k_dependence: int = 4) -> None:
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X)

    plt.figure()
    shap.summary_plot(shap_values, X, plot_type="bar", show=False, max_display=15)
    plt.tight_layout()
    plt.savefig(output_dir / "shap_summary_bar.png", dpi=160, bbox_inches="tight")
    plt.close()

    plt.figure()
    shap.summary_plot(shap_values, X, show=False, max_display=15)
    plt.tight_layout()
    plt.savefig(output_dir / "shap_beeswarm.png", dpi=160, bbox_inches="tight")
    plt.close()

    shap_importance = pd.Series(abs(shap_values).mean(axis=0), index=X.columns).sort_values(ascending=False)
    top_features = shap_importance.head(top_k_dependence).index.tolist()

    for feature in top_features:
        plt.figure()
        shap.dependence_plot(feature, shap_values, X, show=False, interaction_index=None)
        plt.tight_layout()
        safe_name = feature.replace("/", "_").replace("\\", "_")
        plt.savefig(output_dir / f"shap_dependence_{safe_name}.png", dpi=160, bbox_inches="tight")
        plt.close()


def main() -> None:
    ensure_directories()
    report_dir = PLOTS_DIR / "report_assets"
    report_dir.mkdir(parents=True, exist_ok=True)

    frame = pd.read_parquet(PROCESSED_DIR / FEATURE_TABLE_NAME).sort_values("time").reset_index(drop=True)
    model = joblib.load(MODELS_DIR / "pm25_xgboost.joblib")
    features: list[str] = joblib.load(MODELS_DIR / "feature_columns.joblib")
    splits = chronological_split(frame)

    test_frame = splits.test.copy()
    X_test = test_frame[features]
    pred = model.predict(X_test)
    results = pd.DataFrame(
        {
            "time": test_frame["time"].values,
            "actual": test_frame[TARGET_COLUMN].values,
            "predicted": pred,
        }
    )

    plot_predicted_vs_actual(results, report_dir / "regression_actual_vs_predicted.png")
    plot_residual_distribution(results, report_dir / "residual_distribution.png")
    save_feature_importance_bar(model, features, report_dir / "feature_importance_bar.png")
    save_monthly_bar(results, report_dir / "monthly_actual_vs_predicted.png")
    save_shap_assets(model, X_test.head(min(300, len(X_test))).reset_index(drop=True), report_dir)

    print(f"Saved report assets to {report_dir}")
    print("Generated:")
    print("- regression_actual_vs_predicted.png")
    print("- residual_distribution.png")
    print("- feature_importance_bar.png")
    print("- monthly_actual_vs_predicted.png")
    print("- shap_summary_bar.png")
    print("- shap_beeswarm.png")
    print("- shap_dependence_<feature>.png")


if __name__ == "__main__":
    main()
