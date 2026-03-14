# PM2.5 Monorepo

This repo is now split into:

```text
ml-service/ # ML / data / model pipeline
backend/    # API / server layer
frontend/  # UI application
```

## ML Service

All PM2.5 modeling code, datasets, processed outputs, notebooks, and trained models live under `ml-service/`.

Run ML commands from:

```powershell
cd ml-service
```

Examples:

```powershell
python -m src.preprocess
python -m src.train
python -m src.evaluate
python -m src.predict --year 2023 --month 2 --lat 18.6263 --lon 73.8055
```

Detailed ML instructions are in [ml-service/README.md](/c:/Users/Prince%20Kumar/Desktop/projects/demo/ml-service/README.md).

## Backend

Use `backend/` for the API/server layer that will expose the ML service to the frontend later.

## Frontend

Use `frontend/` for the UI app that will call the backend model later.
