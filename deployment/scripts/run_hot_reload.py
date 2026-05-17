#!/usr/bin/env python3
"""
Start the NUMZFLEET frontend Vite dev server (HMR / hot reload).

Usage (from repo root or anywhere):
  python deployment/scripts/run_hot_reload.py
  python deployment/scripts/run_hot_reload.py --local

Requires Node.js/npm on PATH. For live APIs, run Docker Compose from repo root first
(Traccar :8082, fuel-api :3000). Default UI: http://localhost:5174
"""

from __future__ import annotations

import argparse
import os
import shutil
import socket
import subprocess
import sys
from pathlib import Path

DEFAULT_PORT = 5174
FRONTEND_REL = Path("traccar-fleet-system/frontend")


def repo_root() -> Path:
    """Resolve monorepo root from this script or cwd."""
    here = Path(__file__).resolve().parent
    candidate = here.parent.parent
    if (candidate / FRONTEND_REL / "package.json").is_file():
        return candidate
    cwd = Path.cwd()
    if (cwd / FRONTEND_REL / "package.json").is_file():
        return cwd
    if (cwd / "package.json").is_file() and cwd.name == "frontend":
        return cwd.parent.parent
    sys.exit(
        f"Could not find {FRONTEND_REL}/package.json. "
        "Run from the NUMZFLEET repo root or set cwd there."
    )


def port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex((host, port)) == 0


def ensure_npm(frontend: Path, install: bool) -> None:
    if shutil.which("npm") is None:
        sys.exit("npm not found on PATH. Install Node.js 20+ and retry.")
    node_modules = frontend / "node_modules"
    if node_modules.is_dir():
        return
    if not install:
        print(
            "[hot-reload] node_modules missing. Run once:\n"
            f"  cd {frontend}\n"
            "  npm ci --legacy-peer-deps\n"
            "Or re-run with --install",
            file=sys.stderr,
        )
        sys.exit(1)
    print("[hot-reload] Installing dependencies (npm ci --legacy-peer-deps)...")
    subprocess.run(
        ["npm", "ci", "--legacy-peer-deps"],
        cwd=frontend,
        check=True,
        shell=os.name == "nt",
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Start Vite dev server with HMR for NUMZFLEET frontend.",
    )
    parser.add_argument(
        "--local",
        action="store_true",
        help="Use npm run start:local (LOCAL_DEV=true, explicit localhost API targets).",
    )
    parser.add_argument(
        "--install",
        action="store_true",
        help="Run npm ci --legacy-peer-deps if node_modules is missing.",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help=f"Dev server port (default {DEFAULT_PORT}; also set VITE_DEV_SERVER_PORT).",
    )
    args = parser.parse_args()

    root = repo_root()
    frontend = (root / FRONTEND_REL).resolve()

    ensure_npm(frontend, args.install)

    if port_in_use(args.port):
        print(
            f"[hot-reload] WARN: port {args.port} is already in use. "
            "Stop the other process or set VITE_DEV_SERVER_PORT.",
            file=sys.stderr,
        )

    env = os.environ.copy()
    env["VITE_DEV_SERVER_PORT"] = str(args.port)
    if args.local:
        env["LOCAL_DEV"] = "true"
        npm_script = "start:local"
        mode = "LOCAL_DEV (start:local)"
    else:
        env.pop("LOCAL_DEV", None)
        npm_script = "dev"
        mode = "DOCKER-style dev (proxies to localhost:8082 / :3000)"

    print("==============================")
    print("NUMZFLEET — Vite hot reload")
    print("==============================")
    print(f"Frontend: {frontend}")
    print(f"Mode:     {mode}")
    print(f"URL:      http://localhost:{args.port}/")
    print()
    print("APIs (host):")
    print("  Traccar:  http://localhost:8082")
    print("  Fuel API: http://localhost:3000")
    print()
    print("Tip: from repo root, start backends:")
    print("  .\\rebuild-stack.ps1 -SkipVerify")
    print("  # or: docker compose -f docker-compose.yml up -d")
    print("  # stop static UI on :3002 if needed: docker compose stop frontend")
    print()
    print("Press Ctrl+C to stop.\n")

    cmd = ["npm", "run", npm_script]
    try:
        return subprocess.call(
            cmd,
            cwd=frontend,
            env=env,
            shell=os.name == "nt",
        )
    except KeyboardInterrupt:
        print("\n[hot-reload] Stopped.")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
