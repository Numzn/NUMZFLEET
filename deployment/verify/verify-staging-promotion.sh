#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

log() { printf '[verify-staging-promotion] %s\n' "$*"; }
fail() { printf '[verify-staging-promotion] ERROR: %s\n' "$*" >&2; exit 1; }

SHA="${1:-}"
REGISTRY_PREFIX="${2:-${REGISTRY_PREFIX:-numz14}}"

[[ -n "$SHA" ]] || fail "Usage: $0 <full-git-sha> [registry-prefix]"
[[ "$SHA" =~ ^[0-9a-fA-F]{40}$ ]] || fail "SHA must be a full 40-character git SHA: $SHA"

: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required (owner/repo)}"
: "${GITHUB_API_URL:=https://api.github.com}"

bash "$ROOT_DIR/deployment/verify/verify-docker-manifests.sh" "$SHA" "$REGISTRY_PREFIX"

deployments_json="$(curl -fsS \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "$GITHUB_API_URL/repos/$GITHUB_REPOSITORY/deployments?sha=$SHA&environment=staging&per_page=20")"

deployment_ids="$(printf '%s' "$deployments_json" | python3 -c 'import json,sys; print("\n".join(str(d["id"]) for d in json.load(sys.stdin)))')"
[[ -n "$deployment_ids" ]] || fail "No staging deployments found for SHA=$SHA"

has_success=0
for dep_id in $deployment_ids; do
  statuses_json="$(curl -fsS \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "$GITHUB_API_URL/repos/$GITHUB_REPOSITORY/deployments/$dep_id/statuses?per_page=20")"
  state="$(printf '%s' "$statuses_json" | python3 -c 'import json,sys; rows=json.load(sys.stdin); print(rows[0]["state"] if rows else "")')"
  if [[ "$state" == "success" ]]; then
    has_success=1
    log "Found successful staging deployment id=$dep_id for SHA=$SHA"
    break
  fi
done

[[ "$has_success" -eq 1 ]] || fail "No successful staging deployment status found for SHA=$SHA"

log "Promotion gate passed for SHA=$SHA"
