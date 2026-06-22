#!/usr/bin/env bash
# Quick Socket.IO polling handshake test (GET sid + POST connect packet).
set -euo pipefail

BASE="${1:-http://100.121.79.2:3000}"

RESP=$(curl -sS "${BASE}/socket.io/?EIO=4&transport=polling")
SID=$(echo "$RESP" | sed -n 's/.*"sid":"\([^"]*\)".*/\1/p')

if [[ -z "$SID" ]]; then
  echo "Failed to parse sid from: $RESP" >&2
  exit 1
fi

echo "GET ok sid=$SID"
curl -sS -D - -X POST \
  "${BASE}/socket.io/?EIO=4&transport=polling&sid=${SID}" \
  -H 'Content-Type: text/plain' \
  --data-binary '40'
