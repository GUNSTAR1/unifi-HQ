# Builds the iCUE widget for the CORSAIR XENEON EDGE from the dashboard in ..\web
#   .\build.ps1             -> Lagezentrum\ (widget source) and lagezentrum.icuewidget
#   .\build.ps1 -NoPackage  -> only Lagezentrum\ (to open index.html in a browser)
# Packaging needs Corsair's CLI: npm install -g @corsair/icuewidget (or whatever provides `icuewidget`).
param([switch]$NoPackage)
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$web = Join-Path $here '..\web' | Resolve-Path
$src = Join-Path $here 'src'
$out = Join-Path $here 'Lagezentrum'

if (Test-Path $out) { Remove-Item -Recurse -Force $out }
New-Item -ItemType Directory -Force (Join-Path $out 'scripts'), (Join-Path $out 'resources') | Out-Null

# Dashboard unverändert übernehmen (gleiche Pfade wie auf dem Server, auch vendor/ für Texturen und Schriften)
Copy-Item (Join-Path $web 'app.js'), (Join-Path $web 'app.css') $out
Copy-Item -Recurse (Join-Path $web 'vendor') (Join-Path $out 'vendor')
Copy-Item (Join-Path $web 'favicon.svg') (Join-Path $out 'resources\icon.svg')
Copy-Item (Join-Path $src 'manifest.json') $out
Copy-Item (Join-Path $src 'boot.js') (Join-Path $out 'scripts\boot.js')

# index.html: iCUE-Kopf + Körper des Dashboards, Skripte lädt boot.js nach den iCUE-Einstellungen
$utf8 = New-Object System.Text.UTF8Encoding($false)
$page = [IO.File]::ReadAllText((Join-Path $web 'index.html'), $utf8)
$m = [regex]::Match($page, '(?s)<body>(.*)</body>')
if (-not $m.Success) { throw 'web/index.html: <body> not found' }
$body = $m.Groups[1].Value -replace '(?m)^\s*<script src="[^"]+"></script>\s*$\r?\n?', ''
# Link zur VictoriaLogs-Oberfläche gibt es nur auf dem Server (im Widget ausgeblendet)
$body = $body -replace 'href="select/vmui/"', 'href="#"'
$head = [IO.File]::ReadAllText((Join-Path $src 'head.html'), $utf8)
$html = @"
<!DOCTYPE html>
<html lang="en">
<head>
$head</head>
<body>
$body
<script>
  // iCUE API binding (bare assignment on purpose, iCUE's validator looks for it here)
  icueEvents = {
    'onDataUpdated': function () { if (typeof onIcueDataUpdated === 'function') onIcueDataUpdated(); },
    'onICUEInitialized': function () { if (typeof onIcueInitialized === 'function') onIcueInitialized(); }
  };
</script>
<script src="scripts/boot.js"></script>
</body>
</html>
"@
[IO.File]::WriteAllText((Join-Path $out 'index.html'), ($html -replace "`r`n", "`n"), $utf8)
Write-Host "Widget source: $out"

if ($NoPackage) { return }
$pkg = Join-Path $here 'lagezentrum.icuewidget'
& icuewidget package $out -o $pkg
if ($LASTEXITCODE -ne 0) { throw "icuewidget package failed ($LASTEXITCODE)" }
Write-Host "Package: $pkg"
