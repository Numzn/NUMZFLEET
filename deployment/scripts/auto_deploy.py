#!/usr/bin/env python3
"""
NUMZFLEET workstation deploy driver — one command from laptop to production.

Flow (see deployment/REGISTRY_DEPLOY.md, section **auto_deploy.py (workstation → server)**):
  1. Optional: git add / commit (auto message from paths unless -m / --prompt-message)
  2. git push origin HEAD:<branch> (updates remote branch from current commit; not only local <branch>)
  3. SSH: server repo fetch + reset (or merge) to match remote
  4. SSH: registry deploy, or migrate+deploy when fuel-api/migrations changed

Config: deployment/scripts/auto_deploy.defaults.env, optional auto_deploy.env (gitignored).
Windows: use deployment/scripts/... paths; see deployment/OCI_SSH.md for keys.
"""

from __future__ import annotations

import argparse
import os
import shlex
import shutil
import subprocess
import sys
import time
from pathlib import Path

try:
    from auto_deploy_commit_message import suggest_commit_message as _suggest_commit_message
except ImportError:
    _suggest_commit_message = None


def _env_bool(name: str, default: bool = True) -> bool:
    v = os.environ.get(name)
    if v is None:
        return default
    return v.strip().lower() not in ("0", "false", "no", "off")


def _env_int(name: str, default: int) -> int:
    v = os.environ.get(name)
    if v is None or not str(v).strip():
        return default
    try:
        return int(v.strip(), 10)
    except ValueError:
        return default


def _env_effective_empty(name: str) -> bool:
    v = os.environ.get(name)
    return v is None or not str(v).strip()


def _apply_env_text(text: str, *, only_if_empty: bool) -> None:
    """Parse KEY=value lines.

    only_if_empty=True: set only when the key is unset or blank in os.environ (defaults file).
    only_if_empty=False: override mode for auto_deploy.env — non-empty values win; empty value
    does not wipe an existing/default (so NUMZFLEET_SSH_HOST= alone keeps defaults).
    """
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip()
        if not key:
            continue
        if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
            val = val[1:-1]
        if only_if_empty:
            if _env_effective_empty(key):
                os.environ[key] = val
        else:
            if not str(val).strip():
                continue
            os.environ[key] = val


def load_auto_deploy_env_file(repo: Path) -> tuple[Path | None, Path | None]:
    """
    Load tracked defaults, then optional local overrides.

    1. deployment/scripts/auto_deploy.defaults.env — only fills empty env keys (won't override exports).
    2. deployment/scripts/auto_deploy.env if present, or NUMZFLEET_AUTO_DEPLOY_ENV_FILE — overrides.

    Returns (defaults_path_loaded_or_none, user_path_loaded_or_none).
    """
    scripts = repo / "deployment" / "scripts"
    defaults_path = (scripts / "auto_deploy.defaults.env").resolve()
    user_primary = (scripts / "auto_deploy.env").resolve()

    loaded_defaults: Path | None = None
    loaded_user: Path | None = None

    if defaults_path.is_file():
        try:
            _apply_env_text(defaults_path.read_text(encoding="utf-8-sig"), only_if_empty=True)
            loaded_defaults = defaults_path
        except OSError:
            pass

    path_str = os.environ.get("NUMZFLEET_AUTO_DEPLOY_ENV_FILE", "").strip()
    if path_str:
        user_path = Path(path_str).expanduser()
        if not user_path.is_absolute():
            user_path = (repo / user_path).resolve()
    else:
        user_path = user_primary

    if user_path.is_file():
        try:
            _apply_env_text(user_path.read_text(encoding="utf-8-sig"), only_if_empty=False)
            loaded_user = user_path
        except OSError:
            pass

    return loaded_defaults, loaded_user


