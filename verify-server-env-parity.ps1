<#
.SYNOPSIS
  Build and run the core stack with server-style DB env (no DATABASE_URL in compose).

.DESCRIPTION
  Merges docker-compose.server-parity.yml so fuel-api only sees POSTGRES_PASSWORD
  from backend/.env — matching deployment/compose/docker-compose.prod.yml + backend/.env
  on the server. Runs the same HTTP smoke checks as rebuild-stack.ps1 (core, no ERB overlay).

.PARAMETER SkipVerify
  Skip HTTP smoke tests after compose up.

.PARAMETER WaitSeconds
  Max seconds to wait for health endpoints (default 240; Traccar start_period is 120s).
#>
param(
  [switch]$SkipVerify,
  [int]$WaitSeconds = 240
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

Write-Host '== verify-server-env-parity (DATABASE_URL cleared; POSTGRES_PASSWORD only) ==' -ForegroundColor Cyan
Write-Host "Repo: $RepoRoot"

Test-DockerAvailable

$envFile = Join-Path $RepoRoot 'backend\.env'
if (-not (Test-Path -LiteralPath $envFile)) {
  throw "Missing $envFile - copy backend/.env.example to backend/.env and set POSTGRES_PASSWORD (and other secrets)."
}

$composeFiles = @('-f', 'docker-compose.yml', '-f', 'docker-compose.server-parity.yml')
$buildArgs = @('compose') + $composeFiles + @('build', 'backend')
$upArgs = @('compose') + $composeFiles + @('up', '-d', '--build')
$psArgs = @('compose') + $composeFiles + @('ps')

Write-Host "`n[1/2] docker compose build ..." -ForegroundColor Yellow
docker @buildArgs
if ($LASTEXITCODE -ne 0) { throw "docker compose build failed ($LASTEXITCODE)" }

Write-Host "`n[1/2] docker compose up ..." -ForegroundColor Yellow
docker @upArgs
if ($LASTEXITCODE -ne 0) { throw "docker compose up failed ($LASTEXITCODE)" }

Write-Host "`n[2/2] docker compose ps" -ForegroundColor Yellow
docker @psArgs

if ($SkipVerify) {
  Write-Host 'Smoke tests skipped (-SkipVerify).' -ForegroundColor Yellow
  exit 0
}

$verifyUrls = @(
  'http://localhost:3002/health',
  'http://localhost:3000/health',
  'http://localhost:8082/'
)

Write-Host "`nWaiting for endpoints (max ${WaitSeconds}s)..." -ForegroundColor Yellow
$ok = Wait-StackHealthy -Urls $verifyUrls
if (-not $ok) {
  Write-Host "Smoke tests FAILED:" -ForegroundColor Red
  foreach ($u in $verifyUrls) {
    $c = Invoke-HealthOnce $u
    Write-Host "  $u -> $c"
  }
  Write-Host "`nTip: docker compose -f docker-compose.yml -f docker-compose.server-parity.yml logs -f backend" -ForegroundColor DarkYellow
  exit 1
}

Write-Host "`nSmoke tests OK (server-parity DB env):" -ForegroundColor Green
foreach ($u in $verifyUrls) {
  Write-Host "  $u -> 200"
}

Write-Host "`nNext on server: ensure backend/.env has POSTGRES_PASSWORD (DATABASE_URL optional), then deploy-from-registry.sh with your SHA." -ForegroundColor DarkGray
Write-Host 'Done.' -ForegroundColor Green
