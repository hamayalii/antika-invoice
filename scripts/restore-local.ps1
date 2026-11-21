# ---------------------------------------------------------------------------
# Antika Docs — restore a local PostgreSQL dump (Windows PowerShell).
#
# Usage (from the repository root):
#   .\scripts\restore-local.ps1 backups\antika_docs-20261120T101500Z.dump
#
# Stop the API first (Ctrl+C in its terminal) so nothing writes during the
# restore. A safety backup is taken automatically unless -SkipBackup is used.
# For the Docker/VPS deployment use scripts/restore.sh instead.
# ---------------------------------------------------------------------------
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$DumpFile,
  [string]$EnvFile = ".env",
  [switch]$Force,
  [switch]$SkipBackup
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envPath = if ([System.IO.Path]::IsPathRooted($EnvFile)) { $EnvFile } else { Join-Path $root $EnvFile }
$dumpPath = if ([System.IO.Path]::IsPathRooted($DumpFile)) { $DumpFile } else { Join-Path (Get-Location) $DumpFile }

if (-not (Test-Path $envPath)) { throw "Env file not found: $envPath" }
if (-not (Test-Path $dumpPath)) { throw "Dump file not found: $dumpPath" }

Get-Content $envPath | ForEach-Object {
  $line = $_.Trim()
  if ($line -eq "" -or $line.StartsWith("#")) { return }
  $index = $line.IndexOf("=")
  if ($index -lt 1) { return }
  $key = $line.Substring(0, $index).Trim()
  $value = $line.Substring($index + 1).Trim()
  if ($value.Length -ge 2 -and (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'")))) {
    $value = $value.Substring(1, $value.Length - 2)
  }
  Set-Item -Path "Env:$key" -Value $value
}

$databaseUrl = $env:DATABASE_URL
if ([string]::IsNullOrWhiteSpace($databaseUrl)) { throw "DATABASE_URL is missing in $envPath" }
$databaseUrl = $databaseUrl -replace '([?&])schema=[^&]*&?', '$1'
$databaseUrl = $databaseUrl -replace '[?&]$', ''

function Find-PgTool([string]$name) {
  $command = Get-Command $name -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  $installRoot = "C:\Program Files\PostgreSQL"
  if (Test-Path $installRoot) {
    $candidate = Get-ChildItem $installRoot -Directory |
      Sort-Object { try { [version]("$($_.Name).0") } catch { [version]"0.0" } } -Descending |
      ForEach-Object { Join-Path $_.FullName "bin\$name.exe" } |
      Where-Object { Test-Path $_ } |
      Select-Object -First 1
    if ($candidate) { return $candidate }
  }
  throw "$name was not found. Add the PostgreSQL bin folder to PATH or install PostgreSQL client tools."
}

$pgRestore = Find-PgTool "pg_restore"

Write-Host "[restore] dump: $dumpPath"
Write-Host "[restore] WARNING: this replaces the current local database contents."
if (-not $Force) {
  $answer = Read-Host "Type 'yes' to continue"
  if ($answer -ne "yes") { Write-Host "[restore] cancelled"; exit 1 }
}

if (-not $SkipBackup) {
  Write-Host "[restore] taking a safety backup first ..."
  & (Join-Path $PSScriptRoot "backup-local.ps1") -EnvFile $EnvFile
  if ($LASTEXITCODE -ne 0) { throw "Safety backup failed; restore aborted." }
}

& $pgRestore --dbname=$databaseUrl --clean --if-exists --no-owner --no-privileges --exit-on-error --single-transaction $dumpPath
if ($LASTEXITCODE -ne 0) { throw "pg_restore failed with exit code $LASTEXITCODE" }

Write-Host "[restore] done. Start the API with: npm run dev -w @antika/api"
