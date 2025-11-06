# Requires: PowerShell 5+
# Purpose: Ensure Docker Desktop is running, wait for Docker Engine to be ready,
# then start the Nginx service via docker compose. Writes logs to a safe location.

param(
    [string]$ComposeService = 'nginx'
)

$ErrorActionPreference = 'Stop'

# Resolve repo root from this script location
$repoRoot = Split-Path -Parent $PSScriptRoot
$composePath = Join-Path $repoRoot 'docker-compose.yml'

# Prepare logging (prefer ProgramData, fallback to LocalAppData)
function New-LogDir {
    try {
        $dir = Join-Path $env:ProgramData 'PortalCativo'
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        return $dir
    } catch {
        $dir = Join-Path $env:LocalAppData 'PortalCativo'
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        return $dir
    }
}

$logDir = New-LogDir
$logFile = Join-Path $logDir 'startup.log'
Start-Transcript -Path $logFile -Append | Out-Null

Write-Host "=== PortalCativo Startup $(Get-Date -Format s) ==="
Write-Host "Repo root: $repoRoot"
Write-Host "Compose file: $composePath"

# Try to start Docker Desktop if it doesn't look running
try {
    $dockerProcs = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -in @('Docker Desktop','com.docker.backend','com.docker.proxy') }
    if (-not $dockerProcs) {
        $candidates = @(
            (Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'),
            (Join-Path $env:ProgramW6432 'Docker\Docker\Docker Desktop.exe'),
            (Join-Path $env:LocalAppData 'Docker\Docker Desktop.exe')
        )
        $exe = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
        if ($exe) {
            Write-Host "Iniciando Docker Desktop: $exe"
            Start-Process -FilePath $exe | Out-Null
        } else {
            Write-Warning 'Docker Desktop não encontrado nas paths padrão. Prosseguindo mesmo assim.'
        }
    } else {
        Write-Host 'Docker Desktop já parece em execução.'
    }
} catch {
    Write-Warning "Falha ao verificar/iniciar Docker Desktop: $($_.Exception.Message)"
}

function Wait-Docker {
    param([int]$TimeoutSec = 240)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            docker info *> $null
        } catch {
            # Ignorar erros transitórios enquanto o Desktop inicializa
        }
        if ($LASTEXITCODE -eq 0) { return $true }
        Start-Sleep -Seconds 3
    }
    return $false
}

if (-not (Wait-Docker -TimeoutSec 240)) {
    Write-Error 'Docker não ficou pronto dentro do tempo limite.'
    Stop-Transcript | Out-Null
    exit 1
}

if (-not (Test-Path $composePath)) {
    Write-Error "Compose file não encontrado: $composePath"
    Stop-Transcript | Out-Null
    exit 2
}

Write-Host "Subindo serviço '$ComposeService' via docker compose..."

# Tentar plugin 'docker compose'; em caso de falha, usar 'docker-compose' legado
$composeArgsPlugin = @('compose','-f', $composePath, 'up','-d', $ComposeService)
Write-Host ("docker " + ($composeArgsPlugin -join ' '))
& docker @composeArgsPlugin
if ($LASTEXITCODE -ne 0) {
    Write-Host "Plugin 'docker compose' indisponível, tentando 'docker-compose'..."
    $composeArgsLegacy = @('-f', $composePath, 'up','-d', $ComposeService)
    Write-Host ("docker-compose " + ($composeArgsLegacy -join ' '))
    & docker-compose @composeArgsLegacy
}

if ($LASTEXITCODE -ne 0) {
    Write-Error "docker compose retornou código $LASTEXITCODE"
    Stop-Transcript | Out-Null
    exit $LASTEXITCODE
}

Write-Host "Serviço '$ComposeService' iniciado com sucesso."
Stop-Transcript | Out-Null
exit 0