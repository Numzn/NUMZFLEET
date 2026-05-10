#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
HISTORY_FILE="$ROOT_DIR/deployment/deploy/.deploy_history"
ENV_FILE="${1:-$ROOT_DIR/deployment/.env}"

log() { printf '[rollback] %s\n' "$*"; }
fail() { printf '[rollback] ERROR: %s\n' "$*" >&2; exit 1; }

[[ -f "$HISTORY_FILE" ]] || fail "No deployment history found at $HISTORY_FILE"
LINE_COUNT="$(grep -cve '^[[:space:]]*$' "$HISTORY_FILE" 2>/dev/null || echo 0)"
[[ "${LINE_COUNT:-0}" -ge 2 ]] || fail "Need at least two deployments in $HISTORY_FILE to rollback (found $LINE_COUNT non-empty line(s))"
PREV_SHA="$(tail -n 2 "$HISTORY_FILE" | head -n 1 || true)"
[[ -n "$PREV_SHA" ]] || fail "Could not determine previous SHA from $HISTORY_FILE"

log "Rolling back to previous SHA=$PREV_SHA"
bash "$ROOT_DIR/deployment/deploy/deploy-from-registry.sh" "$PREV_SHA" "$ENV_FILE"
log "Rollback completed"
