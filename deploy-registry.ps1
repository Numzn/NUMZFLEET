<#
.SYNOPSIS
    Build and/or push NUMZFLEET registry images (Track B) from Windows.

.DESCRIPTION
    Uses Git for Windows Bash to run deployment/build and deployment/push scripts.
    Tag = full git SHA (same family as release-prod.ps1 -Commit).

    Prerequisites:
      - Docker Desktop
      - Git for Windows (bash at C:\Program Files\Git\bin\bash.exe)
      - deployment\.env (copy from deployment\.env.example) for Push / BuildPush
      - docker login to your registry before Push

.PARAMETER Action
    Validate  - run validate-env only (needs deployment\.env)
    Build     - build frontend + backend images
    Push      - tag remote + push (needs deployment\.env and docker login)
    BuildPush - Build then Push

.PARAMETER Commit
    Optional commit-ish string (full or partial). Default: HEAD.

.EXAMPLE
    .\deploy-registry.ps1 -Action Validate

.EXAMPLE
    .\deploy-registry.ps1 -Action BuildPush -Commit main
#>

param(
    [ValidateSet("Validate", "Build", "Push", "BuildPush")]
    [string]$Action = "Validate",

    [string]$Commit = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = $PSScriptRoot

function Resolve-GitBash() {
    $p = "C:\Program Files\Git\bin\bash.exe"
    if (Test-Path $p) { return $p }
    throw "Git Bash not found at $p. Install Git for Windows."
}

function Resolve-DeploySha([string]$commitish) {
    if ([string]::IsNullOrWhiteSpace($commitish)) {
        return (git -C $RepoRoot rev-parse HEAD).Trim()
    }
    return (git -C $RepoRoot rev-parse $commitish).Trim()
}

function Assert-RepoRoot() {
    if (-not (Test-Path (Join-Path $RepoRoot ".git"))) {
        throw "Run from repo root (expected .git). RepoRoot=$RepoRoot"
    }
}

function Assert-Docker() {
    Assert-Command docker
}

function Assert-Command([string]$name) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "Required command not found: $name"
    }
}

function Convert-ToGitBashPath([string]$winPath) {
    $m = [regex]::Match($winPath, '^([A-Za-z]):\\(.*)$')
    if (-not $m.Success) {
        throw "Cannot map Windows path to Git Bash path: $winPath"
    }
    $drive = $m.Groups[1].Value.ToLowerInvariant()
    $rest = $m.Groups[2].Value -replace '\\', '/'
    return "/$drive/$rest"
}

function Invoke-Bash([string]$bashCmd) {
    $bash = Resolve-GitBash
    $unixRoot = Convert-ToGitBashPath $RepoRoot
    Write-Host ">> bash: $bashCmd" -ForegroundColor Cyan
    & $bash -lc "cd '$unixRoot' && set -euo pipefail && $bashCmd"
    if ($LASTEXITCODE -ne 0) {
        throw "Bash command failed (exit $LASTEXITCODE)"
    }
}

Assert-RepoRoot
Assert-Docker
Assert-Command git

$Sha = Resolve-DeploySha $Commit
Write-Host ""
Write-Host "NUMZFLEET registry helper | SHA=$Sha | Action=$Action" -ForegroundColor Magenta
Write-Host ""

$deploymentEnvPath = Join-Path $RepoRoot "deployment\.env"

switch ($Action) {
    "Validate" {
        if (-not (Test-Path $deploymentEnvPath)) {
            throw "Missing deployment/.env - copy deployment/.env.example and fill in values."
        }
        Invoke-Bash "./deployment/utils/validate-env.sh deployment/.env `"$Sha`""
    }
    "Build" {
        Invoke-Bash "./deployment/build/build-frontend.sh `"$Sha`""
        Invoke-Bash "./deployment/build/build-backend.sh `"$Sha`""
        Write-Host "[OK] Built numztrak-frontend:$Sha and numztrak-backend:$Sha" -ForegroundColor Green
    }
    "Push" {
        if (-not (Test-Path $deploymentEnvPath)) {
            throw "Missing deployment/.env - required for push-images.sh"
        }
        Invoke-Bash "./deployment/push/push-images.sh deployment/.env `"$Sha`""
        Write-Host "[OK] Push complete for SHA=$Sha" -ForegroundColor Green
    }
    "BuildPush" {
        Invoke-Bash "./deployment/build/build-frontend.sh `"$Sha`""
        Invoke-Bash "./deployment/build/build-backend.sh `"$Sha`""
        if (-not (Test-Path $deploymentEnvPath)) {
            throw "Missing deployment/.env - required after build for push"
        }
        Invoke-Bash "./deployment/push/push-images.sh deployment/.env `"$Sha`""
        Write-Host "[OK] Build + push complete for SHA=$Sha" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Server deploy (slab or after integration): ./deployment/deploy/deploy-from-registry.sh $Sha" -ForegroundColor DarkGray
Write-Host ""
