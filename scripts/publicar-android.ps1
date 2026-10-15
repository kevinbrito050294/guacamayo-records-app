$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$gradleFile = Join-Path $root 'android\app\build.gradle'
$manifestFile = Join-Path $root 'android-update-nuevo.json'
$keystore = $env:GUACAMAYO_KEYSTORE_FILE

if (-not $keystore) { throw 'Falta GUACAMAYO_KEYSTORE_FILE.' }
if (-not $env:GUACAMAYO_KEYSTORE_PASSWORD) { throw 'Falta GUACAMAYO_KEYSTORE_PASSWORD.' }
if (-not $env:GUACAMAYO_KEY_ALIAS) { throw 'Falta GUACAMAYO_KEY_ALIAS.' }
if (-not (Test-Path -LiteralPath $keystore)) { throw "No existe la keystore: $keystore" }

$gradle = [IO.File]::ReadAllText($gradleFile)
$codeMatch = [regex]::Match($gradle, 'versionCode\s+(\d+)')
$nameMatch = [regex]::Match($gradle, 'versionName\s+"([^"]+)"')
if (-not $codeMatch.Success -or -not $nameMatch.Success) { throw 'No se pudo leer la versión Android.' }

$nextCode = [int]$codeMatch.Groups[1].Value + 1
$parts = $nameMatch.Groups[1].Value.Split('.')
$nextName = if ($parts.Count -gt 1) { "$($parts[0]).$([int]$parts[1] + 1)" } else { "$($parts[0]).1" }
$gradle = [regex]::Replace($gradle, 'versionCode\s+\d+', "versionCode $nextCode", 1)
$gradle = [regex]::Replace($gradle, 'versionName\s+"[^"]+"', "versionName `"$nextName`"", 1)
[IO.File]::WriteAllText($gradleFile, $gradle, [Text.UTF8Encoding]::new($false))

$manifest = [IO.File]::ReadAllText($manifestFile) | ConvertFrom-Json
$manifest.versionCode = $nextCode
$manifest.versionName = $nextName
$manifestJson = $manifest | ConvertTo-Json
[IO.File]::WriteAllText($manifestFile, "$manifestJson`n", [Text.UTF8Encoding]::new($false))

Push-Location $root
try {
  npm run build
  npm run mobile:sync
  $env:GUACAMAYO_KEYSTORE_FILE = (Resolve-Path -LiteralPath $keystore).Path
  Push-Location 'android'
  try { & '.\gradlew.bat' assembleRelease } finally { Pop-Location }

  $apk = Join-Path $root 'android\app\build\outputs\apk\release\app-release.apk'
  if (-not (Test-Path -LiteralPath $apk)) { throw 'Gradle no generó el APK release.' }
  $downloadsDir = Join-Path $root 'downloads'
  if (-not (Test-Path -LiteralPath $downloadsDir)) { New-Item -ItemType Directory -Path $downloadsDir | Out-Null }
  Copy-Item -LiteralPath $apk -Destination (Join-Path $downloadsDir 'guacamayo-admin.apk') -Force

  $remote = (git config --get remote.origin.url).TrimEnd('.git')
  if ($remote -notmatch 'github\.com[/:](.+)/(.+)$') { throw 'El remoto no es GitHub.' }
  $repo = "$($Matches[1])/$($Matches[2])"

  $oldSha = gh api "repos/$repo/contents/downloads/guacamayo-admin.apk?ref=main" --jq '.sha'
  $apkPayload = @{ message = "release: APK Android $nextName"; content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($apk)); sha = $oldSha; branch = 'main' } | ConvertTo-Json -Compress
  $apkPayload | gh api "repos/$repo/contents/downloads/guacamayo-admin.apk" --method PUT --input - | Out-Null

  $manifestSha = gh api "repos/$repo/contents/android-update-nuevo.json?ref=main" --jq '.sha'
  $manifestPayload = @{ message = "release: manifiesto Android $nextName"; content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($manifestFile)); sha = $manifestSha; branch = 'main' } | ConvertTo-Json -Compress
  $manifestPayload | gh api "repos/$repo/contents/android-update-nuevo.json" --method PUT --input - | Out-Null

  $publicManifest = Invoke-RestMethod "$($manifest.apkUrl)?version=$nextCode"
  $temp = Join-Path $env:TEMP "guacamayo-admin-$nextCode.apk"
  Invoke-WebRequest "$($manifest.apkUrl)?version=$nextCode" -OutFile $temp -UseBasicParsing
  $localHash = (Get-FileHash $apk -Algorithm SHA256).Hash
  $publicHash = (Get-FileHash $temp -Algorithm SHA256).Hash
  Remove-Item -LiteralPath $temp -Force
  if ([int]$publicManifest.versionCode -ne $nextCode -or $publicHash.ToUpperInvariant() -ne $localHash.ToUpperInvariant()) { throw 'La verificación pública no coincide con el APK generado.' }
  Write-Output "APK publicado: versionCode=$nextCode versionName=$nextName hash=$localHash"
} finally {
  Pop-Location
}
