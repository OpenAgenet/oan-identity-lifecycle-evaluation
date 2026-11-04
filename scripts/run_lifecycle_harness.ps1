param(
  [ValidateSet('sqlite','postgres')][string]$Backend = 'sqlite',
  [string]$Scale = '1',
  [string]$RunId = "lifecycle-$(Get-Date -Format yyyyMMdd-HHmmss)"
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
npm run build | Out-Host
$run = Join-Path $root "runs\$RunId"
New-Item -ItemType Directory -Force -Path $run | Out-Null
$steps = @(
  @{name='service-registration-vc'; scenario='service-registration-vc'},
  @{name='root-distribution-and-discovery'; scenario='multi-registrar-discovery'},
  @{name='discovery-authorization-isolation'; scenario='authorized-domain-isolation'}
)
$results = @()
foreach ($step in $steps) {
  $started = (Get-Date).ToUniversalTime().ToString('o')
  $log = Join-Path $run "$($step.name).log"
  & node (Join-Path $root 'dist\src\harness.js') $step.scenario $Backend $Scale *> $log
  $code = $LASTEXITCODE
  $results += [ordered]@{ step=$step.name; scenario=$step.scenario; started=$started; exitCode=$code; log=$log }
  if ($code -ne 0) { break }
}
[ordered]@{runId=$RunId; backend=$Backend; scale=$Scale; runtimeDependency=$false; steps=$results; generatedAt=(Get-Date).ToUniversalTime().ToString('o')} |
  ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 (Join-Path $run 'lifecycle-evidence.json')
if (($results | Where-Object {$_.exitCode -ne 0}).Count -gt 0) { exit 1 }
Write-Host "Lifecycle harness evidence: $run"
