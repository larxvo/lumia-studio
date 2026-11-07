param([Parameter(Mandatory=$true)][string]$Installer)
$ErrorActionPreference = 'Stop'
$installRoot = Join-Path $env:RUNNER_TEMP ('Luma-Smoke-' + [guid]::NewGuid().ToString('N'))
$installerPath = (Resolve-Path $Installer).Path
$process = Start-Process -FilePath $installerPath -ArgumentList @('/S', "/D=$installRoot") -Wait -PassThru
if ($process.ExitCode -ne 0) { throw "Setup failed: $($process.ExitCode)" }
$main = Join-Path $installRoot 'Luma Studio.exe'
if (-not (Test-Path $main)) { throw 'Application was not installed.' }
$registry = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\LumaStudio'
$entry = Get-ItemProperty $registry
if ($entry.Publisher -ne 'Larx Vo' -or $entry.DisplayVersion -ne '9.1.0') { throw 'Publisher/version registry mismatch.' }
$version = (Get-Item $main).VersionInfo
if ($version.ProductName -ne 'Luma Studio') { throw 'Windows PE metadata mismatch.' }
# A user-created file must survive manifest-based application removal.
$sentinel = Join-Path $installRoot 'user-project-keep.txt'; Set-Content $sentinel 'preserve user data'
$uninstaller = Join-Path $installRoot 'Uninstall Luma Studio.exe'
Start-Process -FilePath $uninstaller -ArgumentList '/S' -Wait | Out-Null
for ($i=0; $i -lt 60; $i++) { if (-not (Test-Path $main)) { break }; Start-Sleep -Milliseconds 500 }
if (Test-Path $main) { throw 'Application was not removed within 30 seconds.' }
if (Test-Path $registry) { throw 'Removal registry key was not cleared.' }
if (-not (Test-Path $sentinel)) { throw 'Removal deleted unrelated user data.' }
$report = [ordered]@{schema='luma-windows-smoke-v1';status='passed';version='9.1.0';runner=$env:ImageOS;os=[Environment]::OSVersion.VersionString;installed=$true;uninstalled=$true;publisher='Larx Vo';unrelatedFilePreserved=$true;interactiveEditorTested=$false;gpuQualityVerified=$false;scope='Silent install/removal and metadata on a GitHub-hosted Windows VM; no interactive editing or GPU inference.'}
$report | ConvertTo-Json -Depth 5 | Set-Content 'qa/windows-9.1.0-smoke.json'
$releasePath = 'releases/windows/release.json'
$release = Get-Content $releasePath -Raw | ConvertFrom-Json
$release.nativeWindowsRuntimeTest = 'silent-install-removal-passed'
$release | ConvertTo-Json -Depth 8 | Set-Content $releasePath -Encoding utf8
# Cleanup is limited to this freshly created test directory and known sentinel.
Remove-Item $sentinel; Remove-Item $installRoot -ErrorAction SilentlyContinue
