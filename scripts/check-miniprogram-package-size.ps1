$ErrorActionPreference = "Stop"

function Get-MiniProgramRoot {
  param([string]$ProjectConfigPath)

  if (-not (Test-Path -LiteralPath $ProjectConfigPath)) {
    throw "Cannot find project config: $ProjectConfigPath"
  }

  $configJson = Get-Content -LiteralPath $ProjectConfigPath -Raw | ConvertFrom-Json
  $root = $configJson.miniprogramRoot
  if ([string]::IsNullOrWhiteSpace($root)) {
    throw "project.config.json does not contain miniprogramRoot"
  }

  return (Resolve-Path -LiteralPath $root).Path
}

function Get-DirSizeBytes {
  param([string]$Dir)
  return (Get-ChildItem -LiteralPath $Dir -Recurse -File -Force | Measure-Object -Sum Length).Sum
}

$projectConfig = Join-Path $PSScriptRoot "..\\project.config.json"
$miniRoot = Get-MiniProgramRoot -ProjectConfigPath $projectConfig
$totalBytes = Get-DirSizeBytes -Dir $miniRoot

$maxBytes = 2MB
$totalMb = [math]::Round($totalBytes / 1MB, 2)

Write-Host "miniprogramRoot: $miniRoot"
Write-Host ("total: {0} bytes ({1} MB)" -f $totalBytes, $totalMb)

Write-Host ""
Write-Host "Top 20 largest files:"
Get-ChildItem -LiteralPath $miniRoot -Recurse -File -Force |
  Sort-Object Length -Descending |
  Select-Object -First 20 FullName, Length |
  Format-Table -AutoSize

if ($totalBytes -gt $maxBytes) {
  Write-Error ("Package too large: {0} MB > 2.00 MB. Reduce resources or use subpackages/CDN." -f $totalMb)
  exit 1
}

