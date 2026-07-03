#!/usr/bin/env bash
# NUMZFLEET — baseline Postgres snapshot tied to a deployed SHA.
#
# Purpose: capture a safe restore point immediately after a successful
# `deployment/run-migrate-and-deploy.sh <SHA>` so future changes are reversible.
#
# Output layout (under deployment/backups/, gitignored):
#   <HOST>_<TS>_<SHA12>/numztrak_fuel.dump       custom-format pg_dump
#   <HOST>_<TS>_<SHA12>/numztrak_fuel.dump.sha256 checksum
#   <HOST>_<TS>_<SHA12>/metadata.json            sha, timestamp, masked db target, sizes
#
# Usage (from repo root, on the production server):
#   ./deployment/backup/baseline-backup.sh                 # uses last deployed SHA
#   ./deployment/backup/baseline-backup.sh <full-git-sha>  # explicit SHA (recommended)
#
# DATABASE_URL is read from backend/.env (same source the migrate+deploy script uses).
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_ENV="$ROOT_DIR/backend/.env"
LAST_DEPLOY_FILE="$ROOT_DIR/deployment/deploy/.last_deploy"
BACKUP_ROOT="${BACKUP_ROOT:-$ROOT_DIR/deployment/backups}"
LOG_DIR="$ROOT_DIR/deployment/logs"
MIN_DUMP_BYTES="${MIN_DUMP_BYTES:-4096}"

log() { printf '[baseline-backup] %s\n' "$*"; }
fail() { printf '[baseline-backup] ERROR: %s\n' "$*" >&2; exit 1; }

mask_database_url() {
  local u="${1:-}"
  if [[ -z "$u" ]]; then echo "(empty)"; return; fi
  echo "$u" | sed -E 's#(postgresql://[^:/@]+:)[^@]+#\1***#; s#(postgres://[^:/@]+:)[^@]+#\1***#'
}

resolve_sha() {
  local sha="${1:-}"
  if [[ -z "$sha" ]]; then
    [[ -f "$LAST_DEPLOY_FILE" ]] || fail "No SHA provided and $LAST_DEPLOY_FILE not found. Pass <full-git-sha> as argument."
    sha="$(tr -d '[:space:]' < "$LAST_DEPLOY_FILE" || true)"
    [[ -n "$sha" ]] || fail "$LAST_DEPLOY_FILE is empty; pass <full-git-sha> as argument."
  fi
  printf '%s' "$sha"
}

main() {
  local SHA
  SHA="$(resolve_sha "${1:-}")"
  local SHA12="${SHA:0:12}"

  [[ -f "$BACKEND_ENV" ]] || fail "Missing backend env file: $BACKEND_ENV"

  # shellcheck disable=SC1090
  set -a
  # shellcheck source=/dev/null
  source "$BACKEND_ENV"
  set +a

  : "${DATABASE_URL:?DATABASE_URL must be set in backend/.env}"
  command -v pg_dump >/dev/null 2>&1 || fail "pg_dump not found on PATH"

  local TS HOST RUN_DIR DUMP_PATH CHECKSUM_PATH META_PATH
  TS="$(date -u +"%Y-%m-%dT%H-%M-%SZ")"
  HOST="$(hostname -s 2>/dev/null || echo unknown)"
  RUN_DIR="$BACKUP_ROOT/${HOST}_${TS}_${SHA12}"
  DUMP_PATH="$RUN_DIR/numztrak_fuel.dump"
  CHECKSUM_PATH="$DUMP_PATH.sha256"
  META_PATH="$RUN_DIR/metadata.json"

  mkdir -p "$RUN_DIR" "$LOG_DIR"

  local LOGFILE="$LOG_DIR/baseline-backup-${TS}-$$.log"

  {
    log "Log file: $LOGFILE"
    log "SHA=$SHA  HOST=$HOST  TS=$TS"
    log "DATABASE_URL (masked): $(mask_database_url "$DATABASE_URL")"
    log "Output dir: $RUN_DIR"

    log "Running pg_dump (custom format) -> $DUMP_PATH"
    pg_dump --format=custom --no-owner --no-privileges --file="$DUMP_PATH" "$DATABASE_URL"

    [[ -s "$DUMP_PATH" ]] || fail "Dump missing or empty: $DUMP_PATH"
    local SZ
    SZ="$(stat -c%s "$DUMP_PATH" 2>/dev/null || wc -c <"$DUMP_PATH")"
    [[ "$SZ" -ge "$MIN_DUMP_BYTES" ]] || fail "Dump too small ($SZ bytes < $MIN_DUMP_BYTES): $DUMP_PATH"
    log "Dump size: ${SZ} bytes"

    sha256sum "$DUMP_PATH" | awk '{print $1"  numztrak_fuel.dump"}' > "$CHECKSUM_PATH"
    log "Checksum: $(awk '{print $1}' "$CHECKSUM_PATH")"

    cat > "$META_PATH" <<META
{
  "sha": "$SHA",
  "host": "$HOST",
  "timestamp_utc": "$TS",
  "database_url_masked": "$(mask_database_url "$DATABASE_URL")",
  "dump_file": "numztrak_fuel.dump",
  "dump_bytes": $SZ,
  "dump_format": "pg_dump --format=custom",
  "checksum_file": "numztrak_fuel.dump.sha256"
}
META

    chmod 600 "$DUMP_PATH" "$CHECKSUM_PATH" "$META_PATH" 2>/dev/null || true
    log "Wrote metadata: $META_PATH"
    log "Restore command (DESTRUCTIVE — review target DB first):"
    log "  pg_restore --clean --if-exists --no-owner --no-privileges --dbname=\"\$DATABASE_URL\" $DUMP_PATH"
    log "SUCCESS"
  } 2>&1 | tee -a "$LOGFILE"
  rc="${PIPESTATUS[0]:-1}"
  exit "$rc"
}

main "$@"
