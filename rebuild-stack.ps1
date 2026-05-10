<#
.SYNOPSIS
  Canonical NUMZFLEET stack rebuild (Windows / PowerShell).

.DESCRIPTION
  Flow (cemented):
  1) Run from repo root (script cd's here automatically).
  2) Ensure backend/.env exists (secrets + MYSQL_PASSWORD + POSTGRES_PASSWORD for env_file services).
  3) Sync ERB tokens in backend/.env (ERB_API_TOKEN + API_TOKEN) unless -SkipErbToken.
  4) docker compose build (optional --no-cache) then up -d (optional --force-recreate).
  5) Smoke-test public endpoints (frontend, fuel-api, Traccar, optional ERB relay).

  Compose contract:
  - Core:     docker compose -f docker-compose.yml up -d --build
  - Core+ERB: docker compose -f docker-compose.yml -f docker-compose.erb.yml up -d --build

  Data persistence: named volumes (Postgres, Traccar MySQL). Do not delete those volumes unless you intend to reset data.

.PARAMETER CoreOnly
  Omit ERB overlay (only docker-compose.yml).

.PARAMETER NoCache
  Pass --no-cache to docker compose build.

.PARAMETER ForceRecreate
  Pass --force-recreate to docker compose up.

.PARAMETER SkipErbToken
  Do not run ensure-erb-token.ps1 (not recommended when using ERB overlay).

.PARAMETER SkipVerify
  Skip HTTP smoke tests after up.

.PARAMETER WaitSeconds
  Max seconds to wait for health endpoints after compose up (default 180).
#>
param(
  [switch]$CoreOnly,
  [switch]$NoCache,
  [switch]$ForceRecreate,
  [switch]$SkipErbToken,
  [switch]$SkipVerify,
  [int]$WaitSeconds = 180
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RepoRoot

function Test-DockerAvailable {
  docker version *> $null
  if ($LASTEXITCODE -ne 0) { throw 'Docker is not available or not running.' }
}

function Invoke-HealthOnce([string]$Url) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 5
    return $r.StatusCode
  } catch {
    return 0
  }
}

function Wait-StackHealthy {
  param([string[]]$Urls)
  $deadline = (Get-Date).AddSeconds($WaitSeconds)
  while ((Get-Date) -lt $deadline) {
    $allOk = $true
    foreach ($u in $Urls) {
      $code = Invoke-HealthOnce $u
      if ($code -ne 200) { $allOk = $false; break }
    }
    if ($allOk) { return $true }
    Start-Sleep -Seconds 3
  }
  return $false
}

Write-Host "== NUMZFLEET rebuild-stack ==" -ForegroundColor Cyan
Write-Host "Repo: $RepoRoot"

Test-DockerAvailable

$envFile = Join-Path $RepoRoot 'backend\.env'
if (-not (Test-Path -LiteralPath $envFile)) {
  throw "Missing $envFile - copy backend/.env.example to backend/.env and fill passwords + ERB settings."
}

if (-not $SkipErbToken) {
  $ensure = Join-Path $RepoRoot 'ensure-erb-token.ps1'
  if (Test-Path -LiteralPath $ensure) {
    Write-Host "`n[1/3] ensure-erb-token.ps1 (no -Force; only fills if missing)" -ForegroundColor Yellow
    & $ensure
  } else {
    Write-Warning "ensure-erb-token.ps1 not found; skipping."
  }
} else {
  Write-Host "`n[1/3] Skipped ensure-erb-token (-SkipErbToken)" -ForegroundColor Yellow
}

$composeFiles = @('-f', 'docker-compose.yml')
if (-not $CoreOnly) {
  $composeFiles += @('-f', 'docker-compose.erb.yml')
}

$buildArgs = @('compose') + $composeFiles + @('build')
if ($NoCache) { $buildArgs += '--no-cache' }

$upArgs = @('compose') + $composeFiles + @('up', '-d', '--build')
if ($ForceRecreate) { $upArgs += '--force-recreate' }

Write-Host "`n[2/3] docker compose build ..." -ForegroundColor Yellow
docker @buildArgs
if ($LASTEXITCODE -ne 0) { throw "docker compose build failed ($LASTEXITCODE)" }

Write-Host "`n[2/3] docker compose up ..." -ForegroundColor Yellow
docker @upArgs
if ($LASTEXITCODE -ne 0) { throw "docker compose up failed ($LASTEXITCODE)" }

Write-Host "`n[3/3] docker compose ps" -ForegroundColor Yellow
$composePsArgs = @('compose') + $composeFiles + @('ps')
docker @composePsArgs

if ($SkipVerify) {
  Write-Host "Smoke tests skipped (-SkipVerify)." -ForegroundColor Yellow
  exit 0
}

$verifyUrls = @(
  'http://localhost:3002/health',
  'http://localhost:3000/health',
  'http://localhost:8082/'
)
if (-not $CoreOnly) {
  # Public endpoint; avoids failing when ERB cache is empty (404 on /erb/latest is possible).
  $verifyUrls += 'http://localhost:3002/api/public/login-insight'
}

Write-Host "`nWaiting for endpoints (max ${WaitSeconds}s)..." -ForegroundColor Yellow
$ok = Wait-StackHealthy -Urls $verifyUrls
if (-not $ok) {
  Write-Host "Smoke tests FAILED (one or more URLs not HTTP 200 within ${WaitSeconds}s):" -ForegroundColor Red
  foreach ($u in $verifyUrls) {
    $c = Invoke-HealthOnce $u
    Write-Host "  $u -> $c"
  }
  Write-Host "`nTip: docker compose logs -f traccar backend frontend" -ForegroundColor DarkYellow
  exit 1
}

Write-Host "`nSmoke tests OK:" -ForegroundColor Green
foreach ($u in $verifyUrls) {
  Write-Host "  $u -> 200"
}

Write-Host "`nDone." -ForegroundColor Green
