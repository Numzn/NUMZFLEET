param([string]$Base = 'http://localhost:5176')
$r = Invoke-WebRequest -Uri "$Base/socket.io/?EIO=4&transport=polling" -UseBasicParsing
if ($r.Content -match '"sid":"([^"]+)"') { $sid = $Matches[1] } else { throw "no sid in $($r.Content)" }
Write-Host "GET ok sid=$sid"
$p = Invoke-WebRequest -Uri "$Base/socket.io/?EIO=4&transport=polling&sid=$sid" -Method POST -Body '40' -ContentType 'text/plain' -UseBasicParsing
Write-Host "POST status=$($p.StatusCode) body=$($p.Content)"
