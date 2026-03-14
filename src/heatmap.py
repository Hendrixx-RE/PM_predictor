from __future__ import annotations

import argparse

import joblib
import pandas as pd

from .config import FEATURE_TABLE_NAME, MODELS_DIR, PLOTS_DIR, PROCESSED_DIR, ensure_directories
from .visualization import plot_heatmap


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate PM2.5 heatmap for Pune.")
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--month", type=int, required=True)
    parser.add_argument("--mode", choices=["actual", "predicted"], default="predicted")
    return parser.parse_args()


def main() -> None:
    ensure_directories()
    args = parse_args()
    frame = pd.read_parquet(PROCESSED_DIR / FEATURE_TABLE_NAME)
    subset = frame[(frame["year"] == args.year) & (frame["month"] == args.month)].copy()

    if subset.empty:
        raise ValueError("Requested year/month not found in processed feature table.")

    value_column = "pm25"
    title = f"Actual PM2.5 Heatmap for Pune ({args.year}-{args.month:02d})"

    if args.mode == "predicted":
        model = joblib.load(MODELS_DIR / "pm25_xgboost.joblib")
        features = joblib.load(MODELS_DIR / "feature_columns.joblib")
        subset["predicted_pm25"] = model.predict(subset[features])
        value_column = "predicted_pm25"
        title = f"Predicted PM2.5 Heatmap for Pune ({args.year}-{args.month:02d})"

    output_path = PLOTS_DIR / f"heatmap_{args.mode}_{args.year}_{args.month:02d}.png"
    plot_heatmap(subset, value_column=value_column, title=title, output_path=output_path)
    print(f"Saved heatmap to {output_path}")


if __name__ == "__main__":
    main()
