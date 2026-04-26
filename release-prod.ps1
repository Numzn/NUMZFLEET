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
#>

param(
    [string]$Server    = "129.151.163.95",
    [string]$User      = "ubuntu",
    [string]$KeyPath   = "$HOME/.ssh/oci_instance_key.pem",
    [string]$Branch    = "main",
    [string]$Commit    = "",
    [switch]$SkipLocalChecks
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
Assert-Command ssh
Assert-Command npm

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
        Run-Or-Throw "nginx config check" {
            docker run --rm `
                -v "${nginxConf}:/etc/nginx/conf.d/default.conf:ro" `
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

# ─────────────────────────────────────────────────────────────
# PHASE 5 — Server deploy (Git-first, SHA-locked)
# ─────────────────────────────────────────────────────────────

Write-Step "Phase 5 - Deploy to production  ($User@$Server)"
Write-Host "   Commit : $Commit" -ForegroundColor Green

# Single-quoted here-string: bash uses $(...) — a double-quoted @"..."@ breaks PowerShell parsing.
$remoteScript = @'
set -euo pipefail

echo ""
echo "=== [1/6] Repo sync to __DEPLOY_COMMIT__ ==="
cd ~/NUMZFLEET
git fetch origin --prune --quiet
git checkout __DEPLOY_COMMIT__

echo ""
echo "=== [2/7] Start databases ==="
cd ~/NUMZFLEET/backend
docker-compose -f docker-compose.prod.yml up -d traccar-mysql fuel-postgres 2>&1 || \
    docker compose -f docker-compose.prod.yml up -d traccar-mysql fuel-postgres 2>&1

echo ""
echo "=== [3/7] Start core backend services ==="
cd ~/NUMZFLEET/backend
docker-compose -f docker-compose.prod.yml up -d --build traccar-server fuel-api 2>&1 || \
    docker compose -f docker-compose.prod.yml up -d --build traccar-server fuel-api 2>&1

echo ""
echo "=== [4/7] Start ERB services ==="
cd ~/NUMZFLEET/backend
docker-compose -f docker-compose.prod.yml up -d --build erb-worker erb-api 2>&1 || \
    docker compose -f docker-compose.prod.yml up -d --build erb-worker erb-api 2>&1

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

echo ""
echo "=== [6/7] Reload edge (pick up new static bundle) ==="
cd ~/NUMZFLEET/backend
docker-compose -f docker-compose.prod.yml up -d numztrak-nginx 2>&1 || \
    docker compose -f docker-compose.prod.yml up -d numztrak-nginx 2>&1

echo ""
echo "=== [7/7] Service status ==="
docker-compose -f docker-compose.prod.yml ps 2>&1 || \
  docker compose -f docker-compose.prod.yml ps 2>&1

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

$remoteScript = $remoteScript.Replace('__DEPLOY_COMMIT__', $Commit).Replace('__DEPLOY_SERVER__', $Server)

Run-Or-Throw "Remote deploy" {
    $remoteScript | ssh -i "$KeyPath" -o "StrictHostKeyChecking=accept-new" "$User@$Server" "bash -s"
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
