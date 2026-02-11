# Cria atalho do CloudVault na Area de Trabalho
$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\CloudVault.lnk")

$Shortcut.TargetPath = "cmd.exe"
$Shortcut.Arguments = '/c cd /d "' + $projectPath + '\desktop" && npm start'
$Shortcut.WorkingDirectory = $projectPath + "\desktop"
$Shortcut.IconLocation = $projectPath + "\desktop\assets\icon.png,0"
$Shortcut.Description = "CloudVault - Armazenamento em nuvem"

$Shortcut.Save()
Write-Host "Atalho criado na Area de Trabalho!" -ForegroundColor Green
