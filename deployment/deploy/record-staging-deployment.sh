#!/usr/bin/env bash
set -euo pipefail

log() { printf '[record-staging-deployment] %s\n' "$*"; }
fail() { printf '[record-staging-deployment] ERROR: %s\n' "$*" >&2; exit 1; }

SHA="${1:-}"
RUN_URL="${2:-}"

[[ -n "$SHA" ]] || fail "Usage: $0 <sha> [run-url]"
[[ "$SHA" =~ ^[0-9a-fA-F]{40}$ ]] || fail "SHA must be a full 40-character git SHA: $SHA"

: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required (owner/repo)}"
: "${GITHUB_API_URL:=https://api.github.com}"

api() {
  curl -fsS \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "$@"
}

payload="$(cat <<EOF
{
  "ref": "$SHA",
  "environment": "staging",
  "description": "NumzLab staging deployment",
  "auto_merge": false,
  "required_contexts": []
}
EOF
)"

response="$(api -X POST -d "$payload" "$GITHUB_API_URL/repos/$GITHUB_REPOSITORY/deployments")"
deployment_id="$(printf '%s' "$response" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")"
[[ -n "$deployment_id" ]] || fail "Failed to parse deployment id"

status_payload="$(cat <<EOF
{
  "state": "success",
  "log_url": "${RUN_URL}",
  "environment_url": "http://100.121.79.2:3003",
  "description": "Staging deployment and smoke checks passed"
}
EOF
)"

api -X POST -d "$status_payload" \
  "$GITHUB_API_URL/repos/$GITHUB_REPOSITORY/deployments/$deployment_id/statuses" >/dev/null

log "Recorded staging deployment id=$deployment_id sha=$SHA"
