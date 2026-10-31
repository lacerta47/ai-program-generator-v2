param([ValidateSet('bizrouter', 'bizrouter2', 'gemini')][string]$Provider = 'bizrouter')
$ErrorActionPreference = 'Stop'
$keyName = switch ($Provider) {
  'gemini' { 'GEMINI_API_KEY' }
  'bizrouter2' { 'BIZROUTER_API_KEY_2' }
  default { 'BIZROUTER_API_KEY' }
}
$projectDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Push-Location -LiteralPath $projectDir
try {
  # Refuse to write unless Git excludes the credential file.
  & git check-ignore -q -- .env.local
  if ($LASTEXITCODE -ne 0) { throw '.env.local is not ignored by Git.' }
  $secureKey = Read-Host "$Provider key (hidden, saved for future local runs)" -AsSecureString
  try {
    $credential = [System.Net.NetworkCredential]::new('', $secureKey)
    $keyText = $credential.Password.Trim()
    if (-not $keyText -or $keyText -match '\s') { throw 'Enter a non-empty, single-line API key.' }
    # Append only. Existing settings are never read or rewritten.
    $entry = "`r`n" + $keyName + '=' + $keyText + "`r`n"
    [System.IO.File]::AppendAllText((Join-Path $projectDir '.env.local'), $entry, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Saved $keyName to local configuration. No API request was sent."
  } finally {
    $entry = $null
    $keyText = $null
    $credential = $null
    if ($secureKey) { $secureKey.Dispose() }
  }
} finally { Pop-Location }
