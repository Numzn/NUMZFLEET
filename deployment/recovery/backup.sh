#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
BACKUP_ROOT="${BACKUP_ROOT:-$HOME/backups/numzfleet}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
GIT_COMMIT="$(git -C "$REPO_ROOT" rev-parse --short HEAD)"
GIT_BRANCH="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)"
BACKUP_NAME="backup-${TIMESTAMP}-${GIT_COMMIT}"
STAGE_DIR="$BACKUP_ROOT/$BACKUP_NAME"
ARCHIVE_PATH="$BACKUP_ROOT/${BACKUP_NAME}.tar.gz"
INDEX_FILE="$BACKUP_ROOT/index.tsv"
INCLUDE_CODE_SNAPSHOT="${INCLUDE_CODE_SNAPSHOT:-0}"
OFFSITE_TARGET="${OFFSITE_TARGET:-}"

log() {
  printf '[backup] %s\n' "$*"
}

fail() {
  printf '[backup] ERROR: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

copy_if_exists() {
  local source_path="$1"
  local target_path="$2"
  if [[ -e "$source_path" ]]; then
    mkdir -p "$(dirname "$target_path")"
    cp -R "$source_path" "$target_path"
  else
    log "Skipping missing path: $source_path"
  fi
}

get_mount_source() {
  local container_name="$1"
  local destination="$2"
  docker inspect "$container_name" \
    --format '{{range .Mounts}}{{if eq .Destination "'"$destination"'"}}{{if .Name}}{{.Name}}{{else}}{{.Source}}{{end}}{{println}}{{end}}{{end}}' \
    2>/dev/null | head -n 1
}

require_cmd docker
require_cmd docker-compose
require_cmd git
require_cmd tar

[[ -f "$BACKEND_DIR/docker-compose.yml" ]] || fail "Expected backend/docker-compose.yml at $BACKEND_DIR"

mkdir -p "$BACKUP_ROOT"
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR/files"

log "Creating backup $BACKUP_NAME"

cat > "$STAGE_DIR/manifest.env" <<EOF
BACKUP_NAME=$BACKUP_NAME
BACKUP_TIMESTAMP=$TIMESTAMP
REPO_ROOT=$REPO_ROOT
BACKEND_DIR=$BACKEND_DIR
GIT_COMMIT=$GIT_COMMIT
GIT_BRANCH=$GIT_BRANCH
HOSTNAME=$(hostname)
INCLUDE_CODE_SNAPSHOT=$INCLUDE_CODE_SNAPSHOT
EOF

log "Dumping PostgreSQL"
docker exec numztrak-postgres \
  pg_dump -U numztrak --clean --if-exists --no-owner --no-privileges numztrak_fuel \
  > "$STAGE_DIR/postgres.sql"

log "Dumping MySQL"
docker exec numztrak-mysql \
  sh -lc 'exec mysqldump --single-transaction --routines --triggers --events -u traccar -p"$MYSQL_PASSWORD" traccar' \
  > "$STAGE_DIR/mysql.sql"

log "Copying environment and configuration"
copy_if_exists "$BACKEND_DIR/.env" "$STAGE_DIR/files/.env"
copy_if_exists "$BACKEND_DIR/nginx/nginx.oci.conf" "$STAGE_DIR/files/nginx.oci.conf"
copy_if_exists "$BACKEND_DIR/conf/traccar.xml" "$STAGE_DIR/files/traccar.xml"
copy_if_exists "$BACKEND_DIR/ssl" "$STAGE_DIR/files/ssl"
copy_if_exists "$BACKEND_DIR/cert.pem" "$STAGE_DIR/files/cert.pem"
copy_if_exists "$BACKEND_DIR/key.pem" "$STAGE_DIR/files/key.pem"

if [[ -d "$REPO_ROOT/traccar-fleet-system/frontend/dist" ]]; then
  log "Archiving frontend dist"
  tar -czf "$STAGE_DIR/frontend-dist.tar.gz" -C "$REPO_ROOT/traccar-fleet-system/frontend" dist
fi

erb_mount_source="$(get_mount_source numztrak-erb-worker /app/data)"
if [[ -n "$erb_mount_source" ]]; then
  log "Archiving ERB data volume"
  docker run --rm \
    -v "$erb_mount_source:/volume:ro" \
    -v "$STAGE_DIR:/backup" \
    alpine:3.20 \
    sh -lc 'cd /volume && tar -czf /backup/erb_data.tar.gz .'
else
  log "Skipping ERB data volume backup; mount not found"
fi

if [[ "$INCLUDE_CODE_SNAPSHOT" == "1" ]]; then
  log "Archiving code snapshot"
  tar -czf "$STAGE_DIR/code.tar.gz" --exclude='.git' -C "$REPO_ROOT" .
fi

log "Packaging archive"
tar -czf "$ARCHIVE_PATH" -C "$BACKUP_ROOT" "$BACKUP_NAME"
printf '%s\t%s\t%s\t%s\n' "$TIMESTAMP" "$GIT_COMMIT" "$GIT_BRANCH" "$(basename "$ARCHIVE_PATH")" >> "$INDEX_FILE"

if [[ -n "$OFFSITE_TARGET" ]]; then
  if command -v rclone >/dev/null 2>&1; then
    log "Syncing archive to $OFFSITE_TARGET"
    rclone copy "$ARCHIVE_PATH" "$OFFSITE_TARGET"
  else
    fail "OFFSITE_TARGET is set but rclone is not installed"
  fi
fi

rm -rf "$STAGE_DIR"
log "Backup completed: $ARCHIVE_PATH"