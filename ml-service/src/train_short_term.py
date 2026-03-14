from __future__ import annotations

from .short_term_model import save_short_term_adjuster, train_short_term_adjuster


def main() -> None:
    model, meta = train_short_term_adjuster()
    save_short_term_adjuster(model, meta)
    print("Saved short-term meteorology adjuster.")
    print("Features:", ", ".join(meta["feature_columns"]))
    print(f"Shrinkage: {meta['shrinkage']}")
    print(f"Adjustment cap: {meta['adjustment_cap']}")


if __name__ == "__main__":
    main()
