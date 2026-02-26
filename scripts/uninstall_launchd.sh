#!/usr/bin/env bash
set -euo pipefail

LABEL="com.yangdongmoon.kospi.dailyupdate"
PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"

if [[ -f "$PLIST_PATH" ]]; then
  launchctl unload "$PLIST_PATH" 2>/dev/null || true
  rm -f "$PLIST_PATH"
  echo "[ok] removed launchd agent: $LABEL"
else
  echo "[info] no launchd agent found: $PLIST_PATH"
fi
