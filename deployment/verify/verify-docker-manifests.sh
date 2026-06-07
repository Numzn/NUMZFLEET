#!/usr/bin/env bash
set -euo pipefail

log() { printf '[verify-manifests] %s\n' "$*"; }
fail() { printf '[verify-manifests] ERROR: %s\n' "$*" >&2; exit 1; }

SHA="${1:-}"
PREFIX="${2:-${REGISTRY_PREFIX:-numz14}}"

[[ -n "$SHA" ]] || fail "Usage: $0 <full-git-sha> [registry-prefix]"
[[ "$SHA" =~ ^[0-9a-fA-F]{40}$ ]] || fail "SHA must be a full 40-character git SHA: $SHA"

require_cmd() { command -v "$1" >/dev/null 2>&1 || fail "missing command: $1"; }
require_cmd docker

for image in numzfleet-frontend numzfleet-backend numzfleet-erb; do
  ref="${PREFIX}/${image}:${SHA}"
  log "Checking manifest: $ref"
  docker manifest inspect "$ref" >/dev/null 2>&1 || fail "manifest not found: $ref"
done

log "All required manifests found for SHA=$SHA"
