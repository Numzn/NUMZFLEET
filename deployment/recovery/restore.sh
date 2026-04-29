#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
BACKUP_ROOT="${BACKUP_ROOT:-$HOME/backups/numzfleet}"
OFFSITE_TARGET="${OFFSITE_TARGET:-}"
AUTO_APPROVE="${AUTO_APPROVE:-0}"
FORCE_RESTORE="${FORCE_RESTORE:-0}"
RESTORE_CODE_MODE="${RESTORE_CODE_MODE:-git}"

log() {
  printf '[restore] %s\n' "$*"
}

fail() {
  printf '[restore] ERROR: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

confirm() {
  local prompt="$1"
  if [[ "$AUTO_APPROVE" == "1" ]]; then
    return 0
  fi
  read -r -p "$prompt [y/N]: " reply
  [[ "$reply" =~ ^[Yy]$ ]]
}

wait_for_health() {
  local container_name="$1"
  local timeout_seconds="${2:-180}"
  local elapsed=0
  while (( elapsed < timeout_seconds )); do
    local state
    state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_name" 2>/dev/null || true)"
    if [[ "$state" == "healthy" || "$state" == "running" ]]; then
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  fail "Timed out waiting for $container_name to become healthy"
}

safe_remove_container() {
  local container_name="$1"
  if docker ps -a --format '{{.Names}}' | grep -Fxq "$container_name"; then
    docker rm -f "$container_name" >/dev/null
  fi
}

choose_backup() {
  local -a archives=()
  while IFS= read -r line; do
    archives+=("$line")
  done < <(find "$BACKUP_ROOT" -maxdepth 1 -type f -name 'backup-*.tar.gz' -printf '%f\n' | sort -r)

  (( ${#archives[@]} > 0 )) || fail "No backup archives found under $BACKUP_ROOT"

  if [[ $# -gt 0 && -n "$1" ]]; then
    printf '%s\n' "$1"
    return 0
  fi

  log "Available backups:"
  local index=1
  for archive in "${archives[@]}"; do
    printf '  %d) %s\n' "$index" "$archive"
    index=$((index + 1))
  done

  local selection
  read -r -p 'Choose backup number: ' selection
  [[ "$selection" =~ ^[0-9]+$ ]] || fail "Invalid selection"
  (( selection >= 1 && selection <= ${#archives[@]} )) || fail "Selection out of range"
  printf '%s\n' "${archives[$((selection - 1))]}"
}

sync_from_remote_if_needed() {
  if [[ -z "$OFFSITE_TARGET" ]]; then
    return 0
  fi
  require_cmd rclone
  mkdir -p "$BACKUP_ROOT"
  log "Syncing backups from $OFFSITE_TARGET"
  rclone copy "$OFFSITE_TARGET" "$BACKUP_ROOT"
}

require_cmd docker
require_cmd docker-compose
require_cmd git
require_cmd tar

[[ -f "$BACKEND_DIR/docker-compose.yml" ]] || fail "Expected backend/docker-compose.yml at $BACKEND_DIR"

sync_from_remote_if_needed

SELECTED_ARCHIVE="$(choose_backup "${1:-}")"
ARCHIVE_PATH="$BACKUP_ROOT/$SELECTED_ARCHIVE"
[[ -f "$ARCHIVE_PATH" ]] || fail "Backup archive not found: $ARCHIVE_PATH"

EXTRACT_ROOT="$BACKUP_ROOT/.restore-$$"
rm -rf "$EXTRACT_ROOT"
mkdir -p "$EXTRACT_ROOT"

log "Extracting $SELECTED_ARCHIVE"
tar -xzf "$ARCHIVE_PATH" -C "$EXTRACT_ROOT"
RESTORE_DIR="$(find "$EXTRACT_ROOT" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
[[ -n "$RESTORE_DIR" ]] || fail "Unable to locate extracted backup directory"
[[ -f "$RESTORE_DIR/manifest.env" ]] || fail "manifest.env missing from backup"
source "$RESTORE_DIR/manifest.env"

if [[ "$FORCE_RESTORE" != "1" ]] && [[ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]]; then
  fail "Repository has local changes. Commit, stash, or rerun with FORCE_RESTORE=1"
fi

log "Backup commit: ${GIT_COMMIT:-unknown}"
log "Backup timestamp: ${BACKUP_TIMESTAMP:-unknown}"

confirm "Restore this backup and overwrite current runtime state?" || fail "Restore cancelled"

if [[ "$RESTORE_CODE_MODE" == "git" && -n "${GIT_COMMIT:-}" ]]; then
  log "Checking out commit ${GIT_COMMIT} in detached HEAD"
  git -C "$REPO_ROOT" fetch --all --tags
  git -C "$REPO_ROOT" checkout --detach "$GIT_COMMIT"
elif [[ "$RESTORE_CODE_MODE" == "snapshot" && -f "$RESTORE_DIR/code.tar.gz" ]]; then
  log "Restoring code snapshot"
  tar -xzf "$RESTORE_DIR/code.tar.gz" -C "$REPO_ROOT"
else
  log "Keeping current working tree; RESTORE_CODE_MODE=$RESTORE_CODE_MODE"
fi

log "Stopping compose stack"
(
  cd "$BACKEND_DIR"
  docker-compose down --remove-orphans || true
)

for container_name in \
  numztrak-nginx \
  numztrak-fuel-api \
  numztrak-erb-api \
  numztrak-erb-worker \
  numztrak-traccar \
  numztrak-postgres \
  numztrak-mysql; do
  safe_remove_container "$container_name"
done

log "Restoring configuration files"
cp "$RESTORE_DIR/files/.env" "$BACKEND_DIR/.env"
cp "$RESTORE_DIR/files/nginx.oci.conf" "$BACKEND_DIR/nginx/nginx.oci.conf"
cp "$RESTORE_DIR/files/traccar.xml" "$BACKEND_DIR/conf/traccar.xml"

if [[ -d "$RESTORE_DIR/files/ssl" ]]; then
  rm -rf "$BACKEND_DIR/ssl"
  cp -R "$RESTORE_DIR/files/ssl" "$BACKEND_DIR/ssl"
fi

if [[ -f "$RESTORE_DIR/files/cert.pem" ]]; then
  cp "$RESTORE_DIR/files/cert.pem" "$BACKEND_DIR/cert.pem"
fi

if [[ -f "$RESTORE_DIR/files/key.pem" ]]; then
  cp "$RESTORE_DIR/files/key.pem" "$BACKEND_DIR/key.pem"
fi

if [[ -f "$RESTORE_DIR/frontend-dist.tar.gz" ]]; then
  log "Restoring frontend dist"
  rm -rf "$REPO_ROOT/traccar-fleet-system/frontend/dist"
  mkdir -p "$REPO_ROOT/traccar-fleet-system/frontend"
  tar -xzf "$RESTORE_DIR/frontend-dist.tar.gz" -C "$REPO_ROOT/traccar-fleet-system/frontend"
fi

set -a
source "$BACKEND_DIR/.env"
set +a

log "Starting database services"
(
  cd "$BACKEND_DIR"
  docker-compose up -d traccar-mysql fuel-postgres
)

wait_for_health numztrak-mysql 240
wait_for_health numztrak-postgres 240

log "Restoring PostgreSQL"
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" numztrak-postgres \
  psql -U numztrak -d postgres -c 'DROP DATABASE IF EXISTS numztrak_fuel;'
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" numztrak-postgres \
  psql -U numztrak -d postgres -c 'CREATE DATABASE numztrak_fuel OWNER numztrak;'
cat "$RESTORE_DIR/postgres.sql" | docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" \
  numztrak-postgres psql -U numztrak -d numztrak_fuel
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" numztrak-postgres \
  psql -U numztrak -d numztrak_fuel -c "ALTER USER numztrak WITH PASSWORD '$POSTGRES_PASSWORD';"

log "Restoring MySQL"
docker exec \
  -e RESTORE_MYSQL_ROOT_PASSWORD="$MYSQL_ROOT_PASSWORD" \
  -e RESTORE_MYSQL_PASSWORD="$MYSQL_PASSWORD" \
  numztrak-mysql \
  sh -lc 'mysql -uroot -p"$RESTORE_MYSQL_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS traccar; CREATE DATABASE traccar CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER IF NOT EXISTS '\''traccar'\''@'\''%'\'' IDENTIFIED BY '\''$RESTORE_MYSQL_PASSWORD'\''; ALTER USER '\''traccar'\''@'\''%'\'' IDENTIFIED BY '\''$RESTORE_MYSQL_PASSWORD'\''; GRANT ALL PRIVILEGES ON traccar.* TO '\''traccar'\''@'\''%'\''; FLUSH PRIVILEGES;"'
cat "$RESTORE_DIR/mysql.sql" | docker exec -i numztrak-mysql \
  sh -lc 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" traccar'

log "Starting application services"
(
  cd "$BACKEND_DIR"
  docker-compose up -d traccar-server fuel-api erb-worker erb-api numztrak-nginx
)

wait_for_health numztrak-traccar 240
wait_for_health numztrak-erb-api 240
wait_for_health numztrak-fuel-api 240

if [[ -f "$RESTORE_DIR/erb_data.tar.gz" ]]; then
  erb_mount_source="$(docker inspect numztrak-erb-worker --format '{{range .Mounts}}{{if eq .Destination "/app/data"}}{{if .Name}}{{.Name}}{{else}}{{.Source}}{{end}}{{end}}{{end}}' 2>/dev/null || true)"
  if [[ -n "$erb_mount_source" ]]; then
    log "Restoring ERB data volume"
    docker run --rm \
      -v "$erb_mount_source:/volume" \
      -v "$RESTORE_DIR:/backup:ro" \
      alpine:3.20 \
      sh -lc 'find /volume -mindepth 1 -maxdepth 1 -exec rm -rf {} + && tar -xzf /backup/erb_data.tar.gz -C /volume'
    docker restart numztrak-erb-worker numztrak-erb-api >/dev/null
  else
    log "Skipping ERB data restore; mount not found"
  fi
fi

rm -rf "$EXTRACT_ROOT"
log "Restore complete"