# Pune PM2.5 Modeling Backend

This ML service trains a machine learning model to predict PM2.5 over Pune, India.

## Project structure

```text
ml-service/
  data/
    raw/
    processed/
  models/
  notebooks/
  outputs/
    plots/
  src/
```

## Dataset placement

Put the PM, satellite, and meteorological NetCDF files inside `ml-service/data/raw/` using the existing subfolders.

## Environment setup

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Main commands

```bash
python -m src.preprocess
python -m src.train
python -m src.evaluate
python -m src.predict --year 2023 --month 2 --lat 18.6263 --lon 73.8055
python -m src.predict_future --year 2026 --month 3 --lat 18.6263 --lon 73.8055
python -m src.explain --year 2023 --month 11 --lat 18.6263 --lon 73.8055 --top-k 8
```

## Outputs

- `backend/data/processed/pune_pm25_raw.parquet`
- `backend/data/processed/pune_pm25_features.parquet`
- `backend/models/pm25_xgboost.joblib`
- `backend/outputs/plots/`
Replace `backend/` above with `ml-service/`.
