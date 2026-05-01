<#
.SYNOPSIS
    NUMZFLEET Git-first production release script.

.DESCRIPTION
    Enforces the commit-locked release flow:
      1. Local alignment gate  (frontend lint/build + nginx config check)
      2. Commit SHA resolution (defaults to origin/main tip)
      3. Safety check          (SHA must be in origin/main history)
      4. SSH deploy            (server fetches same SHA, builds, restarts services)
      5. Live health checks    (HTTPS, Traccar API, Fuel API)

    Only commits already pushed to origin/main can be deployed.
    No local build artifacts are ever shipped to production.

    Registry image flow (Docker Hub / GHCR): see deployment/DEPLOYMENT_FLOW.md
    and deploy-registry.ps1 (Track B). Full-stack prod default remains this script.

    Fast path (-UseRegistryAppImages): skips server-side npm/Vite for the frontend and
    skips fuel-api image build by pulling pre-pushed images (same tags as deploy-registry.ps1).
    Push images first: .\deploy-registry.ps1 -Action BuildPush -Commit <sha>

.PARAMETER UseRegistryAppImages
    When set, the server pulls numztrak-frontend and numztrak-backend from the registry
    prefix you supply (full SHA tag). Requires images already pushed for that commit.

.PARAMETER RegistryImagePrefix
    Docker Hub user (e.g. myuser) or GHCR path without trailing slash (e.g. ghcr.io/myorg).
    Images must exist as: {prefix}/numztrak-frontend:{Commit} and {prefix}/numztrak-backend:{Commit}

.PARAMETER Server
    Oracle Cloud server IP or hostname.  Default: 129.151.163.95

.PARAMETER User
    SSH user on the server.  Default: ubuntu

.PARAMETER KeyPath
    Path to the SSH private key.  Default: ~/.ssh/oci_instance_key.pem

.PARAMETER Branch
    Source branch on origin to pull the deploy SHA from.  Default: main

.PARAMETER Commit
    Explicit commit SHA to deploy.  When omitted, the tip of origin/Branch is used.

.PARAMETER SkipLocalChecks
    Skip local lint/build/nginx checks.  SHA-on-main validation is still enforced.

.EXAMPLE
    # Deploy latest main
    .\release-prod.ps1

.EXAMPLE
    # Deploy an explicit commit
    .\release-prod.ps1 -Commit abc1234

.EXAMPLE
    # Rollback to a previous known-good SHA
    .\release-prod.ps1 -Commit <prev-sha>

.EXAMPLE
    # Emergency deploy without local checks (SHA still validated)
    .\release-prod.ps1 -SkipLocalChecks

.EXAMPLE
    # Fast path: images already pushed for this commit (see deploy-registry.ps1)
    .\release-prod.ps1 -UseRegistryAppImages -RegistryImagePrefix "mydockerhubuser" -SkipLocalChecks
#>

param(
    [string]$Server    = "129.151.163.95",
    [string]$User      = "ubuntu",
    [string]$KeyPath   = "$HOME/.ssh/oci_instance_key.pem",
    [string]$Branch    = "main",
    [string]$Commit    = "",
    [switch]$SkipLocalChecks,
    [switch]$UseRegistryAppImages,
    [string]$RegistryImagePrefix = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = $PSScriptRoot

# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

function Write-Step($msg) {
    Write-Host ""
    Write-Host ">> $msg" -ForegroundColor Cyan
}

function Write-Ok($msg) { Write-Host "   [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "   [!] $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "   [X] $msg" -ForegroundColor Red }

function Resolve-SshCommand() {
    $candidates = @(
        "C:\Program Files\Git\usr\bin\ssh.exe",
        "C:\Windows\System32\OpenSSH\ssh.exe"
    )
    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    $sshCmd = Get-Command ssh -ErrorAction SilentlyContinue
    if ($sshCmd -and $sshCmd.Path -and (Test-Path $sshCmd.Path)) {
        $item = Get-Item $sshCmd.Path -ErrorAction SilentlyContinue
        if ($item -and $item.Length -gt 0) {
            return $sshCmd.Path
        }
    }
    throw "Unable to locate a valid ssh executable. Install OpenSSH Client or Git for Windows."
}

function Assert-Command($name) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        Write-Fail "Required command not found: $name"
        throw "Missing command: $name"
    }
    Write-Ok "$name found"
}

