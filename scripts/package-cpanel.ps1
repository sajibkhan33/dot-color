# scripts/package-cpanel.ps1
$ErrorActionPreference = "Stop"
$rootDir = (Get-Item $PSScriptRoot).Parent.FullName
$cpanelDir = Join-Path $rootDir "cpanel-deploy"
$zipPath = Join-Path $rootDir "deploy.zip"

Write-Host "Syncing dist and server.js to cpanel-deploy..."
if (Test-Path (Join-Path $cpanelDir "dist")) {
    Remove-Item (Join-Path $cpanelDir "dist") -Recurse -Force
}
Copy-Item (Join-Path $rootDir "dist") (Join-Path $cpanelDir "dist") -Recurse -Force
Copy-Item (Join-Path $rootDir "server.js") (Join-Path $cpanelDir "server.js") -Force

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
$items = Get-ChildItem -Path $cpanelDir -Recurse -Force | Where-Object { -not $_.PSIsContainer }

foreach ($item in $items) {
    $relPath = $item.FullName.Substring($cpanelDir.Length + 1).Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $item.FullName, $relPath, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
}

$zip.Dispose()
Write-Host "Successfully packaged deploy.zip at $zipPath"
Get-Item $zipPath | Select-Object Name, Length, LastWriteTime
