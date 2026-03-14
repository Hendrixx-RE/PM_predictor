from __future__ import annotations

from .config import DAILY_MET_TABLE_NAME, PROCESSED_DIR, ensure_directories
from .data import daily_meteorology_processed_path, load_meteorological_daily_features


def main() -> None:
    ensure_directories()
    daily_met = load_meteorological_daily_features()
    output_path = daily_meteorology_processed_path()
    daily_met.to_parquet(output_path, index=False)
    print(f"Saved processed daily meteorology to {output_path}")
    print(f"Rows: {len(daily_met):,}")
    print(f"Date range: {daily_met['date'].min().date()} to {daily_met['date'].max().date()}")


if __name__ == "__main__":
    main()
