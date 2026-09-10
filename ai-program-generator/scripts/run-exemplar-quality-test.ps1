param(
  [string]$OutputName = '',
  [string]$Types = '',
  [int]$PlanCount = 50,
  [switch]$PreflightOnly,
  [switch]$UploadPassing
)

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if ([string]::IsNullOrWhiteSpace($OutputName)) {
  $OutputName = '.quality-eval-exemplar-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
}
$outputDir = Join-Path $repoRoot $OutputName

$env:LUN_QUALITY_RUN = '1'
$env:LUN_QUALITY_OUT = $outputDir
$env:LUN_QUALITY_COMPARISON = 'exemplar'
$env:LUN_QUALITY_PLAN_LIMIT = [string]$PlanCount
$env:LUN_QUALITY_TYPES = $Types
$env:LUN_QUALITY_PREFLIGHT_ONLY = if ($PreflightOnly) { '1' } else { '0' }
Remove-Item Env:LUN_QUALITY_BASELINE_DIR -ErrorAction SilentlyContinue

& (Join-Path $repoRoot 'node_modules/.bin/vitest.cmd') run lib/ai/quality-run.test.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if ($PreflightOnly) {
  Write-Output "Exemplar inventory: $(Join-Path $outputDir 'exemplar-inventory.json')"
  exit 0
}

node (Join-Path $PSScriptRoot 'inspect-quality-actions.mjs') $outputDir $Types
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

node (Join-Path $PSScriptRoot 'summarize-quality-run.mjs') $outputDir
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

node (Join-Path $PSScriptRoot 'analyze-quality-candidates.mjs') $outputDir
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($UploadPassing) {
  $env:LUN_QUALITY_UPLOAD = '1'
  & (Join-Path $repoRoot 'node_modules/.bin/vitest.cmd') run lib/ai/upload-quality-candidates.test.ts
  exit $LASTEXITCODE
}
exit 0
