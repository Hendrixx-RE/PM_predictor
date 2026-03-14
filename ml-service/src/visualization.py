from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns


def plot_predicted_vs_actual(results: pd.DataFrame, output_path: Path) -> None:
    plt.figure(figsize=(7, 7))
    sns.scatterplot(data=results, x="actual", y="predicted", alpha=0.7)
    min_val = min(results["actual"].min(), results["predicted"].min())
    max_val = max(results["actual"].max(), results["predicted"].max())
    plt.plot([min_val, max_val], [min_val, max_val], linestyle="--", color="black", linewidth=1)
    plt.xlabel("Actual PM2.5")
    plt.ylabel("Predicted PM2.5")
    plt.title("Predicted vs Actual PM2.5")
    plt.tight_layout()
    plt.savefig(output_path, dpi=150)
    plt.close()


def plot_residual_distribution(results: pd.DataFrame, output_path: Path) -> None:
    residuals = results["actual"] - results["predicted"]
    plt.figure(figsize=(8, 5))
    sns.histplot(residuals, bins=30, kde=True)
    plt.xlabel("Residual (Actual - Predicted)")
    plt.title("Residual Distribution")
    plt.tight_layout()
    plt.savefig(output_path, dpi=150)
    plt.close()


def plot_heatmap(frame: pd.DataFrame, value_column: str, title: str, output_path: Path) -> None:
    pivot = frame.pivot_table(index="latitude", columns="longitude", values=value_column, aggfunc="mean")
    plt.figure(figsize=(8, 6))
    sns.heatmap(pivot.sort_index(ascending=False), cmap="YlOrRd", linewidths=0.2)
    plt.title(title)
    plt.xlabel("Longitude")
    plt.ylabel("Latitude")
    plt.tight_layout()
    plt.savefig(output_path, dpi=150)
    plt.close()
