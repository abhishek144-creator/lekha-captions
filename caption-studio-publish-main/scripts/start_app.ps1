param(
  [switch]$InstallDependencies
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$BackendPort = 8000
$FrontendPort = 3000
$BackendUrl = "http://127.0.0.1:$BackendPort"
$FrontendUrl = "http://localhost:$FrontendPort"
$BackendLog = Join-Path $Root "backend-dev.log"
$FrontendLog = Join-Path $Root "frontend-dev.log"

function Test-PortListening {
  param([int]$Port)
  return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Get-PortOwnerProcesses {
  param([int]$Port)
  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  $pids = @($connections | Select-Object -ExpandProperty OwningProcess -Unique)
  foreach ($ownerPid in $pids) {
    if (-not $ownerPid) { continue }
    Get-CimInstance Win32_Process -Filter "ProcessId=$ownerPid" -ErrorAction SilentlyContinue
  }
}

function Stop-StaleFrontend {
  param(
    [int]$Port,
    [string]$HealthUrl
  )
  if (-not (Test-PortListening $Port)) { return $false }
  if (Test-HttpReady $HealthUrl) { return $false }

  $owners = @(Get-PortOwnerProcesses $Port)
  $staleOwners = @($owners | Where-Object {
    $name = [string]$_.Name
    $command = [string]$_.CommandLine
    ($name -match '^(node|npm|cmd|powershell)(\.exe)?$') -and (
      ($command -match 'vite') -or
      ($command -match 'dev:frontend') -or
      ($command -match ([regex]::Escape($Root)))
    )
  })

  if (-not $staleOwners -or $staleOwners.Count -eq 0) {
    Write-Host "[4/4] Port $Port is in use, but $HealthUrl is not healthy."
    Write-Host "      The owning process does not look like the Lekha dev frontend, so it was not stopped automatically."
    throw "Frontend port is occupied by a non-responsive process."
  }

  Write-Host "[4/4] Replacing stale frontend on port $Port because its API proxy is not healthy..."
  foreach ($owner in $staleOwners) {
    try {
      Stop-Process -Id $owner.ProcessId -Force -ErrorAction Stop
      Write-Host "      Stopped stale frontend process $($owner.ProcessId)."
    } catch {
      throw "Could not stop stale frontend process $($owner.ProcessId): $($_.Exception.Message)"
    }
  }

  for ($i = 0; $i -lt 15; $i++) {
    if (-not (Test-PortListening $Port)) { return $true }
    Start-Sleep -Milliseconds 500
  }
  throw "Frontend port $Port did not free after stopping stale process."
}

function Test-HttpReady {
  param([string]$Url)
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    return [int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 300
  } catch {
    return $false
  }
}

function Stop-StaleBackend {
  param(
    [int]$Port,
    [string]$HealthUrl
  )
  if (-not (Test-PortListening $Port)) { return $false }
  if (Test-HttpReady $HealthUrl) { return $false }

  $owners = @(Get-PortOwnerProcesses $Port)
  $staleOwners = @($owners | Where-Object {
    $name = [string]$_.Name
    $command = [string]$_.CommandLine
    $looksLikeBackend = ($command -match 'uvicorn') -and ($command -match 'backend\.main:app')
    ($name -match '^(node|npm|cmd|powershell|python)(\.exe)?$') -and -not $looksLikeBackend
  })

  if (-not $staleOwners -or $staleOwners.Count -eq 0) {
    Write-Host "[3/4] Port $Port is in use, but $HealthUrl is not healthy."
    Write-Host "      The owning process does not look like the Lekha backend, so it was not stopped automatically."
    throw "Backend port is occupied by a non-responsive process."
  }

  Write-Host "[3/4] Replacing stale backend on port $Port because its health check is not passing..."
  foreach ($owner in $staleOwners) {
    try {
      Stop-Process -Id $owner.ProcessId -Force -ErrorAction Stop
      Write-Host "      Stopped stale backend process $($owner.ProcessId)."
    } catch {
      throw "Could not stop stale backend process $($owner.ProcessId): $($_.Exception.Message)"
    }
  }

  for ($i = 0; $i -lt 15; $i++) {
    if (-not (Test-PortListening $Port)) { return $true }
    Start-Sleep -Milliseconds 500
  }
  throw "Backend port $Port did not free after stopping stale process."
}

function Wait-ForHttp {
  param(
    [string]$Url,
    [int]$Seconds = 45
  )
  for ($i = 0; $i -lt $Seconds; $i++) {
    if (Test-HttpReady $Url) { return $true }
    Start-Sleep -Seconds 1
  }
  return $false
}

function Show-LogTail {
  param([string]$Path)
  if (Test-Path $Path) {
    Write-Host ""
    Write-Host "Last log lines from $Path"
    Get-Content $Path -Tail 40
  }
}

Set-Location -LiteralPath $Root
Write-Host "==================================================="
Write-Host "  Starting Lekha Captions"
Write-Host "==================================================="
Write-Host ""

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  throw "Python is not installed or is not on PATH."
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is not installed or is not on PATH."
}
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  throw "npm is not installed or is not on PATH."
}

