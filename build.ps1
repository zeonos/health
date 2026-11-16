param(
    [Parameter(Mandatory = $true)][string]$PlatformJar,
    [Parameter(Mandatory = $true)][string]$BuildTools,
    [Parameter(Mandatory = $true)][string]$R8Jar,
    [string]$JavaBin = '',
    [string]$Output = 'build/Min-Dag.apk'
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

function Run([string]$Program, [string[]]$Arguments) {
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program returned $LASTEXITCODE." }
}

$PlatformJar = (Resolve-Path -LiteralPath $PlatformJar).Path
$BuildTools = (Resolve-Path -LiteralPath $BuildTools).Path
$R8Jar = (Resolve-Path -LiteralPath $R8Jar).Path
$javac = if ($JavaBin) { Join-Path $JavaBin 'javac.exe' } else { 'javac.exe' }
$keytool = if ($JavaBin) { Join-Path $JavaBin 'keytool.exe' } else { 'keytool.exe' }
$jar = if ($JavaBin) { Join-Path $JavaBin 'jar.exe' } else { 'jar.exe' }
$java = if ($JavaBin) { Join-Path $JavaBin 'java.exe' } else { 'java.exe' }
$env:JAVA_HOME = Split-Path -Parent (Split-Path -Parent (Get-Command $javac).Source)
$build = New-Item -ItemType Directory -Force (Join-Path $PSScriptRoot 'build')
$appAssets = New-Item -ItemType Directory -Force (Join-Path $build.FullName 'app-assets')
$classes = New-Item -ItemType Directory -Force (Join-Path $build.FullName 'classes')
$dex = New-Item -ItemType Directory -Force (Join-Path $build.FullName 'dex')
$res = Join-Path $build.FullName 'resources.zip'
$code = Join-Path $build.FullName 'code.jar'
$unsigned = Join-Path $build.FullName 'unsigned.apk'
$aligned = Join-Path $build.FullName 'aligned.apk'
$signingKey = Join-Path $build.FullName 'min-dag-local.jks'

# Embed the PNGs in the script so the WebView does not need to fetch each icon.
Get-ChildItem -LiteralPath 'assets' -File | Copy-Item -Destination $appAssets.FullName -Force
$faceImages = @(1..10 | ForEach-Object {
    $face = Resolve-Path -LiteralPath "assets/faces/$_.png"
    'data:image/png;base64,' + [Convert]::ToBase64String([IO.File]::ReadAllBytes($face.Path))
})
$prelude = 'window.MinDagFaceImages = ' + (ConvertTo-Json -InputObject $faceImages -Compress) + ";`n"
$appScript = Join-Path $appAssets.FullName 'app.js'
[IO.File]::WriteAllText($appScript, ($prelude + [IO.File]::ReadAllText($appScript)))

$aapt = Join-Path $BuildTools 'aapt2.exe'
Run $aapt @('compile','--dir','res','-o',$res)
Run $aapt @('link','-I',$PlatformJar,'--manifest','AndroidManifest.xml','-A',$appAssets.FullName,'-o',$unsigned,$res)
$sources = @(Get-ChildItem -LiteralPath 'src' -Recurse -Filter '*.java' | ForEach-Object FullName)
$javacArguments = @('-encoding','UTF-8','--release','8','-classpath',$PlatformJar,'-d',$classes.FullName) + $sources
Run $javac $javacArguments
Run $jar @('--create','--file',$code,'-C',$classes.FullName,'.')
Run $java @('-cp',$R8Jar,'com.android.tools.r8.D8','--release','--min-api','26','--lib',$PlatformJar,'--output',$dex.FullName,$code)

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::Open($unsigned,[IO.Compression.ZipArchiveMode]::Update)
try {
    foreach ($file in (Get-ChildItem -LiteralPath $dex.FullName -Filter 'classes*.dex')) {
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$file.FullName,$file.Name) | Out-Null
    }
} finally { $archive.Dispose() }

Run (Join-Path $BuildTools 'zipalign.exe') @('-f','4',$unsigned,$aligned)
if (!(Test-Path -LiteralPath $signingKey)) {
    Run $keytool @('-genkeypair','-storetype','PKCS12','-keystore',$signingKey,'-storepass','android','-alias','mindag-local',
        '-keyalg','RSA','-keysize','2048','-validity','10000','-dname','CN=Min Dag Local Build')
}
$signer = Join-Path $BuildTools 'apksigner.bat'
Run $signer @('sign','--ks',$signingKey,'--ks-pass','pass:android','--out',$Output,$aligned)
Run $signer @('verify','--verbose','--min-sdk-version','26',$Output)
Write-Output (Resolve-Path -LiteralPath $Output).Path
