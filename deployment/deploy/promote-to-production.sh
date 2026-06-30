#!/usr/bin/env bash
# Promote a staging-validated SHA to OCI production (pull only).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/deployment/compose/docker-compose.prod.yml"
FULL_DEPLOY_SCRIPT="$ROOT_DIR/deployment/deploy/full-production-deploy.sh"
STATE_FILE="$ROOT_DIR/deployment/deploy/.last_production_deploy"
HISTORY_FILE="$ROOT_DIR/deployment/deploy/.production_deploy_history"

log() { printf '[promote-prod] %s\n' "$*"; }
fail() { printf '[promote-prod] ERROR: %s\n' "$*" >&2; exit 1; }

SHA="${1:-}"
ENV_FILE="${2:-$ROOT_DIR/deployment/.env}"

[[ -n "$SHA" ]] || fail "Usage: $0 <full-git-sha> [env-file]"
[[ "$SHA" =~ ^[0-9a-fA-F]{40}$ ]] || fail "SHA must be a full 40-character git SHA: $SHA"
[[ -f "$ENV_FILE" ]] || fail "Missing env file: $ENV_FILE"
[[ -f "$COMPOSE_FILE" ]] || fail "Missing compose file: $COMPOSE_FILE"
[[ -f "$FULL_DEPLOY_SCRIPT" ]] || fail "Missing script: $FULL_DEPLOY_SCRIPT"

if grep -nE '^[[:space:]]*build:' "$COMPOSE_FILE" >/dev/null; then
  fail "Production compose contains build entries; OCI deploy must remain pull-only"
fi

# shellcheck disable=SC1090
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

case "${REGISTRY_PROVIDER:-}" in
  dockerhub)
    export REGISTRY_PREFIX="${REGISTRY_PREFIX:-${DOCKERHUB_USERNAME:-}}"
    ;;
  ghcr)
    export REGISTRY_PREFIX="${REGISTRY_PREFIX:-ghcr.io/${GHCR_OWNER:-}}"
    ;;
  *)
    fail "REGISTRY_PROVIDER must be dockerhub or ghcr"
    ;;
esac

export PROMOTED_SHA="$SHA"
# Staging promotion gate is off by default (staging retired). Set REQUIRE_STAGING_GATE=1 to enforce v3 gate.
if [[ "${REQUIRE_STAGING_GATE:-0}" == "1" ]]; then
  if [[ "${SKIP_PROMOTION_GATE:-0}" == "1" ]]; then
    log "SKIP_PROMOTION_GATE=1 set; relying on upstream gate checks"
  else
    : "${GITHUB_TOKEN:?GITHUB_TOKEN is required for promotion gate}"
    : "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required for promotion gate}"
    bash "$ROOT_DIR/deployment/verify/verify-staging-promotion.sh" "$SHA" "${REGISTRY_PREFIX:-numz14}"
  fi
else
  log "Staging promotion gate skipped (REQUIRE_STAGING_GATE not set). See deployment/STAGING_RETIRED.md"
fi

log "Promotion gate passed. Running full production deploy for SHA=$SHA"
bash "$FULL_DEPLOY_SCRIPT" "$SHA" "$ENV_FILE"

mkdir -p "$(dirname "$STATE_FILE")" "$(dirname "$HISTORY_FILE")"
if [[ -f "$STATE_FILE" ]]; then
  PREV_SHA="$(cat "$STATE_FILE" || true)"
  if [[ -n "$PREV_SHA" && "$PREV_SHA" != "$SHA" ]]; then
    if [[ ! -f "$HISTORY_FILE" ]] || [[ "$(tail -n1 "$HISTORY_FILE" 2>/dev/null || true)" != "$PREV_SHA" ]]; then
      printf '%s\n' "$PREV_SHA" >> "$HISTORY_FILE"
    fi
  fi
fi
if [[ ! -f "$HISTORY_FILE" ]] || [[ "$(tail -n1 "$HISTORY_FILE" 2>/dev/null || true)" != "$SHA" ]]; then
  printf '%s\n' "$SHA" >> "$HISTORY_FILE"
fi
printf '%s\n' "$SHA" > "$STATE_FILE"

log "Production promotion complete. Current SHA recorded in $STATE_FILE"
