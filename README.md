# Pune PM2.5 Modeling Pipeline

This project trains a machine learning model to predict PM2.5 over Pune, India using only monthly satellite-derived PM2.5 NetCDF files.

## Project structure

```text
data/
  raw/                  # place NetCDF files here
  processed/            # generated parquet/csv outputs
models/                 # trained model artifacts
notebooks/              # optional analysis notebooks
outputs/
  plots/                # evaluation plots and heatmaps
src/
  config.py
  data.py
  features.py
  modeling.py
  visualization.py
  preprocess.py
  train.py
  evaluate.py
  predict.py
  heatmap.py
```

## Dataset placement

Put all `.nc` files inside `data/raw/`.

Example:

```text
data/raw/
  global_pm25_2000.nc
  global_pm25_2001.nc
  ...
```

## Environment setup

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Step 1: Preprocess NetCDF files

This loads all NetCDF files, extracts the Pune bounding box, handles missing values, and builds the ML-ready feature table.

```bash
python -m src.preprocess
```

Outputs:

- `data/processed/pune_pm25_raw.parquet`
- `data/processed/pune_pm25_features.parquet`
- `data/processed/feature_description.csv`

## Step 2: Train the model

```bash
python -m src.train
```

Outputs:

- `models/pm25_xgboost.joblib`
- `models/feature_columns.joblib`
- `outputs/plots/feature_importance.csv`

## Step 3: Evaluate the model

```bash
python -m src.evaluate
```

Outputs:

- `outputs/plots/predicted_vs_actual.png`
- `outputs/plots/residual_distribution.png`
- printed RMSE, MAE, and R² for validation and test sets

## Step 4: Generate a prediction

This predicts PM2.5 for the nearest available Pune grid cell for a given month, using features already prepared from previous months.

```bash
python -m src.predict --year 2022 --month 10 --lat 18.52 --lon 73.86
```

## Step 5: Generate a Pune heatmap

This creates a spatial heatmap for actual or predicted PM2.5 for a selected month.

```bash
python -m src.heatmap --year 2022 --month 10 --mode predicted
```

## Feature design

The pipeline uses only PM2.5-derived features:

- `latitude`, `longitude`: captures stable spatial gradients within Pune.
- `month`, `year`: captures monthly cycle and long-term trend.
- `season`: compresses recurring seasonal pollution behavior in India.
- `month_sin`, `month_cos`: cyclic encoding so December and January are treated as neighbors.
- `pm_lag_1`, `pm_lag_2`, `pm_lag_3`: recent pollution persistence is often the strongest predictor.
- `rolling_pm_3`, `rolling_pm_6`: smooths short-term noise and captures sustained accumulation or cleanup periods.
- `trend_1_3`: recent slope from 3-month history, useful for rising or falling pollution regimes.
- `spatial_lag_mean_1`: previous-month average PM of nearby grid cells.
- `spatial_lag_weighted_1`: distance-weighted previous-month PM from neighboring cells, which preserves local plume structure.
- `grid_density`: how many valid nearby grid cells existed at the previous month, useful for spatial stability and confidence.

## Time-aware splitting

The training script uses chronological splitting:

- Train: oldest 70% of months
- Validation: next 15% of months
- Test: most recent 15% of months

It also runs optional `TimeSeriesSplit` cross-validation on the training period.

## Performance notes

- Processing is limited to the Pune bounding box, so it runs on a normal laptop.
- XGBoost is configured with moderate tree depth and subsampling for efficiency.
- Intermediate results are stored as parquet for faster re-runs.