function Run-Or-Throw($description, [scriptblock]$block) {
    try {
        & $block
        if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
            throw "Exit code: $LASTEXITCODE"
        }
    } catch {
        Write-Fail "$description failed: $_"
        throw
    }
}

# ─────────────────────────────────────────────────────────────
# Banner
# ─────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "=================================================" -ForegroundColor Magenta
Write-Host "  NUMZFLEET - Git-First Production Release" -ForegroundColor Magenta
Write-Host "=================================================" -ForegroundColor Magenta
Write-Host "   Server : $Server"
Write-Host "   Branch : $Branch"
Write-Host "   Key    : $KeyPath"
Write-Host "   Date   : $(Get-Date -Format 'yyyy-MM-dd HH:mm')"

# ─────────────────────────────────────────────────────────────
# PHASE 1 — Preflight checks
# ─────────────────────────────────────────────────────────────

Write-Step "Phase 1 - Preflight"

Assert-Command git
Assert-Command npm

$SshCommand = Resolve-SshCommand
Write-Ok "ssh found: $SshCommand"

if (-not (Test-Path (Join-Path $RepoRoot ".git"))) {
    Write-Fail "Not a git repository root. Run this script from the repo root."
    exit 1
}
Write-Ok "Running from repo root: $RepoRoot"

if (-not (Test-Path $KeyPath)) {
    Write-Fail "SSH key not found: $KeyPath"
    exit 1
}
Write-Ok "SSH key found"

# Check required canonical production files
$requiredFiles = @(
    "backend/docker-compose.prod.yml",
    "backend/nginx/nginx.prod.conf",
    "backend/conf/traccar.xml",
    "deployment/ORACLE_RECOVERY_RUNBOOK.md",
    "traccar-fleet-system/frontend/package.json"
)
foreach ($f in $requiredFiles) {
    $path = Join-Path $RepoRoot $f
    if (-not (Test-Path $path)) {
        Write-Fail "Required file missing: $f"
        exit 1
    }
    Write-Ok "Found $f"
}

# ─────────────────────────────────────────────────────────────
# PHASE 2 — Local alignment gate
# ─────────────────────────────────────────────────────────────

