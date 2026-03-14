from __future__ import annotations

import argparse

import joblib
import pandas as pd

from .config import FEATURE_TABLE_NAME, MODELS_DIR, PROCESSED_DIR
from .data import load_meteorological_daily_features
from .forecast_model import load_forecast_artifacts
from .predict_future import blend_future_prediction, build_future_month_rows, next_month
from .predict_future_forecast import load_monthly_bias_map, select_horizon
from .short_term_model import MET_COLUMNS, load_short_term_adjuster


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a 24-72 hour PM2.5 outlook from monthly baseline plus daily meteorology.")
    parser.add_argument("--start-date", type=str, required=True, help="YYYY-MM-DD")
    parser.add_argument("--days", type=int, default=3, help="Number of daily outlook steps, typically 1 to 3.")
    parser.add_argument("--lat", type=float, required=True)
    parser.add_argument("--lon", type=float, required=True)
    return parser.parse_args()


def pm25_to_aqi_band(pm25: float) -> str:
    if pm25 <= 12.0:
        return "Good"
    if pm25 <= 35.4:
        return "Moderate"
    if pm25 <= 55.4:
        return "Unhealthy for Sensitive Groups"
    if pm25 <= 150.4:
        return "Unhealthy"
    if pm25 <= 250.4:
        return "Very Unhealthy"
    return "Hazardous"


def get_monthly_baseline(target_month: pd.Timestamp, lat: float, lon: float) -> tuple[float, float, float]:
    history_frame = pd.read_parquet(PROCESSED_DIR / FEATURE_TABLE_NAME)
    history_frame["time"] = pd.to_datetime(history_frame["time"])
    last_available = history_frame["time"].max()

    if target_month <= last_available:
        model = joblib.load(MODELS_DIR / "pm25_xgboost.joblib")
        features = joblib.load(MODELS_DIR / "feature_columns.joblib")
        subset = history_frame[
            (history_frame["time"].dt.year == target_month.year) & (history_frame["time"].dt.month == target_month.month)
        ].copy()
        subset["distance_to_query"] = ((subset["latitude"] - lat) ** 2 + (subset["longitude"] - lon) ** 2) ** 0.5
        row = subset.sort_values("distance_to_query").iloc[0]
        predicted = float(model.predict(pd.DataFrame([row[features]]))[0])
        return predicted, float(row["latitude"]), float(row["longitude"])

    history_columns = ["time", "latitude", "longitude", "pm25"]
    if "satellite_pm25_aux" in history_frame.columns:
        history_columns.append("satellite_pm25_aux")
    history = history_frame[history_columns].copy().sort_values(["time", "latitude", "longitude"]).reset_index(drop=True)
    observed_history = history.copy()
    monthly_bias = load_monthly_bias_map()

    forecast_time = next_month(last_available)
    horizon_steps = 1
    while forecast_time <= target_month:
        selected_horizon = select_horizon(horizon_steps)
        model, features = load_forecast_artifacts(selected_horizon)
        future_rows = build_future_month_rows(history, forecast_time, features)
        raw_predictions = model.predict(future_rows[features])
        future_rows["pm25"] = [
            max(
                0.0,
                float(
                    blend_future_prediction(
                        model_prediction=float(pred),
                        location_history=observed_history[
                            (observed_history["latitude"] == row["latitude"]) & (observed_history["longitude"] == row["longitude"])
                        ].sort_values("time"),
                        forecast_time=forecast_time,
                        horizon_steps=horizon_steps,
                    )
                    - monthly_bias.get(forecast_time.month, 0.0)
                ),
            )
            for pred, (_, row) in zip(raw_predictions, future_rows.iterrows())
        ]
        append_columns = ["time", "latitude", "longitude", "pm25"]
        if "satellite_pm25_aux" in future_rows.columns:
            append_columns.append("satellite_pm25_aux")
        history = pd.concat([history, future_rows[append_columns]], ignore_index=True)
        forecast_time = next_month(forecast_time)
        horizon_steps += 1

    target_rows = history[history["time"] == target_month].copy()
    target_rows["distance_to_query"] = ((target_rows["latitude"] - lat) ** 2 + (target_rows["longitude"] - lon) ** 2) ** 0.5
    row = target_rows.sort_values("distance_to_query").iloc[0]
    return float(row["pm25"]), float(row["latitude"]), float(row["longitude"])


def main() -> None:
    args = parse_args()
    start_date = pd.Timestamp(args.start_date)
    end_date = start_date + pd.Timedelta(days=args.days - 1)
    target_month = start_date.to_period("M").to_timestamp()

    baseline_pm25, grid_lat, grid_lon = get_monthly_baseline(target_month, args.lat, args.lon)
    daily_met = load_meteorological_daily_features()
    daily_met["date"] = pd.to_datetime(daily_met["date"])
    daily_slice = daily_met[(daily_met["date"] >= start_date) & (daily_met["date"] <= end_date)].copy()
    if daily_slice.empty:
        raise ValueError("No daily meteorological data available for the requested date range.")

    adjuster, meta = load_short_term_adjuster()
    climatology = pd.DataFrame(meta["climatology"])
    daily_slice["month"] = daily_slice["date"].dt.month
    daily_slice = daily_slice.merge(climatology, on="month", how="left")

    feature_values = []
    for column in MET_COLUMNS:
        if column in daily_slice.columns:
            anomaly_col = f"{column}_anomaly"
            daily_slice[anomaly_col] = daily_slice[column] - daily_slice[f"{column}_climatology"]
            feature_values.append(anomaly_col)

    raw_adjustment = adjuster.predict(daily_slice[meta["feature_columns"]])
    shrinkage = float(meta["shrinkage"])
    cap = float(meta["adjustment_cap"])
    daily_slice["pm_adjustment"] = [max(-cap, min(cap, shrinkage * float(value))) for value in raw_adjustment]
    daily_slice["pm25_outlook"] = (baseline_pm25 + daily_slice["pm_adjustment"]).clip(lower=0.0)
    daily_slice["aqi_band"] = daily_slice["pm25_outlook"].apply(pm25_to_aqi_band)

    print("Short-term PM2.5 outlook")
    print(f"Requested location: lat={args.lat:.4f}, lon={args.lon:.4f}")
    print(f"Nearest PM grid cell: lat={grid_lat:.4f}, lon={grid_lon:.4f}")
    print(f"Monthly baseline PM2.5: {baseline_pm25:.3f}")
    for _, row in daily_slice.iterrows():
        print(
            f"{row['date'].date()} | Outlook PM2.5={row['pm25_outlook']:.3f} | "
            f"Adjustment={row['pm_adjustment']:+.3f} | AQI={row['aqi_band']}"
        )


if __name__ == "__main__":
    main()
