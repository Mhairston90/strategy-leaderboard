# Create a Desktop shortcut that launches the Hermes monitoring dashboard.
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'Hermes Monitor.lnk'
$batPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'Open Hermes Monitor.bat'
$workDir = Split-Path -Parent $batPath

$WshShell = New-Object -ComObject WScript.Shell
$lnk = $WshShell.CreateShortcut($shortcutPath)
$lnk.TargetPath = $batPath
$lnk.WorkingDirectory = $workDir
$lnk.WindowStyle = 7
$lnk.IconLocation = 'C:\Windows\System32\shell32.dll,220'
$lnk.Description = 'Open the Hermes monitoring dashboard'
$lnk.Save()

Write-Host "Desktop shortcut created at: $shortcutPath"
Write-Host "  -> launches: $batPath"
