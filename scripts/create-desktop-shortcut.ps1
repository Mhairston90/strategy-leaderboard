# Create a Desktop shortcut that launches the Strategy Leaderboard.
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'Strategy Leaderboard.lnk'
$batPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'Open Leaderboard.bat'
$workDir = Split-Path -Parent $batPath

$WshShell = New-Object -ComObject WScript.Shell
$lnk = $WshShell.CreateShortcut($shortcutPath)
$lnk.TargetPath = $batPath
$lnk.WorkingDirectory = $workDir
$lnk.WindowStyle = 7  # 7 = minimized (hides the brief cmd window flash)
$lnk.IconLocation = 'C:\Windows\System32\shell32.dll,176'  # bar-chart icon
$lnk.Description = 'Open the cross-strategy performance dashboard in Chrome'
$lnk.Save()

Write-Host "Desktop shortcut created at: $shortcutPath"
Write-Host "  -> launches: $batPath"
