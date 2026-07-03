#!/usr/bin/env bash
set -euo pipefail

# Full git SHA (matches GITHUB_SHA in CI). Use for immutable image tags.
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git rev-parse HEAD
else
  echo "ERROR: git repository not found." >&2
  exit 1
fi
