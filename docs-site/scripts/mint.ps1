param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Params)

$ErrorActionPreference = 'Stop'

$nvmRoot = $env:NVM_HOME
if (-not $nvmRoot) { $nvmRoot = Join-Path $env:LOCALAPPDATA 'nvm' }

$node22 = Get-ChildItem -Path $nvmRoot -Directory -Filter 'v22.*' -ErrorAction SilentlyContinue |
  Sort-Object { [version]($_.Name.TrimStart('v')) } -Descending |
  Select-Object -First 1

if (-not $node22) {
  Write-Host "[mint] No Node 22.x found under $nvmRoot" -ForegroundColor Red
  Write-Host "[mint] Install it once with:  nvm install 22"
  exit 1
}

$env:PATH = "$($node22.FullName);$env:PATH"
$ver = (& "$($node22.FullName)\node.exe" -v)
Write-Host "[mint] using Node $ver from $($node22.FullName)" -ForegroundColor Cyan

Set-Location (Split-Path $PSScriptRoot -Parent)

$cmd = if ($Params.Count -ge 1) { $Params[0] } else { 'dev' }

switch ($cmd) {
  'dev'     { & npm run dev }
  'sync'    { & npm run sync }
  'check'   { & npm run check }
  'install' { & npm install }
  default   { & npm @Params }
}
exit $LASTEXITCODE
