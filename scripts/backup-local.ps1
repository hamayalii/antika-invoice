# ---------------------------------------------------------------------------
# Antika Docs — local PostgreSQL backup (Windows PowerShell).
#
# Usage (from the repository root):
#   powershell -ExecutionPolicy Bypass -File scripts/backup-local.ps1
#   .\scripts\backup-local.ps1 -OutDir D:\antika-backups -KeepDays 30
#
# For the Docker/VPS deployment use scripts/backup.sh instead.
# ---------------------------------------------------------------------------
[CmdletBinding()]
param(
  [string]$EnvFile = ".env",
  [string]$OutDir = "backups",
  [int]$KeepDays = 14
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envPath = if ([System.IO.Path]::IsPathRooted($EnvFile)) { $EnvFile } else { Join-Path $root $EnvFile }
$outPath = if ([System.IO.Path]::IsPathRooted($OutDir)) { $OutDir } else { Join-Path $root $OutDir }

if (-not (Test-Path $envPath)) {
  throw "Env file not found: $envPath"
}

# Load simple KEY=VALUE lines from .env without overwriting the current process.
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
if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
  throw "DATABASE_URL is missing in $envPath"
}
# Prisma's ?schema=public is not a libpq parameter.
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

$pgDump = Find-PgTool "pg_dump"
New-Item -ItemType Directory -Force -Path $outPath | Out-Null

$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$target = Join-Path $outPath "antika_docs-$stamp.dump"
$temp = "$target.part"

try {
  & $pgDump --dbname=$databaseUrl --format=custom --compress=9 --no-owner --no-privileges --file=$temp
  if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE" }
  Move-Item -Force $temp $target
  $hash = (Get-FileHash -Algorithm SHA256 $target).Hash.ToLowerInvariant()
  "$hash  $(Split-Path -Leaf $target)" | Set-Content -Encoding ascii "$target.sha256"
} finally {
  if (Test-Path $temp) { Remove-Item -Force $temp }
}

Get-ChildItem $outPath -File |
  Where-Object { $_.Name -like "*.dump" -or $_.Name -like "*.dump.sha256" } |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } |
  ForEach-Object {
    Write-Host "[backup] removing old $($_.Name)"
    Remove-Item -Force $_.FullName
  }

$sizeMb = [math]::Round((Get-Item $target).Length / 1MB, 2)
Write-Host "[backup] wrote $target ($sizeMb MB)"
Write-Host "[backup] retention: $KeepDays days in $outPath"
