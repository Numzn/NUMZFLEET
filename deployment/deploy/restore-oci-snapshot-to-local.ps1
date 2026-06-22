# Restore OCI Phase-1 snapshot into local Docker Compose (Windows dev PC).
param(
  [string]$SnapshotDir = "$env:USERPROFILE\NUMZFLEET-backups\phase1_2026-06-06T23-28-59Z"
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $RepoRoot

$BackendEnv = Join-Path $RepoRoot 'backend\.env'
$RollbackRoot = if ($env:ROLLBACK_ROOT) { $env:ROLLBACK_ROOT } else { "$env:USERPROFILE\NUMZFLEET-backups" }
$Ts = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH-mm-ssZ')
$RollbackDir = Join-Path $RollbackRoot "local_pre_restore_$Ts"
$MigrationsDir = Join-Path $RepoRoot 'fuel-api\migrations'
$ComposeArgs = @('compose', '-f', 'docker-compose.yml', '-f', 'docker-compose.erb.yml')

function Log($msg) { Write-Host "[restore-local] $msg" -ForegroundColor Cyan }
function Fail($msg) { Write-Host "[restore-local] ERROR: $msg" -ForegroundColor Red; exit 1 }

function Read-BackendEnv([string]$Key) {
  foreach ($line in Get-Content -LiteralPath $BackendEnv) {
    $t = $line.Trim()
    if ($t -match '^\s*#' -or -not $t) { continue }
    if ($t -match "^${Key}=(.*)$") { return $Matches[1].Trim() }
  }
  return $null
}

function Invoke-Compose([string[]]$ComposeCommand) {
  & docker @ComposeArgs @ComposeCommand
  if ($LASTEXITCODE -ne 0) { Fail "docker compose failed: $($ComposeCommand -join ' ')" }
}

function Invoke-ComposeWithStdinFile([string]$InputFile, [string[]]$ComposeCommand) {
  $p = Start-Process -FilePath 'docker' -ArgumentList ($ComposeArgs + $ComposeCommand) `
    -RedirectStandardInput $InputFile -NoNewWindow -PassThru -Wait
  if ($p.ExitCode -ne 0) { Fail "docker compose stdin failed (exit $($p.ExitCode)): $($ComposeCommand -join ' ')" }
}

function Invoke-ComposeCaptureStdout([string[]]$ComposeCommand, [string]$OutFile) {
  $p = Start-Process -FilePath 'docker' -ArgumentList ($ComposeArgs + $ComposeCommand) `
    -RedirectStandardOutput $OutFile -NoNewWindow -PassThru -Wait
  if ($p.ExitCode -ne 0) { Fail "docker compose capture failed: $($ComposeCommand -join ' ')" }
}

function Expand-Gzip([string]$GzPath, [string]$OutPath) {
  $in = [System.IO.File]::OpenRead($GzPath)
  $gzip = New-Object System.IO.Compression.GZipStream($in, [System.IO.Compression.CompressionMode]::Decompress)
  $out = [System.IO.File]::Create($OutPath)
  try { $gzip.CopyTo($out) } finally { $gzip.Close(); $in.Close(); $out.Close() }
}

if (-not (Test-Path -LiteralPath $SnapshotDir)) { Fail "snapshot dir not found: $SnapshotDir" }
if (-not (Test-Path -LiteralPath $BackendEnv)) { Fail "backend env not found: $BackendEnv" }

$PgDump = (Get-ChildItem -LiteralPath $SnapshotDir -Filter 'numztrak_fuel_*.dump' | Select-Object -First 1).FullName
$MysqlDump = (Get-ChildItem -LiteralPath $SnapshotDir -Filter 'traccar_*.sql.gz' | Select-Object -First 1).FullName
if (-not $PgDump) { Fail "PostgreSQL dump not found in $SnapshotDir" }
if (-not $MysqlDump) { Fail "MySQL dump not found in $SnapshotDir" }

$PostgresPassword = Read-BackendEnv 'POSTGRES_PASSWORD'
$MysqlRootPassword = Read-BackendEnv 'MYSQL_ROOT_PASSWORD'
if (-not $PostgresPassword) { Fail 'POSTGRES_PASSWORD missing in backend/.env' }
if (-not $MysqlRootPassword) { Fail 'MYSQL_ROOT_PASSWORD missing in backend/.env' }

Push-Location $SnapshotDir
Get-ChildItem -Filter '*.sha256' | ForEach-Object {
  $shaFile = $_
  $line = (Get-Content -LiteralPath $shaFile.FullName -TotalCount 1).Trim()
  if ($line -notmatch '^([0-9a-f]{64})\s+(.+)$') { Fail "invalid checksum file: $($shaFile.Name)" }
  $expected = $Matches[1].ToLower()
  $targetName = $Matches[2].Trim()
  $target = Join-Path $SnapshotDir $targetName
  if (-not (Test-Path -LiteralPath $target)) { Fail "checksum target missing: $targetName" }
  Log "Verifying $($shaFile.Name)"
  $actual = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLower()
  if ($actual -ne $expected) { Fail "checksum mismatch for $targetName (expected $expected, got $actual)" }
}
Pop-Location

Log "Snapshot: $SnapshotDir"
Log "Rollback: $RollbackDir"
New-Item -ItemType Directory -Force -Path $RollbackDir | Out-Null

Log 'Step 1/7 — backup current local databases'
$localPg = Join-Path $RollbackDir "local_numztrak_fuel_$Ts.dump"
$localMysqlSql = Join-Path $RollbackDir "local_traccar_$Ts.sql"
Invoke-ComposeCaptureStdout @('exec', '-T', '-e', "PGPASSWORD=$PostgresPassword", 'db', 'pg_dump', '-U', 'numztrak', '-d', 'numztrak_fuel', '-Fc', '--no-owner') $localPg
Invoke-ComposeCaptureStdout @('exec', '-T', '-e', "MYSQL_PWD=$MysqlRootPassword", 'traccar-mysql', 'mysqldump', '-u', 'root', '--single-transaction', '--routines', '--triggers', '--set-gtid-purged=OFF', 'traccar') $localMysqlSql

Log 'Step 2/7 — stop app services'
Invoke-Compose @('stop', 'frontend', 'backend', 'traccar', 'erb-api', 'erb-worker')

Log 'Step 3/7 — restore PostgreSQL'
$sql = @'
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'numztrak_fuel' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS numztrak_fuel;
CREATE DATABASE numztrak_fuel OWNER numztrak;
'@
$sql | & docker @ComposeArgs exec -T db psql -U numztrak -d postgres -v ON_ERROR_STOP=1
if ($LASTEXITCODE -ne 0) { Fail 'postgres recreate failed' }

$pgLog = Join-Path $RollbackDir 'pg_restore.log'
$p = Start-Process -FilePath 'docker' -ArgumentList ($ComposeArgs + @('exec', '-T', '-e', "PGPASSWORD=$PostgresPassword", 'db', 'pg_restore', '-U', 'numztrak', '-d', 'numztrak_fuel', '--clean', '--if-exists', '--no-owner', '--role=numztrak')) `
  -RedirectStandardInput $PgDump -RedirectStandardError $pgLog -NoNewWindow -PassThru -Wait

Log 'Step 4/7 — restore Traccar MySQL'
$mysqlSql = Join-Path $RollbackDir '_restore_traccar.sql'
Expand-Gzip $MysqlDump $mysqlSql
$mysqlLog = Join-Path $RollbackDir 'mysql_import.log'
$p = Start-Process -FilePath 'docker' -ArgumentList ($ComposeArgs + @('exec', '-T', '-e', "MYSQL_PWD=$MysqlRootPassword", 'traccar-mysql', 'mysql', '-u', 'root', 'traccar')) `
  -RedirectStandardInput $mysqlSql -RedirectStandardError $mysqlLog -NoNewWindow -PassThru -Wait
if ($p.ExitCode -ne 0) { Fail "mysql restore failed; see $mysqlLog" }

Log 'Step 5/7 — apply Postgres migrations'
$migrations = @(
  '20260503_create_operation_sessions_tables.sql',
  '20260427_daily_intelligent_refueling.sql',
  '20260429_refuel_status_incomplete.sql',
  '20260512_notifications.sql',
  '20260522_notifications_dedup_and_bridge.sql'
)
foreach ($name in $migrations) {
  $path = Join-Path $MigrationsDir $name
  if (-not (Test-Path $path)) { Fail "missing migration: $path" }
  Log "  migration: $name"
  Get-Content -Raw -LiteralPath $path | & docker @ComposeArgs exec -T -e "PGPASSWORD=$PostgresPassword" db psql -U numztrak -d numztrak_fuel -v ON_ERROR_STOP=1 -f -
  if ($LASTEXITCODE -ne 0) { Fail "migration failed: $name" }
}

Log 'Step 6/7 — bring stack up'
Invoke-Compose @('up', '-d')

Log 'Step 7/7 — health + row counts'
$ok = $false
for ($i = 0; $i -lt 30; $i++) {
  try {
    $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/health' -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -eq 200) { $ok = $true; break }
  } catch { Start-Sleep -Seconds 3 }
}
if (-not $ok) { Fail 'fuel-api health check failed' }

$pgCounts = Join-Path $RollbackDir 'post_restore_pg_counts.txt'
@'
SELECT 'fuel_requests' || E'\t' || COUNT(*)::text FROM fuel_requests
UNION ALL SELECT 'operation_sessions' || E'\t' || COUNT(*)::text FROM operation_sessions
UNION ALL SELECT 'notifications' || E'\t' || COUNT(*)::text FROM notifications;
'@ | & docker @ComposeArgs exec -T -e "PGPASSWORD=$PostgresPassword" db psql -U numztrak -d numztrak_fuel -At | Tee-Object -FilePath $pgCounts

$mysqlCounts = Join-Path $RollbackDir 'post_restore_mysql_counts.txt'
@'
SELECT CONCAT('tc_users', CHAR(9), COUNT(*)) FROM tc_users;
SELECT CONCAT('tc_devices', CHAR(9), COUNT(*)) FROM tc_devices;
SELECT CONCAT('tc_positions', CHAR(9), COUNT(*)) FROM tc_positions;
SELECT CONCAT('tc_geofences', CHAR(9), COUNT(*)) FROM tc_geofences;
SELECT CONCAT('tc_events', CHAR(9), COUNT(*)) FROM tc_events;
'@ | & docker @ComposeArgs exec -T -e "MYSQL_PWD=$MysqlRootPassword" traccar-mysql mysql -u root -N traccar | Tee-Object -FilePath $mysqlCounts

$ociPg = Join-Path $SnapshotDir 'oci_pg_counts.txt'
$ociMysql = Join-Path $SnapshotDir 'oci_mysql_counts.txt'
if ((Test-Path $ociPg) -and (Test-Path $ociMysql)) {
  Log 'OCI baseline (postgres):'; Get-Content $ociPg
  Log 'Local after restore (postgres):'; Get-Content $pgCounts
  Log 'OCI baseline (mysql):'; Get-Content $ociMysql
  Log 'Local after restore (mysql):'; Get-Content $mysqlCounts
}

@(
  "timestamp=$Ts",
  "snapshot=$SnapshotDir",
  "rollback=$RollbackDir"
) | Set-Content -LiteralPath (Join-Path $RepoRoot '.last_local_oci_restore')

Log "Done. Rollback saved: $RollbackDir"
Log 'Vite dev UI: http://localhost:5174 | API: :3000 | Traccar: :8082'
