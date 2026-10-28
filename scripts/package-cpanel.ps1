# scripts/package-cpanel.ps1
$ErrorActionPreference = "Stop"
$rootDir = (Get-Item $PSScriptRoot).Parent.FullName
$stagingDir = Join-Path $rootDir "cpanel-deploy"
$zipPath = Join-Path $rootDir "dotcolor-cpanel-fullstack.zip"

if (Test-Path $stagingDir) {
    Remove-Item $stagingDir -Recurse -Force
}
New-Item -ItemType Directory -Path $stagingDir | Out-Null

Write-Host "Copying fresh build artifacts to staging..."
Copy-Item (Join-Path $rootDir "dist") (Join-Path $stagingDir "dist") -Recurse -Force
Copy-Item (Join-Path $rootDir "src") (Join-Path $stagingDir "src") -Recurse -Force
Copy-Item (Join-Path $rootDir "public") (Join-Path $stagingDir "public") -Recurse -Force
Copy-Item (Join-Path $rootDir "scripts") (Join-Path $stagingDir "scripts") -Recurse -Force
Copy-Item (Join-Path $rootDir "server.js") (Join-Path $stagingDir "server.js") -Force
Copy-Item (Join-Path $rootDir "server.ts") (Join-Path $stagingDir "server.ts") -Force
Copy-Item (Join-Path $rootDir "app.js") (Join-Path $stagingDir "app.js") -Force
Copy-Item (Join-Path $rootDir ".env") (Join-Path $stagingDir ".env") -Force

# Create production package.json for cPanel Node.js App
$prodPkg = @{
    name = "dotcolor-pos-erp"
    version = "1.0.0"
    private = $true
    type = "module"
    main = "server.js"
    scripts = @{
        start = "node server.js"
    }
    dependencies = @{
        cors = "^2.8.6"
        dotenv = "^17.2.3"
        express = "^4.21.2"
        mongoose = "^9.10.2"
    }
}
$prodPkg | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $stagingDir "package.json") -Encoding utf8

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
$items = Get-ChildItem -Path $stagingDir -Recurse -Force | Where-Object { -not $_.PSIsContainer }

foreach ($item in $items) {
    $relPath = $item.FullName.Substring($stagingDir.Length + 1).Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $item.FullName, $relPath, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
}

$zip.Dispose()
Remove-Item $stagingDir -Recurse -Force

Write-Host "Successfully packaged cPanel deployment zip at $zipPath"
Get-Item $zipPath | Select-Object Name, Length, LastWriteTime
