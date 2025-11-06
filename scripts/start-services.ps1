param(
    [int]$FrontPort = 4000,
    [int]$FastApiPort = 4001,
    [int]$NestPort = 4002,
    [int]$RedirectPort = 80,
    [switch]$StartRedirectServer = $true,
    [switch]$StartNginx = $true,
    [switch]$UseMockController = $false
)

$ErrorActionPreference = 'Stop'

# Resolve repo root from this script location
$repoRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path $repoRoot 'backend'
$fastapiRoot = Join-Path $backendRoot 'fastapi'
$nestRoot = Join-Path $backendRoot 'nest'
$scriptsRoot = Join-Path $repoRoot 'scripts'
$composePath = Join-Path $repoRoot 'docker-compose.yml'

function Write-Info($msg) { Write-Host "[start] $msg" }
function Write-Warn($msg) { Write-Warning "[start] $msg" }

function Read-DotEnv {
    param([string]$EnvPath)
    if (-not (Test-Path $EnvPath)) { return }
    Write-Info "Carregando variáveis de ambiente de: $EnvPath"
    foreach ($line in Get-Content -Path $EnvPath) {
        if ($line -match '^\s*#' -or -not ($line -match '=')) { continue }
        $parts = $line.Split('=',2)
        $key = $parts[0].Trim()
        $val = $parts[1].Trim()
        if (-not [string]::IsNullOrWhiteSpace($key)) {
            Set-Item -Path "Env:$key" -Value $val
        }
    }
}

function Ensure-FastApiVenv {
    $venvDir = Join-Path $fastapiRoot '.venv'
    $pyExe = Join-Path $venvDir 'Scripts\python.exe'
    if (Test-Path $pyExe) { return $pyExe }

    Write-Info 'Criando ambiente virtual do FastAPI (.venv)'
    $sysPy = $null
    $cmdPy = Get-Command python -ErrorAction SilentlyContinue
    if ($cmdPy) { $sysPy = $cmdPy.Source }
    if (-not $sysPy) {
        $cmdPy2 = Get-Command py -ErrorAction SilentlyContinue
        if ($cmdPy2) { $sysPy = $cmdPy2.Source }
    }
    if (-not $sysPy) { throw 'Python não encontrado no PATH. Instale Python 3.x.' }

    Push-Location $fastapiRoot
    try {
        & $sysPy -m venv .venv
        & $pyExe -m pip install --upgrade pip
        & (Join-Path $venvDir 'Scripts\pip.exe') install -r (Join-Path $fastapiRoot 'requirements.txt')
    } finally { Pop-Location }
    return $pyExe
}

