# Extended Fueling Day API integration tests (local stack on :3000).
param(
  [int]$UserId = 1,
  [string]$FuelApiBase = 'http://localhost:3000'
)

$ErrorActionPreference = 'Stop'
$passed = 0
$failed = 0

$headers = @{
  'Content-Type' = 'application/json'
  'x-user-id'    = "$UserId"
}

function Assert-True($condition, [string]$name) {
  if ($condition) {
    Write-Host "  PASS $name" -ForegroundColor Green
    $script:passed++
  } else {
    Write-Host "  FAIL $name" -ForegroundColor Red
    $script:failed++
  }
}

function Invoke-FuelApi {
  param(
    [string]$Method,
    [string]$Path,
    $Body = $null,
    [switch]$ExpectError
  )
  $uri = "$FuelApiBase/api/operation-sessions$Path"
  try {
    if ($Body -ne $null) {
      $result = Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -Body ($Body | ConvertTo-Json -Depth 6)
    } else {
      $result = Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
    }
    if ($ExpectError) {
      Assert-True $false "Expected error for $Method $Path"
      return $null
    }
    return $result
  } catch {
    if ($ExpectError) { return $_ }
    throw
  }
}

function Get-VehicleId {
  $vehicles = Invoke-RestMethod -Method GET -Uri "$FuelApiBase/api/vehicles" -Headers $headers
  $row = @($vehicles | Where-Object { $_.assignment.deviceId })[0]
  if (-not $row) { throw 'No assigned vehicle' }
  return [int]$row.assignment.deviceId
}

Write-Host '==> Resetting operation tables...'
Get-Content (Join-Path $PSScriptRoot 'reset-fueling-day-data.sql') -Raw |
  docker exec -i numzfleet-db-1 psql -U numztrak -d numztrak_fuel | Out-Null

$vehicleId = Get-VehicleId
Write-Host "==> vehicleId=$vehicleId userId=$UserId"

Write-Host '--- Validation tests ---'

$plan = Invoke-FuelApi POST '/plan' @{ vehicles = @(@{ vehicleId = $vehicleId; plannedLitres = 40 }) }
$sessionId = $plan.id
Assert-True ($plan.status -eq 'draft') 'plan creates draft session'
Assert-True ($plan.reference -like 'FD-*') 'plan assigns a Fueling Day reference'

$noAttach = Invoke-FuelApi POST "/$sessionId/invoices" @{ invoiceNumber = 'x' } -ExpectError
Assert-True ($null -ne $noAttach) 'invoice without attachmentUrl is rejected'

$badUrl = Invoke-FuelApi POST "/$sessionId/invoices" @{ attachmentUrl = 'not-a-url' } -ExpectError
Assert-True ($null -ne $badUrl) 'invalid attachmentUrl is rejected'

$draftInvoice = Invoke-FuelApi POST "/$sessionId/invoices" @{
  attachmentUrl = 'https://example.com/inv.pdf'
} -ExpectError
Assert-True ($null -ne $draftInvoice) 'invoice on draft session is rejected'

Write-Host '--- Happy path + edge cases ---'

$approved = Invoke-FuelApi POST "/$sessionId/approve" @{}
Assert-True ($approved.status -eq 'approved') 'approve starts fueling day'

$details = Invoke-FuelApi GET "/$sessionId"
$refuelId = $details.refuels[0].id
Assert-True ($details.refuels[0].workflowStatus -eq 'planned') 'planned vehicle reports planned workflow status'

$arriveDraft = Invoke-FuelApi POST "/$sessionId/arrive" @{ refuelId = $refuelId }
Assert-True ($null -ne $arriveDraft.arrivedAt) 'mark arrived sets arrivedAt'
Assert-True ($arriveDraft.workflowStatus -eq 'arrived') 'arrived vehicle reports arrived workflow status'

# Skip then restore the planned vehicle before fueling it.
$skipped = Invoke-FuelApi POST "/$sessionId/skip" @{ refuelId = $refuelId; reason = 'integration test' }
Assert-True ($null -ne $skipped.skippedAt) 'skip sets skippedAt'
Assert-True ($skipped.workflowStatus -eq 'skipped') 'skipped vehicle reports skipped workflow status'

$unskipped = Invoke-FuelApi POST "/$sessionId/unskip" @{ refuelId = $refuelId }
Assert-True ($null -eq $unskipped.skippedAt) 'unskip clears skippedAt'

$refuelDraft = Invoke-FuelApi POST "/$sessionId/refuel" @{
  refuelId         = $refuelId
  actualFuelLitres = 40
  mileage          = 125000
  mileageSource    = 'manual'
}
$afterRefuel = Invoke-FuelApi GET "/$sessionId"
Assert-True ($afterRefuel.totalActualFuel -ge 40) 'record refuel updates session totals'
Assert-True ($afterRefuel.refuels[0].workflowStatus -eq 'fueled') 'fueled vehicle reports fueled workflow status'

$skipFueled = Invoke-FuelApi POST "/$sessionId/skip" @{ refuelId = $refuelId } -ExpectError
Assert-True ($null -ne $skipFueled) 'cannot skip a fueled vehicle'

$invoice = Invoke-FuelApi POST "/$sessionId/invoices" @{
  attachmentUrl = 'https://example.com/receipt-a.pdf'
  invoiceNumber = 'Receipt A'
}
Assert-True ($invoice.attachmentUrl -like 'https://*') 'attach invoice link'
Assert-True ($invoice.extractionPending -eq $true) 'attachment-only invoice awaits extraction'

$invoice2 = Invoke-FuelApi POST "/$sessionId/invoices" @{
  attachmentUrl = 'https://example.com/receipt-b.pdf'
  invoiceNumber = 'Receipt B'
}
Assert-True ($invoice2.id -ne $invoice.id) 'multiple invoices per day'

$afterInvoices = Invoke-FuelApi GET "/$sessionId"
Assert-True ($afterInvoices.invoices.Count -eq 2) 'session details include both invoices'
Assert-True ($afterInvoices.invoiceSummary.status -eq 'pending') 'rollup pending until extraction'

$reports = Invoke-FuelApi GET '/reports/daily'
$todayRow = @($reports | Where-Object { $_.operationId -eq $sessionId })[0]
Assert-True ($null -ne $todayRow) 'daily history includes today session'
Assert-True ($todayRow.invoiceCount -eq 2) 'history shows invoice count'
Assert-True ($todayRow.reference -like 'FD-*') 'history row exposes the Fueling Day reference'

$closed = Invoke-FuelApi POST "/$sessionId/close" @{}
Assert-True ($closed.status -eq 'locked') 'close locks the day'

$refuelLocked = Invoke-FuelApi POST "/$sessionId/refuel" @{
  refuelId         = $refuelId
  actualFuelLitres = 99
  mileage          = 100002
  mileageSource    = 'manual'
} -ExpectError
Assert-True ($null -ne $refuelLocked) 'refuel blocked when locked'

Write-Host ''
Write-Host "Results: $passed passed, $failed failed" -ForegroundColor $(if ($failed -eq 0) { 'Green' } else { 'Red' })
if ($failed -gt 0) { exit 1 }
