# Adds "Network Diagram Designer" to the Start Menu and Desktop (current user only)
# and lets .netdiag files open in the app on double-click.
# Run:  powershell -ExecutionPolicy Bypass -File install_shortcuts.ps1
# Remove: delete the two "Network Diagram Designer.lnk" files and HKCU:\Software\Classes\.netdiag + NetworkDiagram.File.

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$pyw = Join-Path $env:LOCALAPPDATA "Python\bin\pythonw.exe"
if (-not (Test-Path $pyw)) { $pyw = Join-Path $env:LOCALAPPDATA "Python\pythoncore-3.14-64\pythonw.exe" }
if (-not (Test-Path $pyw)) { throw "pythonw.exe not found - install Python and run setup.bat first." }
$app = Join-Path $here "diagram_app.py"
$ico = Join-Path $here "app.ico"

$shell = New-Object -ComObject WScript.Shell
$targets = @(
    (Join-Path ([Environment]::GetFolderPath("Programs")) "Network Diagram Designer.lnk"),
    (Join-Path ([Environment]::GetFolderPath("Desktop")) "Network Diagram Designer.lnk")
)
foreach ($lnk in $targets) {
    $s = $shell.CreateShortcut($lnk)
    $s.TargetPath = $pyw
    $s.Arguments = '"' + $app + '"'
    $s.WorkingDirectory = $here
    $s.IconLocation = $ico + ",0"
    $s.Description = "Draw network diagrams (Visio-style)"
    $s.Save()
    "Created $lnk"
}

# .netdiag file association (per user)
$cls = "HKCU:\Software\Classes"
New-Item -Path "$cls\.netdiag" -Force | Out-Null
Set-ItemProperty -Path "$cls\.netdiag" -Name "(default)" -Value "NetworkDiagram.File"
New-Item -Path "$cls\NetworkDiagram.File\DefaultIcon" -Force | Out-Null
Set-ItemProperty -Path "$cls\NetworkDiagram.File" -Name "(default)" -Value "Network Diagram"
Set-ItemProperty -Path "$cls\NetworkDiagram.File\DefaultIcon" -Name "(default)" -Value "$ico,0"
New-Item -Path "$cls\NetworkDiagram.File\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path "$cls\NetworkDiagram.File\shell\open\command" -Name "(default)" -Value ('"' + $pyw + '" "' + $app + '" "%1"')
"Registered .netdiag files"
