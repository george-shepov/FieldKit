$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $ScriptDir
$OutDir = if ($env:OUT_DIR) { $env:OUT_DIR } else { Join-Path $Root 'dist' }
$Version = if ($env:VERSION) { $env:VERSION } else { Get-Date -Format 'yyyy.MM.dd' }
$App = if ($env:APP) { $env:APP } else { 'prosepilot' }

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$Targets = @(
  @{ GOOS='linux'; GOARCH='amd64' },
  @{ GOOS='linux'; GOARCH='arm64' },
  @{ GOOS='windows'; GOARCH='amd64' },
  @{ GOOS='windows'; GOARCH='arm64' },
  @{ GOOS='darwin'; GOARCH='amd64' },
  @{ GOOS='darwin'; GOARCH='arm64' }
)

$LdFlags = "-s -w -X main.buildVersion=$Version"

Write-Host "Building FieldKit launcher"
Write-Host "Version: $Version"
Write-Host "Output:  $OutDir"
Write-Host ""

Push-Location $Root
try {
  foreach ($t in $Targets) {
    $goos = $t.GOOS
    $goarch = $t.GOARCH
    $ext = if ($goos -eq 'windows') { '.exe' } else { '' }
    $outName = "$App-$goos-$goarch$ext"
    $outPath = Join-Path $OutDir $outName

    Write-Host "-> $goos/$goarch"
    $env:GOOS = $goos
    $env:GOARCH = $goarch
    $env:CGO_ENABLED = '0'

    go build -trimpath -ldflags $LdFlags -o $outPath .
  }
}
finally {
  Remove-Item Env:GOOS -ErrorAction SilentlyContinue
  Remove-Item Env:GOARCH -ErrorAction SilentlyContinue
  Remove-Item Env:CGO_ENABLED -ErrorAction SilentlyContinue
  Pop-Location
}

Write-Host ""
Write-Host "Done. Artifacts:"
Get-ChildItem $OutDir | Format-Table Name,Length,LastWriteTime -AutoSize