def run_cmd(
    argv: list[str],
    *,
    cwd: Path | None = None,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    print("\n>>>", " ".join(shlex.quote(a) for a in argv), "\n", flush=True)
    return subprocess.run(
        argv,
        cwd=str(cwd) if cwd else None,
        text=True,
        check=check,
    )


def get_output(argv: list[str], *, cwd: Path | None = None) -> str:
    return subprocess.check_output(argv, cwd=str(cwd) if cwd else None, text=True).strip()


def refresh_git_state_after_push(repo: Path, branch: str) -> None:
    """Fetch and align upstream so editors (e.g. VS Code) refresh sync state after `git push origin HEAD:<branch>`."""
    try:
        run_cmd(["git", "fetch", "origin"], cwd=repo, check=False)
        current_branch = get_output(["git", "branch", "--show-current"], cwd=repo).strip()
        if current_branch and current_branch != branch:
            run_cmd(
                ["git", "branch", "--set-upstream-to", f"origin/{branch}", current_branch],
                cwd=repo,
                check=False,
            )
    except Exception:
        pass


def push_head_to_remote_branch(repo: Path, branch: str, *, dry_run: bool) -> None:
    """Push current HEAD to origin/<branch> then refresh local refs (VS Code sync)."""
    ref = f"HEAD:{branch}"
    if dry_run:
        print("[dry-run] would: git push origin", ref)
        return
    run_cmd(["git", "push", "origin", ref], cwd=repo)
    refresh_git_state_after_push(repo, branch)


def ssh_executable() -> str:
    """Resolve ssh: PATH (trust shutil.which), then Windows OpenSSH, then Git for Windows."""
    found = shutil.which("ssh")
    if found:
        return found
    if sys.platform == "win32":
        roots = [
            Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32" / "OpenSSH" / "ssh.exe",
            Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Git" / "usr" / "bin" / "ssh.exe",
            Path(os.environ.get("LocalAppData", "")) / "Programs" / "Git" / "usr" / "bin" / "ssh.exe",
        ]
        for cand in roots:
            if cand.is_file():
                return str(cand)
    return "ssh"


def ssh_identity_args() -> list[str]:
    """Return ['-i', path] when NUMZFLEET_SSH_IDENTITY_FILE points to an existing key (OCI / ssh-prod.sh)."""
    raw = os.environ.get("NUMZFLEET_SSH_IDENTITY_FILE", "").strip()
    if not raw:
        return []
    expanded = os.path.expanduser(raw)
    for candidate in (expanded, raw):
        if candidate and os.path.isfile(candidate):
            return ["-i", candidate]
    print(
        f"[auto_deploy] WARN: NUMZFLEET_SSH_IDENTITY_FILE not found: {raw!r} (expanded: {expanded!r})",
        file=sys.stderr,
    )
    return []


def ssh_remote_cmd(user: str, host: str, inner: str) -> list[str]:
    """Run a bash script on the server (one SSH session).

    Use bash -c (not -lc): login profiles often break non-interactive SSH (PATH, cd, set -e).
    """
    strict = os.environ.get("NUMZFLEET_SSH_STRICT_HOST_KEY_CHECKING", "accept-new")
    connect_timeout = str(_env_int("NUMZFLEET_SSH_CONNECT_TIMEOUT_SECONDS", 45))
    argv = [
        ssh_executable(),
        "-o",
        "BatchMode=yes",
        "-o",
        f"ConnectTimeout={connect_timeout}",
        "-o",
        f"StrictHostKeyChecking={strict}",
    ]
    argv.extend(ssh_identity_args())
    argv.extend(
        [
            f"{user}@{host}",
            "bash",
            "--norc",
            "--noprofile",
            "-c",
            inner,
        ]
    )
    return argv


def files_in_commit(repo: Path, sha: str) -> list[str]:
    return get_output(["git", "diff-tree", "--no-commit-id", "--name-only", "-r", sha], cwd=repo).splitlines()


CI_IMAGE_WORKFLOW = ".github/workflows/build-push-numzfleet-images.yml"

# Must match deployment/oci-server-setup.sh (clone under ubuntu home, not /opt).
REMOTE_REPO_DEFAULT = "/home/ubuntu/NUMZFLEET"


def fix_legacy_opt_repo_path() -> None:
    """auto_deploy.env often still had /opt/NUMZFLEET; real clone is ~/NUMZFLEET for ubuntu."""
    p = os.environ.get("NUMZFLEET_SERVER_REPO_PATH", "").strip().rstrip("/")
    if p != "/opt/NUMZFLEET":
        return
    os.environ["NUMZFLEET_SERVER_REPO_PATH"] = REMOTE_REPO_DEFAULT
    print(
        f"[auto_deploy] NUMZFLEET_SERVER_REPO_PATH was /opt/NUMZFLEET; using {REMOTE_REPO_DEFAULT}. "
        "Remove that line from deployment/scripts/auto_deploy.env if you use a different clone.",
        file=sys.stderr,
    )


def remote_repo_prefix(sp_quoted: str) -> str:
    """Verify repo path with git -C (no cd), then cd for compose/deploy relative paths."""
    return (
        f"export PATH=/usr/local/bin:/usr/bin:/bin && "
        f"git -C {sp_quoted} rev-parse --git-dir >/dev/null 2>&1 || {{ "
        "echo '[auto_deploy] not a git repo at NUMZFLEET_SERVER_REPO_PATH' >&2; exit 1; } && "
        f"cd {sp_quoted} && "
    )


def classify_changes(files: list[str]) -> dict[str, bool]:
    frontend = any(f.startswith("traccar-fleet-system/frontend/") for f in files)
    backend = any(f.startswith("fuel-api/") for f in files)
    erb = any(f.startswith("erb-fuel-monitor/") for f in files)
    workflow = any(f == CI_IMAGE_WORKFLOW for f in files)
    migrations = any(f.startswith("fuel-api/migrations/") for f in files)
    traccar_conf = any(f.startswith("backend/conf/") for f in files)
    image = frontend or backend or erb or workflow
    return {
        "frontend": frontend,
        "backend": backend,
        "erb": erb,
        "workflow": workflow,
        "migrations": migrations,
        "traccar_conf": traccar_conf,
        "image_build_required": image,
    }


# Path prefixes must stay aligned with .github/workflows/build-push-numzfleet-images.yml `paths:`.
CI_IMAGE_PATH_LOG_ARGS = (
    "traccar-fleet-system/frontend",
    "fuel-api",
    "erb-fuel-monitor",
    CI_IMAGE_WORKFLOW,
)


def last_commit_touching_ci_image_paths(repo: Path, ref: str = "HEAD") -> str | None:
    """Latest commit on `ref` ancestry that touches any path that triggers the image build workflow."""
    try:
        out = get_output(
            ["git", "log", ref, "-1", "--format=%H", "--", *CI_IMAGE_PATH_LOG_ARGS],
            cwd=repo,
        ).strip()
    except subprocess.CalledProcessError:
        return None
    return out or None


def adjust_deploy_sha_for_registry_images(
    repo: Path,
    *,
    head_sha: str,
    deploy_sha: str,
    image_tag_source: str,
    flags: dict[str, bool],
    skip_deploy: bool,
    no_auto_image_sha: bool,
) -> str:
    """
    When HEAD did not trigger CI image builds, optionally use the latest ancestor that did,
    so docker pull does not fail with manifest unknown.
    """
    if (
        skip_deploy
        or image_tag_source
        or flags["image_build_required"]
        or no_auto_image_sha
        or not _env_bool("NUMZFLEET_AUTO_DEPLOY_IMAGE_FROM_LAST_CI_COMMIT", True)
    ):
        return deploy_sha

    last_ci = last_commit_touching_ci_image_paths(repo)
    if last_ci and last_ci != head_sha:
        print(
            f"[auto_deploy] Using registry IMAGE_TAG from latest commit that touches CI image paths "
            f"({last_ci[:12]}...), not HEAD ({head_sha[:12]}...), so docker pull matches existing images. "
            f"Server repo and scripts still update to HEAD.\n"
        )
        return last_ci

    if not last_ci:
        print(
            "[auto_deploy] WARN: No commit on this branch touches frontend/fuel-api/erb/CI workflow paths; "
            "cannot auto-pick an image SHA. Run 'Build and push NumzFleet images' or set "
            "NUMZFLEET_DEPLOY_IMAGE_TAG / --deploy-image-tag.\n",
            file=sys.stderr,
        )
        return deploy_sha

    # last_ci == head_sha but path filters said no image build (rare); warn once.
    if deploy_sha == head_sha:
        print(
            "[auto_deploy] WARN: CI may not have built images for this SHA. "
            "If docker pull fails with manifest unknown: run the GitHub Action "
            "'Build and push NumzFleet images' (workflow_dispatch), set "
            "NUMZFLEET_DEPLOY_IMAGE_TAG / --deploy-image-tag, or rely on auto image SHA "
            "(on by default; disable with --no-auto-image-sha or "
            "NUMZFLEET_AUTO_DEPLOY_IMAGE_FROM_LAST_CI_COMMIT=0).\n",
            file=sys.stderr,
        )

    return deploy_sha


def countdown(seconds: int, label: str) -> None:
    for i in range(seconds, 0, -1):
        print(f"\r{label} {i}s  ", end="", flush=True)
        time.sleep(1)
    print(f"\r{label} done.     ", flush=True)


_HELP_EPILOG = """
Env: deployment/scripts/auto_deploy.defaults.env then auto_deploy.env (optional).
Override file: NUMZFLEET_AUTO_DEPLOY_ENV_FILE.

All NUMZFLEET_* variables, flags, and operator flow: deployment/REGISTRY_DEPLOY.md (section auto_deploy).
""".strip()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Commit/push locally, then deploy SHA on server via SSH.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=_HELP_EPILOG,
    )
    parser.add_argument(
        "--repo",
        type=Path,
        default=Path(__file__).resolve().parents[2],
        help="NUMZFLEET repo root (default: parent of deployment/)",
    )
    parser.add_argument(
        "--branch",
        default=None,
        metavar="BRANCH",
        help="Git branch for push and server pull (default: env NUMZFLEET_BRANCH or main, after auto_deploy.env load)",
    )
    parser.add_argument("--skip-git", action="store_true", help="Do not add/commit/push; deploy current HEAD only.")
    parser.add_argument("--dry-run", action="store_true", help="Print what would run; no git or SSH.")
    parser.add_argument("--skip-deploy", action="store_true", help="Stop after push (no SSH).")
    parser.add_argument(
        "--no-migrations",
        action="store_true",
        help="Never run run-migrate-and-deploy.sh (overrides NUMZFLEET_USE_MIGRATIONS).",
    )
    parser.add_argument(
        "-m",
        "--message",
        default=None,
        help="Commit message (non-interactive). If omitted, a message is auto-generated from staged paths unless "
        "NUMZFLEET_AUTO_COMMIT_MESSAGE=0 or --prompt-message.",
    )
    parser.add_argument(
        "--prompt-message",
        action="store_true",
        help="When committing without -m, prompt for the message instead of auto-generating.",
    )
    parser.add_argument(
        "--skip-wait",
        action="store_true",
        help="Do not sleep before remote deploy (skip CI image buffer).",
    )
    parser.add_argument(
        "--ssh-host",
        metavar="HOST",
        default=None,
        help="Server IP or DNS for this run (overrides NUMZFLEET_SSH_HOST). Required for deploy unless env is set.",
    )
    parser.add_argument(
        "--ssh-user",
        metavar="USER",
        default=None,
        help="SSH login for this run (overrides NUMZFLEET_SSH_USER, default ubuntu).",
    )
    parser.add_argument(
        "--ssh-identity-file",
        metavar="PATH",
        default=None,
        help="SSH private key (overrides NUMZFLEET_SSH_IDENTITY_FILE; e.g. ~/.ssh/oci_instance_key.pem).",
    )
    parser.add_argument(
        "--deploy-image-tag",
        metavar="GIT_REF_OR_SHA",
        default=None,
        help="Registry IMAGE_TAG (full SHA recommended). Use when HEAD did not run CI (e.g. deployment-only). "
        "Resolves via git rev-parse. Overrides NUMZFLEET_DEPLOY_IMAGE_TAG.",
    )
    parser.add_argument(
        "--no-auto-image-sha",
        action="store_true",
        help="Do not auto-pick IMAGE_TAG from the latest commit touching CI image paths when HEAD is deployment-only.",
    )
    args = parser.parse_args()

    repo: Path = args.repo.resolve()
    try:
        get_output(["git", "-C", str(repo), "rev-parse", "--is-inside-work-tree"])
    except subprocess.CalledProcessError:
        print(f"Not a git repository (or invalid --repo): {repo}", file=sys.stderr)
        return 2

    _, user_env_path = load_auto_deploy_env_file(repo)

    if args.ssh_identity_file:
        os.environ["NUMZFLEET_SSH_IDENTITY_FILE"] = str(Path(args.ssh_identity_file).expanduser())

    fix_legacy_opt_repo_path()

    branch = (args.branch or os.environ.get("NUMZFLEET_BRANCH") or "main").strip()
    user = (args.ssh_user or os.environ.get("NUMZFLEET_SSH_USER") or "ubuntu").strip()
    host = (args.ssh_host or os.environ.get("NUMZFLEET_SSH_HOST") or "").strip()
    server_path = os.environ.get("NUMZFLEET_SERVER_REPO_PATH", REMOTE_REPO_DEFAULT).rstrip("/")
    deploy_env = os.environ.get("NUMZFLEET_DEPLOY_ENV", "deployment/.env")
    use_migrations = _env_bool("NUMZFLEET_USE_MIGRATIONS", True) and not args.no_migrations
    wait_sec = _env_int("NUMZFLEET_IMAGE_BUILD_WAIT_SECONDS", 90)

    if not args.skip_deploy and not host:
        hint = ""
        if user_env_path and not os.environ.get("NUMZFLEET_SSH_HOST", "").strip():
            hint = f"(Loaded {user_env_path}: NUMZFLEET_SSH_HOST empty; remove line or set host.)\n"
        print(
            "NUMZFLEET_SSH_HOST not set. Use --ssh-host, or auto_deploy.defaults.env / auto_deploy.env, "
            "or --skip-deploy.\n" + hint + "See deployment/REGISTRY_DEPLOY.md.",
            file=sys.stderr,
        )
        return 2

    print("\n==============================")
    print("NUMZFLEET AUTO DEPLOY")
    print("==============================\n")

    if args.dry_run:
        print("[dry-run] repo=", repo, "branch=", branch, "host=", host or "(none)", flush=True)

    if not args.skip_git:
        status = get_output(["git", "status", "--short"], cwd=repo)
        if not status:
            print("No changes detected (working tree clean).")
            if args.skip_deploy:
                return 0
            print(
                "Proceeding to deploy: will `git push origin HEAD:<branch>` so the commit you are on "
                f"updates remote `{branch}` (not only the local `{branch}` ref if you are on another branch).",
            )
            push_head_to_remote_branch(repo, branch, dry_run=args.dry_run)
        else:
            print("Changed files:\n", status, "\n", sep="")
            if args.dry_run:
                print("[dry-run] would: git add .")
            else:
                run_cmd(["git", "add", "."], cwd=repo)

            msg = (args.message or "").strip()
            if not msg:
                if args.dry_run:
                    print("[dry-run] would auto-generate commit message from staged files (or use -m)")
                    msg = "[dry-run placeholder]"
                elif args.prompt_message or not _env_bool("NUMZFLEET_AUTO_COMMIT_MESSAGE", True):
                    msg = input("\nEnter commit message: ").strip()
                elif _suggest_commit_message is not None:
                    staged = get_output(["git", "diff", "--cached", "--name-only"], cwd=repo).splitlines()
                    msg = _suggest_commit_message(staged)
                    print(f"\n[auto_deploy] Generated commit message: {msg}\n")
                else:
                    msg = input("\nEnter commit message: ").strip()
            if not msg or msg == "[dry-run placeholder]":
                if not args.dry_run:
                    print("Commit message required.", file=sys.stderr)
                    return 1

            if args.dry_run and msg == "[dry-run placeholder]":
                print("[dry-run] would: git commit -m <your message>")
            elif args.dry_run:
                print("[dry-run] would: git commit -m", repr(msg))
            else:
                run_cmd(["git", "commit", "-m", msg], cwd=repo)

            push_head_to_remote_branch(repo, branch, dry_run=args.dry_run)
    else:
        dirty = get_output(["git", "status", "--short"], cwd=repo)
        if dirty:
            print(
                "\nWarning: working tree has uncommitted changes; "
                "deploy uses last commit (HEAD), not these files.\n",
                file=sys.stderr,
            )

    sha = get_output(["git", "rev-parse", "HEAD"], cwd=repo)
    print(f"\nCommit SHA: {sha}\n")

    image_tag_source = (args.deploy_image_tag or os.environ.get("NUMZFLEET_DEPLOY_IMAGE_TAG") or "").strip()
    deploy_sha = sha
    if image_tag_source:
        try:
            deploy_sha = get_output(["git", "rev-parse", image_tag_source], cwd=repo)
        except subprocess.CalledProcessError:
            print(
                f"[auto_deploy] Could not resolve NUMZFLEET_DEPLOY_IMAGE_TAG / --deploy-image-tag: {image_tag_source!r}",
                file=sys.stderr,
            )
            return 2
        if deploy_sha != sha:
            print(
                f"[auto_deploy] Registry deploy will pull IMAGE_TAG={deploy_sha} "
                f"(HEAD={sha}; override from ref {image_tag_source!r}).\n"
            )

    changed = files_in_commit(repo, sha)
    flags = classify_changes(changed)

    print("Change summary:")
    for k in ("frontend", "backend", "erb", "workflow", "migrations", "traccar_conf", "image_build_required"):
        print(f"  {k}: {flags[k]}")
    print()

    if args.skip_deploy:
        print("==============================")
        print("DONE (--skip-deploy)")
        print("==============================\n")
        return 0

    if flags["image_build_required"] and wait_sec > 0 and not args.skip_wait:
        print("Image build likely triggered (paths match CI workflow filters).")
        if args.dry_run:
            print(f"[dry-run] Would wait {wait_sec}s for GitHub Actions to push images.\n")
        else:
            print(f"Waiting {wait_sec}s for GitHub Actions to push images...\n")
            countdown(wait_sec, "Deploy buffer")
    elif flags["image_build_required"] and args.skip_wait:
        print("Image build likely; skipping wait (--skip-wait).\n")
    else:
        print("No image rebuild required from path filters (config-only or unrelated paths).")
        print("Registry deploy still pins images to this commit SHA.\n")

    deploy_sha = adjust_deploy_sha_for_registry_images(
        repo,
        head_sha=sha,
        deploy_sha=deploy_sha,
        image_tag_source=image_tag_source,
        flags=flags,
        skip_deploy=args.skip_deploy,
        no_auto_image_sha=args.no_auto_image_sha,
    )

    sp = shlex.quote(server_path)
    env_q = shlex.quote(deploy_env)
    sha_q = shlex.quote(deploy_sha)
    rpx = remote_repo_prefix(sp)

    pull_strategy = os.environ.get("NUMZFLEET_GIT_PULL_STRATEGY", "reset").strip().lower()
    if pull_strategy in ("merge", "pull", "rebase"):
        pull_cmd = f"git pull origin {shlex.quote(branch)}"
    else:
        # Deploy servers: discard tracked edits so pull never blocks (local compose tweaks, etc.).
        pull_cmd = f"git fetch origin {shlex.quote(branch)} && git reset --hard FETCH_HEAD"

    git_pull_inner = rpx + pull_cmd
    compose_restart_inner = (
        rpx
        + f"docker compose -f deployment/compose/docker-compose.prod.yml "
        f"--env-file {env_q} restart traccar"
    )

    if flags["migrations"] and use_migrations:
        deploy_inner = (
            rpx
            + "chmod +x deployment/run-migrate-and-deploy.sh && "
            + f"./deployment/run-migrate-and-deploy.sh {sha_q} {env_q}"
        )
        deploy_label = "migrate + deploy"
    else:
        deploy_inner = rpx + f"bash deployment/deploy/deploy-from-registry.sh {sha_q} {env_q}"
        deploy_label = "registry deploy"

    if args.dry_run:
        print("[dry-run] Remote (same as actual SSH):\n")
        sync_label = "git pull" if pull_strategy in ("merge", "pull", "rebase") else "git fetch + reset --hard"
        print(f"  1) {user}@{host}:{server_path} -> {sync_label} ({branch})")
        print(f"  2) {user}@{host}:{server_path} -> {deploy_label} ({deploy_sha[:12]}...) env={deploy_env}")
        if flags["traccar_conf"] and not flags["image_build_required"]:
            print(f"  3) {user}@{host}:{server_path} -> docker compose restart traccar")
        print("\n==============================")
        print("DONE (--dry-run)")
        print("==============================\n")
        return 0

    ssh_bin = ssh_executable()
    if ssh_bin == "ssh" and shutil.which("ssh") is None:
        print(
            "[auto_deploy] ssh.exe not found (PATH, OpenSSH, or Git usr\\bin). "
            "Use Git Bash, or install OpenSSH Client / Git for Windows.",
            file=sys.stderr,
        )
        return 2

    try:
        run_cmd(ssh_remote_cmd(user, host, git_pull_inner))

        print(f"\nRunning {deploy_label} on server...\n")
        run_cmd(ssh_remote_cmd(user, host, deploy_inner))

        # After a full registry deploy, containers already restart; extra traccar restart
        # only helps config-only pushes when we did NOT pull new images.
        if flags["traccar_conf"] and not flags["image_build_required"]:
            print("\nRestarting Traccar (config changed, no image rebuild)...\n")
            run_cmd(ssh_remote_cmd(user, host, compose_restart_inner))
    except subprocess.CalledProcessError as e:
        print("[auto_deploy] Remote step failed (see command output above).", file=sys.stderr)
        return e.returncode if e.returncode else 1

    print("\n==============================")
    print("DEPLOYMENT COMPLETE")
    print("==============================\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
