from __future__ import annotations

import argparse

import joblib
import pandas as pd

from .config import FEATURE_TABLE_NAME, MODELS_DIR, PROCESSED_DIR


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Predict PM2.5 for a Pune location and month.")
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--month", type=int, required=True)
    parser.add_argument("--lat", type=float, required=True)
    parser.add_argument("--lon", type=float, required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    frame = pd.read_parquet(PROCESSED_DIR / FEATURE_TABLE_NAME)
    model = joblib.load(MODELS_DIR / "pm25_xgboost.joblib")
    features = joblib.load(MODELS_DIR / "feature_columns.joblib")

    subset = frame[(frame["year"] == args.year) & (frame["month"] == args.month)].copy()
    if subset.empty:
        raise ValueError("Requested year/month not found in processed feature table.")

    subset["distance_to_query"] = ((subset["latitude"] - args.lat) ** 2 + (subset["longitude"] - args.lon) ** 2) ** 0.5
    row = subset.sort_values("distance_to_query").iloc[0]

    predicted_pm25 = float(model.predict(pd.DataFrame([row[features]]))[0])
    actual_pm25 = float(row["pm25"])
    absolute_error = abs(predicted_pm25 - actual_pm25)
    percentage_error = (absolute_error / actual_pm25 * 100.0) if actual_pm25 != 0 else float("nan")
    approximate_accuracy = (100.0 - percentage_error) if actual_pm25 != 0 else float("nan")

    print("Prediction summary")
    print(f"Requested location: lat={args.lat:.4f}, lon={args.lon:.4f}")
    print(f"Nearest grid cell: lat={row['latitude']:.4f}, lon={row['longitude']:.4f}")
    print(f"Requested month: {args.year}-{args.month:02d}")
    print(f"Predicted PM2.5: {predicted_pm25:.3f}")
    print(f"Actual PM2.5 in dataset: {actual_pm25:.3f}")
    print(f"Approximate Accuracy: {approximate_accuracy:.2f}%")


if __name__ == "__main__":
    main()
