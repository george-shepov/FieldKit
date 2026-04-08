$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $ScriptDir
$DistDir = if ($env:DIST_DIR) { $env:DIST_DIR } else { Join-Path $Root 'dist' }
$PkgDir = if ($env:PKG_DIR) { $env:PKG_DIR } else { Join-Path $DistDir 'packages' }
$App = if ($env:APP) { $env:APP } else { 'prosepilot' }
$Version = if ($env:VERSION) { $env:VERSION } else { Get-Date -Format 'yyyy.MM.dd' }
$BuildIfMissing = if ($env:BUILD_IF_MISSING) { $env:BUILD_IF_MISSING } else { '0' }

if (!(Test-Path $DistDir)) {
  New-Item -ItemType Directory -Force -Path $DistDir | Out-Null
}

$Artifacts = Get-ChildItem -Path $DistDir -File -Filter "$App-*" -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match "^$App-(linux|windows|darwin)-[a-z0-9]+(\.exe)?$" }

if (!$Artifacts -or $Artifacts.Count -eq 0) {
  if ($BuildIfMissing -eq '1') {
    Write-Host "No artifacts found. Running scripts/build-release.ps1..."
    & (Join-Path $ScriptDir 'build-release.ps1')
    $Artifacts = Get-ChildItem -Path $DistDir -File -Filter "$App-*" |
      Where-Object { $_.Name -match "^$App-(linux|windows|darwin)-[a-z0-9]+(\.exe)?$" }
  } else {
    throw "No artifacts found in $DistDir. Run scripts/build-release.ps1 first or set BUILD_IF_MISSING=1."
  }
}

New-Item -ItemType Directory -Force -Path $PkgDir | Out-Null
$Stage = Join-Path $PkgDir '.stage'
if (Test-Path $Stage) { Remove-Item -Recurse -Force $Stage }
New-Item -ItemType Directory -Force -Path $Stage | Out-Null

$Manifest = Join-Path $PkgDir "manifest-$Version.txt"
@(
  "FieldKit customer bundles"
  "Version: $Version"
  "Generated: $([DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ'))"
  ""
) | Set-Content -Path $Manifest -Encoding UTF8

$Count = 0
foreach ($Artifact in $Artifacts) {
  if ($Artifact.Name -notmatch "^$App-([a-z0-9]+)-([a-z0-9]+)(\.exe)?$") { continue }
  $Goos = $Matches[1]
  $Goarch = $Matches[2]

  $BundleName = "$App-$Version-$Goos-$Goarch"
  $BundleRoot = Join-Path $Stage $BundleName
  New-Item -ItemType Directory -Force -Path $BundleRoot | Out-Null

  $RunLocal = 'run-local.sh'
  $RunLan = 'run-lan.sh'
  if ($Goos -eq 'windows') {
    Copy-Item $Artifact.FullName (Join-Path $BundleRoot "$App.exe")
    @"
@echo off
set SCRIPT_DIR=%~dp0
"%SCRIPT_DIR%$App.exe"
"@ | Set-Content -Path (Join-Path $BundleRoot 'run-local.bat') -Encoding ASCII

    @"
@echo off
set SCRIPT_DIR=%~dp0
if "%FIELDKIT_API_KEY%"=="" (
  "%SCRIPT_DIR%$App.exe" --share --enable-api
) else (
  "%SCRIPT_DIR%$App.exe" --share --enable-api --api-key "%FIELDKIT_API_KEY%"
)
"@ | Set-Content -Path (Join-Path $BundleRoot 'run-lan.bat') -Encoding ASCII

    $RunLocal = 'run-local.bat'
    $RunLan = 'run-lan.bat'
  } else {
    Copy-Item $Artifact.FullName (Join-Path $BundleRoot $App)
    @"
#!/usr/bin/env bash
set -euo pipefail
DIR="`$(cd "`$(dirname "`${BASH_SOURCE[0]}")" && pwd)"
exec "`${DIR}/$App" "`$@"
"@ | Set-Content -Path (Join-Path $BundleRoot 'run-local.sh') -Encoding ASCII

    @"
#!/usr/bin/env bash
set -euo pipefail
DIR="`$(cd "`$(dirname "`${BASH_SOURCE[0]}")" && pwd)"
API_KEY="`${FIELDKIT_API_KEY:-}"
if [[ -n "`${API_KEY}" ]]; then
  exec "`${DIR}/$App" --share --enable-api --api-key "`${API_KEY}" "`$@"
fi
exec "`${DIR}/$App" --share --enable-api "`$@"
"@ | Set-Content -Path (Join-Path $BundleRoot 'run-lan.sh') -Encoding ASCII
  }

  @"
FieldKit ($Goos/$Goarch)
Version: $Version

Quick start:
1) Extract this folder.
2) Run:
   - Desktop only: $RunLocal
   - Desktop + phone on same LAN + API: $RunLan
3) Open the printed URL in your browser.

Important:
- For public hosting, run behind HTTPS and set a strong API key.
- To require API auth in run-lan scripts, set PROSEPILOT_API_KEY before launch.
- API endpoints include media sync, registration, heartbeat, wishlist, and support ticket intake.
- Press F1 in launcher/apps for built-in help.
"@ | Set-Content -Path (Join-Path $BundleRoot 'README.txt') -Encoding UTF8

  $ZipPath = Join-Path $PkgDir "$BundleName.zip"
  Compress-Archive -Path (Join-Path $BundleRoot '*') -DestinationPath $ZipPath -Force
  $Size = (Get-Item $ZipPath).Length

  Add-Content -Path $Manifest -Value $([string]::Format("{0}`n  source: {1}`n  size: {2} bytes`n", (Split-Path -Leaf $ZipPath), $Artifact.Name, $Size))
  $Count++
}

if (Test-Path $Stage) { Remove-Item -Recurse -Force $Stage }

if ($Count -eq 0) {
  throw "No matching artifacts found for $App-<os>-<arch> in $DistDir"
}

Write-Host "Packaged $Count bundle(s) into $PkgDir"
Write-Host "Manifest: $Manifest"
Get-ChildItem $PkgDir | Format-Table Name,Length,LastWriteTime -AutoSize