function Start-ServiceWindow {
    param(
        [string]$Name,
        [string]$WorkingDirectory,
        [string]$PreScript,
        [string]$Command
    )
    $fullCmd = "$PreScript; Set-Location `"$WorkingDirectory`"; $Command"
    Write-Info "Iniciando $Name"
    Start-Process -FilePath "powershell" -ArgumentList "-NoLogo -NoProfile -ExecutionPolicy Bypass -Command $fullCmd" -WorkingDirectory $WorkingDirectory | Out-Null
}

# --- Docker Desktop + Nginx helpers ---
function Ensure-DockerDesktop {
    try {
        $dockerProcs = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -in @('Docker Desktop','com.docker.backend','com.docker.proxy') }
        if (-not $dockerProcs) {
            $candidates = @(
                (Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'),
                (Join-Path $env:LocalAppData 'Docker\Docker Desktop.exe')
            )
            $exe = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
            if ($exe) {
                Write-Info "Iniciando Docker Desktop: $exe"
                Start-Process -FilePath $exe | Out-Null
            } else {
                Write-Warn 'Docker Desktop não encontrado nas paths padrão. Prosseguindo mesmo assim.'
            }
        } else {
            Write-Info 'Docker Desktop já parece em execução.'
        }
    } catch {
        Write-Warn "Falha ao verificar/iniciar Docker Desktop: $($_.Exception.Message)"
    }
}

function Wait-Docker {
    param([int]$TimeoutSec = 240)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try { docker info *> $null } catch {}
        if ($LASTEXITCODE -eq 0) { return $true }
        Start-Sleep -Seconds 3
    }
    return $false
}

function Start-NginxCompose {
    if (-not (Test-Path $composePath)) {
        Write-Warn "Compose file não encontrado: $composePath"
        return
    }
    Write-Info "Subindo serviço 'nginx' via docker compose"
    $composeArgsPlugin = @('compose','-f', $composePath, 'up','-d', 'nginx')
    & docker @composeArgsPlugin
    if ($LASTEXITCODE -ne 0) {
        Write-Info "Plugin 'docker compose' indisponível, tentando 'docker-compose'"
        $composeArgsLegacy = @('-f', $composePath, 'up','-d', 'nginx')
        & docker-compose @composeArgsLegacy
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "Falha ao subir Nginx (exit $LASTEXITCODE)"
    } else {
        Write-Info "Nginx iniciado com sucesso em http://localhost/"
    }
}

# 1) Carregar .env do backend (se existir)
Read-DotEnv (Join-Path $backendRoot '.env')

# 2) Determinar portas (prioriza .env)
if ($env:FASTAPI_PORT) { $FastApiPort = [int]$env:FASTAPI_PORT }
if ($env:NEST_PORT) { $NestPort = [int]$env:NEST_PORT }
# FrontPort pode ser sobreposto por $env:PORT
if ($env:PORT) { $FrontPort = [int]$env:PORT }

Write-Info "Portas: Front=$FrontPort, FastAPI=$FastApiPort, Nest=$NestPort, Redirect=$RedirectPort"

# 3) Valida Node/NPM
try { node -v *> $null } catch { throw 'Node.js não encontrado no PATH.' }
try { npm -v  *> $null } catch { throw 'npm não encontrado no PATH.' }

# 4) Preparar FastAPI (.venv)
$pyExe = Ensure-FastApiVenv

# 5) Iniciar serviços em janelas separadas

# Frontend (npm run dev)
$frontCmd = "npm run dev"
Start-ServiceWindow -Name "Frontend (Vite:$FrontPort)" -WorkingDirectory $repoRoot -PreScript "$env:PORT='$FrontPort'" -Command $frontCmd

# FastAPI (uvicorn)
$fastapiCmd = "& `"$pyExe`" -m uvicorn main:app --reload --port $FastApiPort --host 0.0.0.0"
Start-ServiceWindow -Name "FastAPI ($FastApiPort)" -WorkingDirectory $fastapiRoot -PreScript "" -Command $fastapiCmd

# Nest (ts-node dev)
$nestCmd = "npm run dev"
Start-ServiceWindow -Name "Nest ($NestPort)" -WorkingDirectory $nestRoot -PreScript "$env:NEST_PORT='$NestPort'" -Command $nestCmd

# Redirecionador (porta 80 -> 4000)
if ($StartRedirectServer) {
    $serveCmd = "node `"$scriptsRoot\serve.mjs`""
    Start-ServiceWindow -Name "Redirect ($RedirectPort)" -WorkingDirectory $repoRoot -PreScript "$env:PORT='$RedirectPort'" -Command $serveCmd
}

# Nginx via Docker (opcional, por padrão ativado)
if ($StartNginx) {
    Ensure-DockerDesktop
    if (Wait-Docker -TimeoutSec 240) {
        Start-NginxCompose
    } else {
        Write-Warn 'Docker não ficou pronto dentro do tempo limite.'
    }
}

# Unifi Mock (opcional)
if ($UseMockController) {
    $mockPath = Join-Path $nestRoot 'mocks\unifi-mock.mjs'
    if (Test-Path $mockPath) {
        $mockCmd = "node `"$mockPath`""
        Start-ServiceWindow -Name "UniFi Mock (4010)" -WorkingDirectory $nestRoot -PreScript "$env:UNIFI_MOCK_PORT='4010'" -Command $mockCmd
    } else {
        Write-Warn 'Mock UniFi não encontrado em backend\nest\mocks\unifi-mock.mjs'
    }
}

Write-Host "\n=== Serviços iniciados ==="
Write-Host "- Frontend:     http://localhost:$FrontPort/"
Write-Host "- FastAPI:      http://localhost:$FastApiPort/ (ex.: /health)"
Write-Host "- Nest:         http://localhost:$NestPort/ (ex.: /controllers)"
if ($StartRedirectServer) { Write-Host "- Redirect:      http://localhost:$RedirectPort/ (redireciona /guest -> /portal/login)" }
if ($StartNginx) { Write-Host "- Nginx (80):    http://localhost/portal/login" }

Write-Host "\nPara parar, feche as janelas abertas dos serviços ou finalize os processos correspondentes."