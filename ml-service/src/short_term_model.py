from __future__ import annotations

import json

import joblib
import pandas as pd
from sklearn.linear_model import Ridge

from .config import MODELS_DIR, PROCESSED_DIR


SHORT_TERM_MODEL_PATH = MODELS_DIR / "pm25_short_term_adjuster.joblib"
SHORT_TERM_META_PATH = MODELS_DIR / "pm25_short_term_meta.json"

MET_COLUMNS = [
    "met_t2m_mean",
    "met_d2m_mean",
    "met_wind_speed_mean",
    "met_msl_mean",
    "met_sp_mean",
    "met_tcc_mean",
    "met_tp_sum",
]


def build_monthly_city_frame() -> pd.DataFrame:
    frame = pd.read_parquet(PROCESSED_DIR / "pune_pm25_features.parquet")
    city = frame.groupby("time", as_index=False).agg(
        pm25=("pm25", "mean"),
        **{column: (column, "mean") for column in MET_COLUMNS if column in frame.columns},
    )
    city["month"] = pd.to_datetime(city["time"]).dt.month
    return city.sort_values("time").reset_index(drop=True)


def train_short_term_adjuster(alpha: float = 1.5) -> tuple[Ridge, dict]:
    city = build_monthly_city_frame()
    climatology = city.groupby("month", as_index=False).agg(
        pm25_climatology=("pm25", "mean"),
        **{f"{column}_climatology": (column, "mean") for column in MET_COLUMNS if column in city.columns},
    )
    train = city.merge(climatology, on="month", how="left")
    feature_columns = []
    for column in MET_COLUMNS:
        if column in train.columns:
            anomaly_col = f"{column}_anomaly"
            train[anomaly_col] = train[column] - train[f"{column}_climatology"]
            feature_columns.append(anomaly_col)
    train["pm25_anomaly"] = train["pm25"] - train["pm25_climatology"]

    model = Ridge(alpha=alpha)
    model.fit(train[feature_columns], train["pm25_anomaly"])

    meta = {
        "feature_columns": feature_columns,
        "climatology": climatology.to_dict(orient="records"),
        "shrinkage": 0.45,
        "adjustment_cap": 18.0,
    }
    return model, meta


def save_short_term_adjuster(model: Ridge, meta: dict) -> None:
    joblib.dump(model, SHORT_TERM_MODEL_PATH)
    with open(SHORT_TERM_META_PATH, "w", encoding="utf-8") as file:
        json.dump(meta, file, indent=2)


def load_short_term_adjuster() -> tuple[Ridge, dict]:
    model = joblib.load(SHORT_TERM_MODEL_PATH)
    with open(SHORT_TERM_META_PATH, "r", encoding="utf-8") as file:
        meta = json.load(file)
    return model, meta
