#!/usr/bin/env bash
set -euo pipefail

if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git rev-parse --short=12 HEAD
else
  echo "ERROR: git repository not found." >&2
  exit 1
fi