if ($InstallDependencies -or -not (Test-Path (Join-Path $Root "node_modules"))) {
  Write-Host "[1/4] Installing frontend dependencies..."
  npm install
  if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
} else {
  Write-Host "[1/4] Frontend dependencies found."
}

if ($InstallDependencies) {
  Write-Host "[2/4] Installing backend dependencies..."
  python -m pip install -r (Join-Path $Root "backend\requirements.txt")
  if ($LASTEXITCODE -ne 0) { throw "Backend dependency install failed." }
} else {
  Write-Host "[2/4] Skipping dependency install. Use start_app_diagnostic.bat to reinstall/check dependencies."
}

if (Test-HttpReady "$BackendUrl/api/version") {
  Write-Host "[3/4] Backend already ready at $BackendUrl"
} else {
  Stop-StaleBackend -Port $BackendPort -HealthUrl "$BackendUrl/api/version" | Out-Null

  if (Test-HttpReady "$BackendUrl/api/version") {
    Write-Host "[3/4] Backend became ready after replacing a stale listener."
  } else {
  if (Test-PortListening $BackendPort) {
    Write-Host "[3/4] Port $BackendPort is in use but /api/version is not responding."
    Write-Host "      Close the process on port $BackendPort, then run start_app.bat again."
    throw "Backend port is occupied by a non-responsive process."
  }

  Write-Host "[3/4] Starting backend on $BackendUrl ..."
  Remove-Item -LiteralPath $BackendLog -Force -ErrorAction SilentlyContinue
  $backendCommand = "set `"APP_ENV=development`" && set `"LOCAL_DEV_AUTH_BYPASS=1`" && python -m uvicorn backend.main:app --host 127.0.0.1 --port $BackendPort >> `"$BackendLog`" 2>&1"
  Start-Process -FilePath "cmd.exe" `
    -ArgumentList @("/d", "/s", "/c", $backendCommand) `
    -WorkingDirectory $Root `
    -WindowStyle Hidden

  if (-not (Wait-ForHttp "$BackendUrl/api/version" 60)) {
    Show-LogTail $BackendLog
    throw "Backend did not become ready. The app was not opened because API calls would fail."
  }
  Write-Host "      Backend ready."
  }
}

Stop-StaleFrontend -Port $FrontendPort -HealthUrl "$FrontendUrl/api/version" | Out-Null

if (Test-PortListening $FrontendPort) {
  Write-Host "[4/4] Frontend already running at $FrontendUrl"
} else {
  Write-Host "[4/4] Starting frontend on $FrontendUrl ..."
  Remove-Item -LiteralPath $FrontendLog -Force -ErrorAction SilentlyContinue
  $frontendCommand = "set `"VITE_BACKEND_PROXY_TARGET=$BackendUrl`" && set `"VITE_USE_DEV_AUTH_BYPASS=1`" && npm run dev:frontend -- --host localhost --port $FrontendPort >> `"$FrontendLog`" 2>&1"
  Start-Process -FilePath "cmd.exe" `
    -ArgumentList @("/d", "/s", "/c", $frontendCommand) `
    -WorkingDirectory $Root `
    -WindowStyle Hidden

  if (-not (Wait-ForHttp $FrontendUrl 45)) {
    Show-LogTail $FrontendLog
    throw "Frontend did not become ready."
  }
  Write-Host "      Frontend ready."
}

if (-not (Test-HttpReady "$FrontendUrl/api/version")) {
  Show-LogTail $FrontendLog
  throw "Frontend is running, but its /api proxy cannot reach the backend. Close the existing frontend on port $FrontendPort, then run start_app.bat again."
}

Write-Host ""
Write-Host "All systems ready:"
Write-Host "  Frontend: $FrontendUrl"
Write-Host "  Backend:  $BackendUrl"
Write-Host ""
Start-Process $FrontendUrl
