"""
Suggest a short conventional commit message from changed paths (NUMZFLEET monorepo).

Used by auto_deploy.py when -m is omitted and NUMZFLEET_AUTO_COMMIT_MESSAGE is enabled.
"""

from __future__ import annotations

CI_IMAGE_WORKFLOW = ".github/workflows/build-push-numzfleet-images.yml"


def classify_files(files: list[str]) -> dict[str, bool]:
    frontend = any(f.startswith("traccar-fleet-system/frontend/") for f in files)
    backend = any(f.startswith("fuel-api/") for f in files)
    erb = any(f.startswith("erb-fuel-monitor/") for f in files)
    workflow = any(f == CI_IMAGE_WORKFLOW for f in files)
    migrations = any(f.startswith("fuel-api/migrations/") for f in files)
    traccar_conf = any(f.startswith("backend/conf/") for f in files)
    deployment = any(f.startswith("deployment/") for f in files)
    return {
        "frontend": frontend,
        "backend": backend,
        "erb": erb,
        "workflow": workflow,
        "migrations": migrations,
        "traccar_conf": traccar_conf,
        "deployment": deployment,
    }


def suggest_commit_message(files: list[str], *, max_len: int = 72) -> str:
    """Single-line message: safe, descriptive, CI-friendly prefix."""
    files = [f.strip() for f in files if f.strip()]
    if not files:
        return "chore(numzfleet): update"

    flags = classify_files(files)
    areas: list[str] = []
    if flags["frontend"]:
        areas.append("frontend")
    if flags["backend"]:
        areas.append("fuel-api")
    if flags["erb"]:
        areas.append("erb")
    if flags["migrations"]:
        areas.append("migrations")
    if flags["traccar_conf"]:
        areas.append("traccar conf")
    if flags["workflow"]:
        areas.append("CI images workflow")
    if flags["deployment"]:
        areas.append("deployment")

    if not areas:
        # e.g. root docs, backend without fuel-api prefix
        top = sorted({f.split("/")[0] for f in files if "/" in f})
        if top:
            summary = ", ".join(top[:5])
            if len(top) > 5:
                summary += ", ..."
        else:
            summary = files[0][:40] + ("..." if len(files[0]) > 40 else "")
        line = f"chore(numzfleet): {summary}"
    else:
        line = f"chore(numzfleet): {', '.join(areas)}"

    if len(line) <= max_len:
        return line
    return line[: max_len - 3] + "..."
