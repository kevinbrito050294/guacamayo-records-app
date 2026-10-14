param(
    [switch]$Strict
)

$ErrorActionPreference = 'Stop'
$repo = 'kevinbrito050294/guacamayo-records-app'
$branch = 'main'
$criticalFiles = @(
    'server.js',
    'auth.js',
    'src/App.tsx',
    'src/components/AdminPanel.tsx',
    'src/components/Catalog.tsx',
    'src/components/Cart.tsx',
    'src/lib/contacto.ts',
    'android-update.json',
    'package.json'
)

function Get-GitHubFileSha([string]$path) {
    try {
        $encoded = [Uri]::EscapeDataString($path).Replace('%2F', '/')
        $sha = gh api "repos/$repo/contents/${encoded}?ref=$branch" --jq '.sha' 2>$null
        if ($LASTEXITCODE -ne 0) { return $null }
        return ([string]$sha).Trim()
    } catch {
        return $null
    }
}

Write-Output '== GuacamayoRecords: control de estado publicado =='

$null = gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
    throw 'GitHub CLI no está autenticado. Ejecutá gh auth login antes de continuar.'
}

$localHead = (git rev-parse HEAD).Trim()
$remoteHead = (gh api "repos/$repo/commits/$branch" --jq '.sha').Trim()
$dirty = @(git status --short)

Write-Output "Local HEAD:  $localHead"
Write-Output "GitHub HEAD: $remoteHead"
Write-Output "Working tree: $(if ($dirty.Count -eq 0) { 'limpio' } else { "$($dirty.Count) cambio(s) sin consolidar" })"

if ($localHead -ne $remoteHead) {
    Write-Warning 'Los commits local y publicado no coinciden. No asumas que uno contiene al otro.'
}

$mismatches = @()
$androidMismatch = $false
foreach ($path in $criticalFiles) {
    $localSha = (git rev-parse "HEAD:$path" 2>$null).Trim()
    $remoteSha = Get-GitHubFileSha $path
    if (-not $remoteSha) {
        $mismatches += "$path (no existe en GitHub)"
        continue
    }
    if ($localSha -ne $remoteSha) {
        $mismatches += "$path (local $localSha / GitHub $remoteSha)"
    }
}

if ($mismatches.Count -gt 0) {
    Write-Warning 'Hay archivos críticos diferentes entre HEAD local y GitHub:'
    $mismatches | ForEach-Object { Write-Output "  - $_" }
} else {
    Write-Output 'Archivos críticos: coinciden con GitHub.'
}

$localManifest = Get-Content -Raw -LiteralPath 'android-update.json' | ConvertFrom-Json
$publicManifest = Invoke-RestMethod 'https://www.guacamayorecords.com/android-update.json?estado=1'
Write-Output "Android local/publicado: $($localManifest.versionName)/$($localManifest.versionCode) / $($publicManifest.versionName)/$($publicManifest.versionCode)"
if ([string]$localManifest.versionCode -ne [string]$publicManifest.versionCode -or [string]$localManifest.versionName -ne [string]$publicManifest.versionName) {
    $androidMismatch = $true
    Write-Warning 'La versión Android local y la pública no coinciden.'
}

$html = (Invoke-WebRequest 'https://www.guacamayorecords.com/?estado=1' -UseBasicParsing).Content
$asset = [regex]::Match($html, '/assets/index-[^"'']+\.js').Value
if ($asset) { Write-Output "Bundle web público: $asset" } else { Write-Warning 'No se encontró el bundle JS público.' }

$apkTemp = Join-Path $env:TEMP "guacamayo-admin-publicado-$([guid]::NewGuid()).apk"
$apkMismatch = $false
try {
    $apkUrl = [string]$publicManifest.apkUrl
    if (-not $apkUrl.StartsWith('https://', [StringComparison]::OrdinalIgnoreCase)) {
        throw "La URL pública del APK no usa HTTPS: $apkUrl"
    }
    $apkResponse = Invoke-WebRequest "${apkUrl}?version=$($publicManifest.versionCode)" -OutFile $apkTemp -UseBasicParsing -PassThru
    $apkInfo = Get-Item -LiteralPath $apkTemp
    if ($apkResponse.StatusCode -ne 200) { throw "El APK público respondió HTTP $($apkResponse.StatusCode)" }
    if ($apkInfo.Length -le 0) { throw 'El APK público está vacío.' }
    if ($apkResponse.Headers['Content-Type'] -notmatch 'application/vnd.android.package-archive|application/octet-stream') {
        $apkMismatch = $true
        Write-Warning "Content-Type inesperado para el APK: $($apkResponse.Headers['Content-Type'])"
    }

    $publicApkHash = (Get-FileHash -LiteralPath $apkTemp -Algorithm SHA256).Hash.ToUpperInvariant()
    Write-Output "APK público: HTTP 200 · $([math]::Round($apkInfo.Length / 1MB, 2)) MB · SHA256 $publicApkHash"

    $localApk = Join-Path (Split-Path -Parent $PSScriptRoot) 'downloads\guacamayo-admin.apk'
    if (Test-Path -LiteralPath $localApk) {
        $localApkHash = (Get-FileHash -LiteralPath $localApk -Algorithm SHA256).Hash.ToUpperInvariant()
        if ($localApkHash -ne $publicApkHash) {
            $apkMismatch = $true
            Write-Warning "El APK local y el público no coinciden: local $localApkHash / público $publicApkHash"
        } else {
            Write-Output 'APK local/público: hash coincidente.'
        }
    } else {
        Write-Warning 'No existe downloads\guacamayo-admin.apk local para comparar el hash.'
    }

    $apksigner = Get-Command apksigner -ErrorAction SilentlyContinue
    if ($apksigner) {
        & $apksigner.Source verify --verbose $apkTemp | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'apksigner rechazó la firma del APK público.' }
        Write-Output 'Firma APK: apksigner verify correcto.'
    } else {
        Write-Warning 'apksigner no está disponible; se verificó descarga/hash, pero no la firma.'
    }
} finally {
    Remove-Item -LiteralPath $apkTemp -Force -ErrorAction SilentlyContinue
}

if ($Strict -and ($localHead -ne $remoteHead -or $dirty.Count -gt 0 -or $mismatches.Count -gt 0 -or $androidMismatch -or $apkMismatch)) {
    exit 2
}

Write-Output 'Control finalizado. Revisá las advertencias antes de leer o modificar código.'
