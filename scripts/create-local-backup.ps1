$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$backupRoot = Join-Path (Split-Path -Parent $projectRoot) 'rock-atlas-backups'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$archivePath = Join-Path $backupRoot "rock-atlas-worktree-$stamp.zip"
$bundlePath = Join-Path $backupRoot "rock-atlas-history-$stamp.bundle"
$stagingRoot = Join-Path ([System.IO.Path]::GetTempPath()) "rock-atlas-backup-$stamp"

New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
New-Item -ItemType Directory -Force -Path $stagingRoot | Out-Null

try {
  $excludedNames = @('.git', 'node_modules', 'dist', 'rock-atlas-backups')
  Get-ChildItem -LiteralPath $projectRoot -Force |
    Where-Object { $excludedNames -notcontains $_.Name } |
    ForEach-Object {
      Copy-Item -LiteralPath $_.FullName -Destination $stagingRoot -Recurse -Force
    }

  $manifest = @(
    "ROCK ATLAS local backup"
    "Created: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss K')"
    "Project: $projectRoot"
    "Includes uncommitted files and local settings."
    "Do not upload this archive publicly because it may contain .env.local."
  )
  Set-Content -LiteralPath (Join-Path $stagingRoot 'BACKUP_INFO.txt') -Value $manifest -Encoding UTF8

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::CreateFromDirectory(
    $stagingRoot,
    $archivePath,
    [System.IO.Compression.CompressionLevel]::Optimal,
    $false
  )

  & git -C $projectRoot bundle create $bundlePath --all
  if ($LASTEXITCODE -ne 0) {
    Write-Warning 'Git history bundle creation failed. The working-copy ZIP was still created.'
  }

  Write-Host ''
  Write-Host 'ROCK ATLAS backup complete.' -ForegroundColor Green
  Write-Host "Working copy: $archivePath"
  if (Test-Path -LiteralPath $bundlePath) {
    Write-Host "Git history:  $bundlePath"
  }
  Write-Host ''
  Write-Host 'Keep both files together. The ZIP can contain private API settings, so do not upload it publicly.' -ForegroundColor Yellow
}
finally {
  $resolvedTemp = [System.IO.Path]::GetFullPath($stagingRoot)
  $resolvedSystemTemp = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
  if ($resolvedTemp.StartsWith($resolvedSystemTemp, [System.StringComparison]::OrdinalIgnoreCase) -and
      (Test-Path -LiteralPath $resolvedTemp)) {
    Remove-Item -LiteralPath $resolvedTemp -Recurse -Force
  }
}