if ($SkipLocalChecks) {
    Write-Step "Phase 2 - Local alignment gate  [SKIPPED: -SkipLocalChecks]"
    Write-Warn "SHA-on-main validation will still be enforced."
} else {
    Write-Step "Phase 2 - Local alignment gate"

    $frontendDir = Join-Path $RepoRoot "traccar-fleet-system/frontend"
    Push-Location $frontendDir

    Write-Host "   -> npm ci" -ForegroundColor DarkGray
    Run-Or-Throw "npm ci" { npm ci }
    Write-Ok "Dependencies installed"

    Write-Host "   -> npm run lint" -ForegroundColor DarkGray
    Run-Or-Throw "ESLint" { npm run lint }
    Write-Ok "Lint passed"

    Write-Host "   -> npm run build (VITE_TRACCAR_PREFIX=/traccar)" -ForegroundColor DarkGray
    $env:VITE_TRACCAR_PREFIX = '/traccar'
    Run-Or-Throw "Vite build" { npm run build }
    Write-Ok "Build passed"

    Pop-Location

    # Nginx config syntax check (requires docker locally, optional)
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        Write-Host "   -> nginx -t on nginx.prod.conf" -ForegroundColor DarkGray
        $nginxConf = (Join-Path $RepoRoot "backend/nginx/nginx.prod.conf").Replace('\', '/')
        $certPem = (Join-Path $RepoRoot "backend/cert.pem").Replace('\', '/')
        $keyPem = (Join-Path $RepoRoot "backend/key.pem").Replace('\', '/')
        Run-Or-Throw "nginx config check" {
            docker run --rm `
                --add-host fuel-api:127.0.0.1 `
                --add-host traccar-server:127.0.0.1 `
                --add-host erb-api:127.0.0.1 `
                -v "${nginxConf}:/etc/nginx/conf.d/default.conf:ro" `
                -v "${certPem}:/etc/ssl/certs/numz.site.crt:ro" `
                -v "${keyPem}:/etc/ssl/private/numz.site.key:ro" `
                nginx:alpine nginx -t
        }
        Write-Ok "Nginx config valid"
    } else {
        Write-Warn "Docker not found locally - skipping nginx config check (CI will catch this)."
    }
}

# ─────────────────────────────────────────────────────────────
# PHASE 3 — Commit SHA resolution
# ─────────────────────────────────────────────────────────────

Write-Step "Phase 3 - Resolve deploy commit"

Run-Or-Throw "git fetch" { git -C $RepoRoot fetch origin --prune --quiet }
Write-Ok "Fetched latest origin refs"

if ([string]::IsNullOrWhiteSpace($Commit)) {
    $Commit = (git -C $RepoRoot rev-parse "origin/$Branch").Trim()
    Write-Ok "Resolved tip of origin/$Branch -> $Commit"
} else {
    # Expand partial SHA
    $Commit = (git -C $RepoRoot rev-parse $Commit).Trim()
    Write-Ok "Resolved explicit SHA -> $Commit"
}

if ([string]::IsNullOrWhiteSpace($Commit)) {
    Write-Fail "Could not resolve commit SHA. Does origin/$Branch exist?"
    exit 1
}

# ─────────────────────────────────────────────────────────────
# PHASE 4 — Safety: SHA must be in origin/main
# ─────────────────────────────────────────────────────────────

Write-Step "Phase 4 - Verify commit is in origin/$Branch"

$contains = git -C $RepoRoot branch -r --contains $Commit 2>&1 | Select-String "origin/$Branch"
if (-not $contains) {
    Write-Fail "Commit $Commit is NOT in origin/$Branch history."
    Write-Fail "Push your changes and merge to $Branch before deploying."
    exit 1
}
Write-Ok "Commit $Commit is in origin/$Branch - safe to deploy"

if ($UseRegistryAppImages) {
    if ([string]::IsNullOrWhiteSpace($RegistryImagePrefix)) {
        Write-Fail "-UseRegistryAppImages requires -RegistryImagePrefix (e.g. mydockerhubuser or ghcr.io/myorg)."
        exit 1
    }
    Write-Warn "Registry fast path: push images for this commit first:"
    Write-Warn "  .\deploy-registry.ps1 -Action BuildPush -Commit $Commit"
}

# ─────────────────────────────────────────────────────────────
# PHASE 5 — Server deploy (Git-first, SHA-locked)
# ─────────────────────────────────────────────────────────────

Write-Step "Phase 5 - Deploy to production  ($User@$Server)"
Write-Host "   Commit : $Commit" -ForegroundColor Green
if ($UseRegistryAppImages) {
    Write-Host "   Mode   : registry app images ($RegistryImagePrefix/numztrak-*:$($Commit.Substring(0, [Math]::Min(12, $Commit.Length))))..." -ForegroundColor Green
}

function Escape-BashSingleQuoted([string]$s) {
    if ([string]::IsNullOrWhiteSpace($s)) { return "" }
    return $s.Replace("'", "'\''")
}

$useRegFlag = if ($UseRegistryAppImages) { "1" } else { "0" }
$regPrefixEsc = Escape-BashSingleQuoted $RegistryImagePrefix

# Single-quoted here-string: bash uses $(...) — a double-quoted @"..."@ breaks PowerShell parsing.
$remoteScript = @'
set -euo pipefail

NUMZ_DEPLOY_USE_REGISTRY=__NUMZ_DEPLOY_USE_REGISTRY__
NUMZ_DEPLOY_REG_PREFIX='__NUMZ_DEPLOY_REG_PREFIX_ESC__'

# Prefer Docker Compose v2 (`docker compose`). Legacy python `docker-compose` 1.29.x can throw
# KeyError: ContainerConfig against newer Docker Engine; v2 avoids that path.
compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose -f docker-compose.prod.yml "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose -f docker-compose.prod.yml "$@"
  else
    echo "FAIL: install Docker Compose v2 (docker compose plugin) or docker-compose." >&2
    exit 1
  fi
}

echo ""
echo "=== [1/6] Repo sync to __DEPLOY_COMMIT__ ==="
cd ~/NUMZFLEET
git fetch origin --prune --quiet
git checkout __DEPLOY_COMMIT__

echo ""
echo "=== [2/7] Start databases ==="
cd ~/NUMZFLEET/backend
compose up -d traccar-mysql fuel-postgres

echo ""
echo "=== [3/7] Start core backend services ==="
cd ~/NUMZFLEET/backend
if [ "$NUMZ_DEPLOY_USE_REGISTRY" = "1" ]; then
  echo "Registry mode: pull fuel-api image, skip local Docker build for fuel-api."
  compose up -d traccar-server
  BE_IMAGE="${NUMZ_DEPLOY_REG_PREFIX}/numztrak-backend:__DEPLOY_COMMIT__"
  docker pull "$BE_IMAGE"
  export NUMZ_FUEL_API_IMAGE="$BE_IMAGE"
  compose up -d --no-build --force-recreate fuel-api
else
  compose up -d --build traccar-server fuel-api
fi

echo ""
echo "=== [4/7] Start ERB services ==="
cd ~/NUMZFLEET/backend
compose up -d --build erb-worker erb-api

if [ "$NUMZ_DEPLOY_USE_REGISTRY" = "1" ]; then
  echo ""
  echo "=== [5/7] Pull frontend image + sync dist/ (registry fast path) ==="
  FE_IMAGE="${NUMZ_DEPLOY_REG_PREFIX}/numztrak-frontend:__DEPLOY_COMMIT__"
  docker pull "$FE_IMAGE"
  FRONT_DIST="$HOME/NUMZFLEET/traccar-fleet-system/frontend/dist"
  mkdir -p "$FRONT_DIST"
  CID="$(docker create "$FE_IMAGE")"
  docker cp "$CID:/usr/share/nginx/html/." "$FRONT_DIST/"
  docker rm "$CID"
else
  echo ""
  echo "=== [5/7] Build frontend from same commit ==="
  FRONT="$HOME/NUMZFLEET/traccar-fleet-system/frontend"
  cd "$FRONT"
  if command -v npm >/dev/null 2>&1; then
    npm ci --quiet
    export VITE_TRACCAR_PREFIX=/traccar
    npm run build
  else
    echo "npm not on PATH; using Node 20 image to write dist/ (matches local dev toolchain)."
    docker pull node:20-bookworm
    docker run --rm -v "$FRONT:/app" -w /app node:20-bookworm bash -lc "export VITE_TRACCAR_PREFIX=/traccar && npm ci && npm run build"
  fi
fi

echo ""
echo "=== [6/7] Reload edge (pick up new static bundle + nginx config) ==="
cd ~/NUMZFLEET/backend
compose up -d numztrak-nginx
docker exec numztrak-nginx nginx -s reload 2>&1 || true

echo ""
echo "=== [7/7] Service status ==="
cd ~/NUMZFLEET/backend
compose ps

echo ""
echo "=== Health checks ==="
sleep 8

http_code=$(curl -o /dev/null -s -w "%{http_code}" https://numz.site)
echo "numz.site HTTPS : $http_code"
[ "$http_code" = "200" ] || [ "$http_code" = "301" ] || { echo "FAIL: unexpected HTTP code $http_code"; exit 1; }

traccar_ver=$(curl -fsS https://numz.site/traccar/api/server 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('version','?'))" 2>/dev/null || echo "unreachable")
echo "Traccar API version : $traccar_ver"
[ "$traccar_ver" != "unreachable" ] || { echo "FAIL: Traccar API unreachable"; exit 1; }

fuel_health=$(curl -fsS http://127.0.0.1:3001/health 2>/dev/null | head -c 200 || echo "unreachable")
echo "Fuel API health : $fuel_health"
[ "$fuel_health" != "unreachable" ] || { echo "FAIL: Fuel API health check failed"; exit 1; }

echo ""
echo "==========================================="
echo "  Deployed commit : __DEPLOY_COMMIT__"
echo "  Server          : __DEPLOY_SERVER__"
echo "  Completed at    : $(date -u '+%Y-%m-%d %H:%M UTC')"
echo "==========================================="
'@

$remoteScript = $remoteScript.Replace('__DEPLOY_COMMIT__', $Commit).Replace('__DEPLOY_SERVER__', $Server).Replace('__NUMZ_DEPLOY_USE_REGISTRY__', $useRegFlag).Replace('__NUMZ_DEPLOY_REG_PREFIX_ESC__', $regPrefixEsc)

Run-Or-Throw "Remote deploy" {
    $remoteScript | & "$SshCommand" -i "$KeyPath" -o "StrictHostKeyChecking=accept-new" "$User@$Server" "bash -s"
}

# ─────────────────────────────────────────────────────────────
# Done
# ─────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "===========================================" -ForegroundColor Green
Write-Host "  Release complete" -ForegroundColor Green
Write-Host "  Commit : $Commit" -ForegroundColor Green
Write-Host "  View   : https://numz.site" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
Write-Host ""
Write-Host "To rollback, re-run with the previous SHA:"
Write-Host "  .\release-prod.ps1 -Commit <prev-sha>" -ForegroundColor Yellow
