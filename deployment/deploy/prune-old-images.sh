#!/usr/bin/env bash
# Retention cleanup: keep the KEEP_COUNT most recent deployed SHAs' images
# (per repo), remove older ones, then clear dangling layers and stale build
# cache. Deliberately conservative — rollback only ever needs the single
# immediately-previous SHA (see full-production-deploy.sh's auto-rollback),
# so keeping 5 is generous headroom, not the minimum.
#
# Never run this before/during a deploy — only after a deploy has already
# succeeded, so a failing deploy's images are never at risk of being pruned
# out from under a possible retry or rollback.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
HISTORY_FILE="$ROOT_DIR/deployment/deploy/.deploy_history"
KEEP_COUNT="${IMAGE_RETENTION_KEEP_COUNT:-5}"
REPOS=(numzfleet-backend numzfleet-frontend numzfleet-erb)

log() { printf '[prune-images] %s\n' "$*"; }

if [[ ! -f "$HISTORY_FILE" ]]; then
  log "No deploy history file at $HISTORY_FILE — skipping (nothing to base retention on)"
  exit 0
fi

# Most recent KEEP_COUNT distinct SHAs, newest first, de-duplicated.
mapfile -t KEEP_SHAS < <(tac "$HISTORY_FILE" | awk '!seen[$0]++' | head -n "$KEEP_COUNT")

if [[ "${#KEEP_SHAS[@]}" -eq 0 ]]; then
  log "No SHAs found in $HISTORY_FILE — skipping"
  exit 0
fi

log "Keeping ${#KEEP_SHAS[@]} most recent SHAs: ${KEEP_SHAS[*]}"

before_df="$(docker system df --format '{{.Size}}' | head -1)"
removed=0
skipped=0

for repo in "${REPOS[@]}"; do
  while IFS= read -r tag; do
    [[ -z "$tag" ]] && continue
    sha="${tag##*:}"
    keep=false
    for k in "${KEEP_SHAS[@]}"; do
      [[ "$sha" == "$k" ]] && keep=true && break
    done
    if [[ "$keep" == false ]]; then
      if docker rmi "$tag" >/dev/null 2>&1; then
        removed=$((removed + 1))
      else
        skipped=$((skipped + 1))
      fi
    fi
  done < <(docker images --format '{{.Repository}}:{{.Tag}}' | grep -E "/${repo}:" || true)
done

log "Removed $removed old image tags, skipped $skipped (already gone or in use)"

log "Pruning dangling layers"
docker image prune -f >/dev/null

log "Pruning build cache older than 7 days"
docker builder prune -f --filter until=168h >/dev/null 2>&1 || true

log "Reclaimed (approx, images): before=$before_df after=$(docker system df --format '{{.Size}}' | head -1)"
