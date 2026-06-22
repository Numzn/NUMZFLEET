# Reset Fueling Day DB rows and run a full API smoke flow (local stack).
# Usage: .\fuel-api\scripts\reset-and-smoke-fueling-day.ps1 [-UserId 1] [-VehicleId 1]

param(
  [int]$UserId = 1,
  [int]$VehicleId = 0,
  [string]$FuelApiBase = 'http://localhost:3000',
  [string]$InvoiceLink = 'https://example.com/invoices/smoke-test.pdf'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$sqlFile = Join-Path $repoRoot 'fuel-api\scripts\reset-fueling-day-data.sql'

Write-Host '==> Applying latest fuel migrations (includes attachmentUrl)...'
& (Join-Path $repoRoot 'fuel-api\scripts\apply-fuel-migrations.ps1')

Write-Host '==> Resetting operation session tables...'
Get-Content $sqlFile -Raw | docker exec -i numzfleet-db-1 psql -U numztrak -d numztrak_fuel

$headers = @{
  'Content-Type' = 'application/json'
  'x-user-id'    = "$UserId"
}

function Invoke-FuelApi {
  param([string]$Method, [string]$Path, $Body = $null)
  $uri = "$FuelApiBase/api/operation-sessions$Path"
  if ($Body -ne $null) {
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -Body ($Body | ConvertTo-Json -Depth 6)
  }
  return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
}

if ($VehicleId -le 0) {
  Write-Host '==> Resolving a fleet vehicle from fuel-api...'
  $vehicles = Invoke-RestMethod -Method GET -Uri "$FuelApiBase/api/vehicles" -Headers $headers
  $withDevice = @($vehicles | Where-Object { $_.assignment.deviceId })
  if ($withDevice.Count -eq 0) { throw 'No assigned vehicles found. Assign a device first.' }
  $VehicleId = [int]$withDevice[0].assignment.deviceId
}

Write-Host "==> Using userId=$UserId vehicleId=$VehicleId"

Write-Host '1. Plan today (create draft Fueling Day + vehicle)...'
$plan = Invoke-FuelApi POST '/plan' @{
  vehicles = @(@{ vehicleId = $VehicleId; plannedLitres = 50 })
}
$sessionId = $plan.id
Write-Host "   Session $sessionId status=$($plan.status)"

Write-Host '2. Patch station name...'
Invoke-FuelApi PATCH "/$sessionId" @{ stationName = 'Smoke Test Station' } | Out-Null

Write-Host '3. Start Fueling Day (approve)...'
$approved = Invoke-FuelApi POST "/$sessionId/approve" @{}
Write-Host "   Approved status=$($approved.status)"

Write-Host '4. Mark vehicle arrived...'
$details = Invoke-FuelApi GET "/$sessionId"
$refuelId = $details.refuels[0].id
Invoke-FuelApi POST "/$sessionId/arrive" @{ refuelId = $refuelId } | Out-Null

Write-Host '5. Record refuel...'
Invoke-FuelApi POST "/$sessionId/refuel" @{
  refuelId           = $refuelId
  actualFuelLitres   = 48
  mileage            = 125000
  mileageSource      = 'manual'
} | Out-Null

Write-Host '6. Attach Smart Invoice link...'
$invoice = Invoke-FuelApi POST "/$sessionId/invoices" @{
  attachmentUrl = $InvoiceLink
  invoiceNumber = 'Smoke receipt'
}
Write-Host "   Invoice $($invoice.id) attachment=$($invoice.attachmentUrl)"

Write-Host '7. Close Fueling Day...'
$closed = Invoke-FuelApi POST "/$sessionId/close" @{}
Write-Host "   Closed status=$($closed.status)"

Write-Host '8. Final session summary...'
$final = Invoke-FuelApi GET "/$sessionId"
Write-Host "   Refuels: $($final.refuels.Count) fueled=$($final.refuels[0].actualFuelLitres)L"
Write-Host "   Invoices: $($final.invoices.Count) summary=$($final.invoiceSummary.status)"
Write-Host ''
Write-Host 'DONE. Open http://localhost:5174/fleet/operation-sessions (or :3002) to verify UI.'
