param(
    [string]$Destination = $env:GUACAMAYO_BACKUP_DIR,
    [int]$Keep = 20
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $Destination) { $Destination = Join-Path $HOME 'Backups\guacamayo-records' }
if (-not (Test-Path -LiteralPath $Destination)) {
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $Destination $stamp
New-Item -ItemType Directory -Path $backup -Force | Out-Null

function Copy-Critico([string]$relativePath) {
    $source = Join-Path $root $relativePath
    if (-not (Test-Path -LiteralPath $source)) { return }
    $target = Join-Path $backup $relativePath
    $parent = Split-Path -Parent $target
    if (-not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    Copy-Item -LiteralPath $source -Destination $target -Force
}

foreach ($path in @(
    'AGENTS.md',
    'ESTADO_PRODUCCION_LOCAL.md',
    'PLAN_SIGUIENTE_SESION.md',
    'package.json',
    'package-lock.json',
    'capacitor.config.ts',
    'server.js',
    'auth.js',
    'android-update.json',
    'android-update-nuevo.json',
    'downloads\guacamayo-admin.apk',
    'android\app\build.gradle',
    'android\app\src\main\AndroidManifest.xml',
    'android\app\src\main\java\com\guacamayorecords\admin\MainActivity.java',
    'android\app\src\main\java\com\guacamayorecords\admin\GuacamayoMessagingService.java',
    'android\app\google-services.json',
    'android\app\guacamayo-release-2026.jks'
)) { Copy-Critico $path }

foreach ($directory in @('src', 'android\app\src\main\res', 'db\migrations', 'scripts')) {
    $source = Join-Path $root $directory
    if (Test-Path -LiteralPath $source) {
        $target = Join-Path $backup $directory
        $parent = Split-Path -Parent $target
        if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
        Copy-Item -LiteralPath $source -Destination $target -Recurse -Force
    }
}

git -C $root status --short | Set-Content -LiteralPath (Join-Path $backup 'git-status.txt')
git -C $root diff --binary | Set-Content -LiteralPath (Join-Path $backup 'working-tree.patch')

$hashes = Get-ChildItem -LiteralPath $backup -File -Recurse | Get-FileHash -Algorithm SHA256 | ForEach-Object {
    [pscustomobject]@{ path = $_.Path.Substring($backup.Length + 1); sha256 = $_.Hash }
}
$hashes | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $backup 'SHA256.json')

$old = Get-ChildItem -LiteralPath $Destination -Directory | Sort-Object Name -Descending | Select-Object -Skip $Keep
if ($old) { $old | Remove-Item -Recurse -Force }
Write-Output "Backup critico creado en $backup"
