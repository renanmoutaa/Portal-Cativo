# Requires: PowerShell 5+
# Purpose: Create firewall rule for TCP/80 and register a Scheduled Task
# to start Docker+Nginx on user logon using scripts/start-nginx.ps1.

$ErrorActionPreference = 'Stop'

function Assert-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($id)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Este script precisa ser executado como Administrador.'
    }
}

Assert-Admin

$repoRoot = Split-Path -Parent $PSScriptRoot
$startScript = Join-Path $PSScriptRoot 'start-nginx.ps1'
if (-not (Test-Path $startScript)) {
    throw "Script não encontrado: $startScript"
}

# 1) Firewall: liberar porta 80 (Perfis Domínio/Privado)
$ruleName = 'PortalCativo Nginx 80'
if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort 80 -Profile Domain,Private | Out-Null
    Write-Host "Regra de firewall criada: $ruleName"
} else {
    Write-Host "Regra de firewall já existe: $ruleName"
}

# 2) Tarefa Agendada: executar no logon do usuário com privilégios elevados
$taskName = 'PortalCativo-Nginx'
try {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
} catch {}

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$startScript`"" -WorkingDirectory "$repoRoot"
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:UserName
$principal = New-ScheduledTaskPrincipal -UserId "$env:UserDomain\$env:UserName" -LogonType InteractiveToken -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

$task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings
Register-ScheduledTask -TaskName $taskName -InputObject $task -Force | Out-Null

# 3) Executar uma vez agora para validar
Start-ScheduledTask -TaskName $taskName | Out-Null

Write-Host 'Instalação concluída.'
Write-Host "Tarefa agendada: $taskName"
Write-Host "Logs em: $env:ProgramData\PortalCativo\startup.log (ou %LocalAppData%\\PortalCativo se sem permissão)"