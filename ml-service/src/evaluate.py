from __future__ import annotations

import joblib
import pandas as pd

from .config import FEATURE_TABLE_NAME, MODELS_DIR, PLOTS_DIR, PROCESSED_DIR, TARGET_COLUMN, ensure_directories
from .features import feature_columns
from .modeling import chronological_split, evaluate_predictions
from .visualization import plot_predicted_vs_actual, plot_residual_distribution


def main() -> None:
    ensure_directories()
    frame = pd.read_parquet(PROCESSED_DIR / FEATURE_TABLE_NAME).sort_values("time").reset_index(drop=True)
    model = joblib.load(MODELS_DIR / "pm25_xgboost.joblib")
    features = joblib.load(MODELS_DIR / "feature_columns.joblib")

    splits = chronological_split(frame)

    for split_name, split_frame in {"validation": splits.validation, "test": splits.test}.items():
        X = split_frame[features]
        y = split_frame[TARGET_COLUMN]
        pred = model.predict(X)
        metrics = evaluate_predictions(y, pred)
        results = pd.DataFrame({"actual": y, "predicted": pred})

        if split_name == "test":
            plot_predicted_vs_actual(results, PLOTS_DIR / "predicted_vs_actual.png")
            plot_residual_distribution(results, PLOTS_DIR / "residual_distribution.png")

        print(f"{split_name.title()} metrics: {metrics}")
        print(f"{split_name.title()} accuracy: {metrics['accuracy_pct']:.2f}%")


if __name__ == "__main__":
    main()
