#!/usr/bin/env python3
"""Download KOSPI daily data and store it for the local chart app."""

from __future__ import annotations

import csv
import io
import sys
from pathlib import Path
from urllib.request import urlopen

SOURCE_URL = "https://stooq.com/q/d/l/?s=%5Ekospi&i=d"
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "public" / "data" / "kospi.csv"


def download_csv(url: str) -> str:
    with urlopen(url) as response:  # nosec B310 - fixed https source
        return response.read().decode("utf-8")


def validate_csv(content: str) -> tuple[int, str, str]:
    rows = list(csv.DictReader(io.StringIO(content)))
    if not rows:
        raise ValueError("Downloaded CSV has no data rows.")
    required = {"Date", "Close"}
    if not required.issubset(rows[0].keys()):
        raise ValueError(f"CSV header missing required columns: {required}")
    return len(rows), rows[0]["Date"], rows[-1]["Date"]


def main() -> int:
    try:
        content = download_csv(SOURCE_URL)
        row_count, first_date, last_date = validate_csv(content)
    except Exception as exc:  # pragma: no cover - CLI error path
        print(f"[error] {exc}", file=sys.stderr)
        return 1

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(content, encoding="utf-8")

    print(f"[ok] saved: {OUTPUT_PATH}")
    print(f"[ok] rows: {row_count}, range: {first_date} -> {last_date}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
