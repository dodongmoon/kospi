#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

python3 scripts/fetch_kospi.py
echo "[ok] updated at $(date '+%Y-%m-%d %H:%M:%S %Z')"
