param(
  [string]$EnvPath = ".\backend\.env",
  [switch]$Force
)

$ErrorActionPreference = "Stop"

function New-RandomHexToken([int]$Bytes = 32) {
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $buffer = New-Object byte[] $Bytes
    $rng.GetBytes($buffer)
    return -join ($buffer | ForEach-Object { $_.ToString("x2") })
  } finally {
    $rng.Dispose()
  }
}

function Get-LineEnding([string[]]$lines) {
  # Default to Windows line endings for .env files
  return "`r`n"
}

function Set-OrAddEnvLine([string[]]$lines, [string]$key, [string]$value) {
  $idx = -1
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^\s*$key\s*=") {
      $idx = $i
      break
    }
  }
  if ($idx -ge 0) {
    $lines[$idx] = "$key=$value"
    return ,$lines
  }
  if ($lines.Count -gt 0 -and ($lines[-1].Trim().Length -ne 0)) {
    $lines += ""
  }
  $lines += "$key=$value"
  return ,$lines
}

if (-not (Test-Path -LiteralPath $EnvPath)) {
  $dir = Split-Path -Parent $EnvPath
  if ($dir -and -not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  New-Item -ItemType File -Force -Path $EnvPath | Out-Null
}

$raw = Get-Content -LiteralPath $EnvPath -Raw -ErrorAction SilentlyContinue
if ($null -eq $raw) { $raw = "" }

$lines = @()
if ($raw.Length -gt 0) {
  # Split on both Windows and Unix line endings
  $lines = $raw -split "`r`n|`n"
} else {
  $lines = @()
}

$key = "ERB_API_TOKEN"
$existingIndex = -1
$existingValue = $null

for ($i = 0; $i -lt $lines.Count; $i++) {
  $line = $lines[$i]
  if ($line -match "^\s*$key\s*=") {
    $existingIndex = $i
    $existingValue = ($line -replace "^\s*$key\s*=\s*", "")
    break
  }
}

$needs = $Force.IsPresent -or (-not $existingValue) -or (-not ($existingValue.Trim()))

if (-not $needs) {
  Write-Host "ERB_API_TOKEN already set in $EnvPath (no changes)."
  exit 0
}

$token = New-RandomHexToken 32

if ($existingIndex -ge 0) {
  $lines[$existingIndex] = "$key=$token"
} else {
  if ($lines.Count -gt 0 -and ($lines[-1].Trim().Length -ne 0)) {
    $lines += ""
  }
  $lines += "$key=$token"
}

# erb-api reads API_TOKEN, while fuel-api reads ERB_API_TOKEN.
# Keep them in sync automatically.
$lines = Set-OrAddEnvLine $lines "API_TOKEN" $token

$eol = Get-LineEnding $lines
$out = ($lines -join $eol).TrimEnd("`r", "`n") + $eol
Set-Content -LiteralPath $EnvPath -Value $out -NoNewline -Encoding UTF8

# Don't print the full token to the console/logs
$suffix = $token.Substring([Math]::Max(0, $token.Length - 6))
Write-Host "Set ERB_API_TOKEN in $EnvPath (ends with: ...$suffix)."

