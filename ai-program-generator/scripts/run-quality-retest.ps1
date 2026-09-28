param(
  [string]$OutputName = '.quality-eval-20260909-retest-v2',
  [string]$BaselineName = '.quality-eval-20260909',
  [string]$Types = ''
)

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$baselineDir = Join-Path $repoRoot $BaselineName
$outputDir = Join-Path $repoRoot $OutputName

node (Join-Path $PSScriptRoot 'prepare-quality-retest.mjs') $baselineDir $outputDir $Types
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$env:LUN_QUALITY_RUN = '1'
$env:LUN_QUALITY_OUT = $outputDir
$env:LUN_QUALITY_BASELINE_DIR = $baselineDir
$env:LUN_QUALITY_TYPES = $Types

& (Join-Path $repoRoot 'node_modules/.bin/vitest.cmd') run lib/ai/quality-run.test.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

node (Join-Path $PSScriptRoot 'inspect-quality-actions.mjs') $outputDir $Types
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

node (Join-Path $PSScriptRoot 'summarize-quality-run.mjs') $outputDir
exit $LASTEXITCODE
