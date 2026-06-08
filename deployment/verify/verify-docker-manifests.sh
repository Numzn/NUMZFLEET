#!/usr/bin/env bash
set -euo pipefail

log() { printf '[verify-manifests] %s\n' "$*"; }
fail() { printf '[verify-manifests] ERROR: %s\n' "$*" >&2; exit 1; }

SHA="${1:-}"
PREFIX="${2:-${REGISTRY_PREFIX:-numz14}}"

[[ -n "$SHA" ]] || fail "Usage: $0 <full-git-sha> [registry-prefix]"
[[ "$SHA" =~ ^[0-9a-fA-F]{40}$ ]] || fail "SHA must be a full 40-character git SHA: $SHA"

check_via_docker() {
  command -v docker >/dev/null 2>&1 || return 1
  docker manifest inspect "$1" >/dev/null 2>&1
}

check_via_hub_api() {
  local repository="$1"
  local tag="$2"
  local user="${DOCKERHUB_USERNAME:-numz14}"
  local pass="${DOCKERHUB_TOKEN:-}"
  [[ -n "$pass" ]] || return 1

  local token
  token="$(curl -fsS -X POST -H 'Content-Type: application/json' \
    -d "{\"username\":\"${user}\",\"password\":\"${pass}\"}" \
    https://hub.docker.com/v2/users/login/ | python3 -c "import json,sys; print(json.load(sys.stdin).get('token',''))")"
  [[ -n "$token" ]] || return 1

  local namespace="${repository%%/*}"
  local repo="${repository#*/}"
  curl -fsS -H "Authorization: JWT ${token}" \
    "https://hub.docker.com/v2/repositories/${namespace}/${repo}/tags/${tag}/" >/dev/null 2>&1
}

check_manifest() {
  local ref="$1"
  local repository="${ref%:*}"
  local tag="${ref#*:}"
  if check_via_docker "$ref"; then
    return 0
  fi
  check_via_hub_api "$repository" "$tag"
}

for image in numzfleet-frontend numzfleet-backend numzfleet-erb; do
  ref="${PREFIX}/${image}:${SHA}"
  log "Checking manifest: $ref"
  check_manifest "$ref" || fail "manifest not found: $ref"
done

log "All required manifests found for SHA=$SHA"
