# PM2.5 Model Summary And API Contract

## Purpose

This backend will expose the PM2.5 prediction model from `ml-service/`.

The model is designed for **Pune, India** and predicts **monthly PM2.5** using:
- latitude
- longitude
- month
- year
- learned spatial and temporal patterns
- auxiliary satellite and meteorological features already prepared inside the ML service

## Important Note

This is a **monthly PM2.5 prediction system**, not a daily or hourly system.

So the client should send:
- `latitude`
- `longitude`
- `year`
- `month`

And the backend should return:
- predicted `pm25`
- nearest grid cell used
- optional accuracy or explanation fields when available

## Model Location

The ML code lives in:
- `ml-service/src/`

Main trained artifact:
- `ml-service/models/pm25_xgboost.joblib`

## Recommended Endpoints

### 1. Health Check

`GET /api/health`

Response:

```json
{
  "status": "ok",
  "service": "pm25-backend"
}
```

### 2. Predict For Known Month

Use this when the requested month exists in the prepared dataset.

`POST /api/predict`

Request body:

```json
{
  "latitude": 18.6263,
  "longitude": 73.8055,
  "year": 2023,
  "month": 2
}
```

Response:

```json
{
  "latitude": 18.6263,
  "longitude": 73.8055,
  "nearest_grid_latitude": 18.65,
  "nearest_grid_longitude": 73.85,
  "year": 2023,
  "month": 2,
  "predicted_pm25": 64.44,
  "actual_pm25": 63.88,
  "approximate_accuracy": 99.11
}
```

### 3. Predict Future Month

Use this when the requested month is not present in the original dataset.

`POST /api/predict/future`

Request body:

```json
{
  "latitude": 18.6263,
  "longitude": 73.8055,
  "year": 2026,
  "month": 3
}
```

Response:

```json
{
  "latitude": 18.6263,
  "longitude": 73.8055,
  "nearest_grid_latitude": 18.65,
  "nearest_grid_longitude": 73.85,
  "year": 2026,
  "month": 3,
  "predicted_pm25": 67.91
}
```

Optional request body field:

```json
{
  "actual_pm25": 41.0
}
```

Optional extra response fields when `actual_pm25` is supplied:

```json
{
  "absolute_error": 11.56,
  "percentage_error": 28.19,
  "approximate_accuracy": 71.81
}
```

### 4. Explain Prediction

Use SHAP to explain which factors most affected the prediction.

`POST /api/explain`

Request body:

```json
{
  "latitude": 18.6263,
  "longitude": 73.8055,
  "year": 2023,
  "month": 2,
  "top_k": 5
}
```

Response:

```json
{
  "predicted_pm25": 64.44,
  "actual_pm25": 63.88,
  "top_factors": [
    {
      "feature": "satellite_pm25_aux",
      "value": 63.87,
      "shap_value": 28.19,
      "effect": "increased"
    }
  ],
  "meteorological_factors": [
    {
      "feature": "met_tcc_mean",
      "value": 0.094,
      "shap_value": 0.142,
      "effect": "increased"
    }
  ]
}
```

## Input Validation Rules

- `latitude` should be within the Pune operating area
- `longitude` should be within the Pune operating area
- `month` must be from `1` to `12`
- `year` must be a valid integer

Suggested Pune bounds:
- latitude: `18.40` to `18.70`
- longitude: `73.70` to `74.10`

## Expected Backend Behavior

- For known historical months:
  - use the prepared dataset and trained model
- For future months:
  - use recursive monthly forecasting
- For invalid coordinates outside Pune:
  - return a validation error
- For unsupported input:
  - return a clear error message

## Suggested Error Response

```json
{
  "error": "Invalid request",
  "message": "month must be between 1 and 12"
}
```

## What Teammates Need To Know

- `ml-service/` contains the trained ML pipeline
- `backend/` should expose REST endpoints around that model
- `frontend/` should call the backend, not the ML scripts directly
- the current prediction granularity is **monthly PM2.5**
