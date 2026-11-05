[CmdletBinding()]
param([string]$PortablePath = '', [switch]$Research)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$runtime = Join-Path $root 'runtime'
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
if (-not [Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { throw 'Bo cai nay danh cho Windows x64 + NVIDIA. Khong tu cai ban khac kien truc.' }
$smi = Get-Command nvidia-smi.exe -ErrorAction SilentlyContinue
if (-not $smi) { throw 'Chua tim thay NVIDIA driver (nvidia-smi). Cai / cap nhat driver tu nvidia.com, khoi dong lai va thu lai.' }
$cards = & $smi.Source --query-gpu=name,memory.total,driver_version,compute_cap --format=csv,noheader,nounits 2>$null
if ($LASTEXITCODE -ne 0 -or -not $cards) { throw 'Khong doc duoc GPU / compute capability. Cap nhat driver hoac chon ComfyUI Portable thu cong.' }
Write-Host "NVIDIA: $cards"
$first = ($cards | Select-Object -First 1).Split(',')
$capability = 0.0
if (-not [double]::TryParse($first[-1].Trim(), [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$capability)) { throw 'Khong xac dinh duoc compute capability.' }
$download = Join-Path $runtime 'downloads'
New-Item -ItemType Directory -Path $download -Force | Out-Null
if (-not $PortablePath) {
    $portable = Join-Path $runtime 'ComfyUI_windows_portable'
    if (-not (Test-Path (Join-Path $portable 'python_embeded/python.exe'))) {
        $sevenZip = Get-Command 7z.exe -ErrorAction SilentlyContinue
        $sevenZipPath = if ($sevenZip) { $sevenZip.Source } else { Join-Path $env:ProgramFiles '7-Zip/7z.exe' }
        if (-not (Test-Path $sevenZipPath)) { throw 'Cai 7-Zip tu https://www.7-zip.org/ roi chay lai. Bo cai khong thay doi execution policy hoac tu cai driver.' }
        $release = Invoke-RestMethod -Uri 'https://api.github.com/repos/Comfy-Org/ComfyUI/releases/latest' -Headers @{ 'User-Agent' = 'Luma-Local-GPU-Setup' }
        $pattern = if ($capability -lt 7) { '^ComfyUI_windows_portable_nvidia_cu126\.7z$' } else { '^ComfyUI_windows_portable_nvidia\.7z$' }
        $asset = @($release.assets | Where-Object { $_.name -match $pattern })
        if ($asset.Count -ne 1 -or $asset[0].digest -notmatch '^sha256:[0-9a-f]{64}$') { throw 'Khong co goi portable / SHA-256 phu hop trong release chinh thuc. Tai goi phu hop tu docs.comfy.org/installation/comfyui_portable_windows va dung -PortablePath.' }
        $asset = $asset[0]
        if ($asset.browser_download_url -notmatch '^https://github\.com/Comfy-Org/ComfyUI/releases/download/') { throw 'Nguon portable khong hop le.' }
        $archive = Join-Path $download $asset.name
        Write-Host "Dang tai ComfyUI $($release.tag_name). Tep lon, co the mat nhieu phut."
        Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $archive -UseBasicParsing
        if ((Get-FileHash -Algorithm SHA256 $archive).Hash.ToLowerInvariant() -ne $asset.digest.Substring(7)) { throw 'SHA-256 ComfyUI khong khop. Khong giai nen / chay.' }
        & $sevenZipPath x $archive "-o$runtime" -y
        if ($LASTEXITCODE -ne 0) { throw 'Giai nen ComfyUI that bai.' }
    }
} else { $portable = (Resolve-Path $PortablePath).Path }
$python = Join-Path $portable 'python_embeded/python.exe'
if (-not (Test-Path $python) -or -not (Test-Path (Join-Path $portable 'ComfyUI/main.py'))) { throw 'PortablePath phai tro vao ComfyUI_windows_portable, co python_embeded va ComfyUI/main.py.' }
# CUDA check is a real computation; a CPU-only environment never receives a pass.
$proof = & $python -s -c "import sys;sys.path.insert(0,sys.argv[1]);import research_core,json;print(json.dumps(research_core.cuda_proof(),indent=2))" $root
if ($LASTEXITCODE -ne 0) { throw 'CUDA khong vuot phep tinh kiem chung. Khong chuyen sang CPU. Kiem tra driver va goi cu126/cu130.' }
$proof | Set-Content (Join-Path $runtime 'cuda-proof.json') -Encoding UTF8
Write-Host ($proof -join [Environment]::NewLine)

$origin = 'https://luma-photo-studio.tuhaotp.chatgpt.site'
$manifest = Invoke-RestMethod -Uri "$origin/assets/source-manifest.json"
if ($manifest.filename -notmatch '^luma-studio-[0-9.]+-source\.zip$' -or $manifest.parts.Count -lt 1 -or $manifest.parts.Count -gt 16 -or $manifest.bytes -gt 268435456) { throw 'Manifest Luma khong hop le.' }
$zipPath = Join-Path $download $manifest.filename
$output = [IO.File]::Open($zipPath, [IO.FileMode]::Create, [IO.FileAccess]::Write)
try {
    $total = 0L
    foreach ($part in $manifest.parts) {
        if ($part.file -notmatch '^luma-source\.part([1-9]|1[0-6])$' -or $part.bytes -lt 1 -or $part.bytes -gt 16777216 -or $part.sha256 -notmatch '^[0-9a-f]{64}$') { throw 'Source part khong hop le.' }
        $partPath = Join-Path $download $part.file
        Write-Host "Dang tai ma nguon $($part.file)..."
        Invoke-WebRequest -Uri "$origin/assets/$($part.file)" -OutFile $partPath -UseBasicParsing
        if ((Get-Item $partPath).Length -ne $part.bytes -or (Get-FileHash -Algorithm SHA256 $partPath).Hash.ToLowerInvariant() -ne $part.sha256) { throw 'Source part bi loi / khong dung SHA-256.' }
        $inputStream = [IO.File]::OpenRead($partPath)
        try { $inputStream.CopyTo($output) } finally { $inputStream.Dispose() }
        $total += $part.bytes
    }
    if ($total -ne $manifest.bytes) { throw 'Tong kich thuoc source ZIP khong khop.' }
} finally { $output.Dispose() }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$versionRoot = Join-Path $runtime ($manifest.filename -replace '-source\.zip$', '')
if (-not (Test-Path $versionRoot)) {
    $zip = [IO.Compression.ZipFile]::OpenRead($zipPath)
    try {
        foreach ($entry in $zip.Entries) {
            $destination = [IO.Path]::GetFullPath((Join-Path $versionRoot $entry.FullName))
            if (-not $destination.StartsWith([IO.Path]::GetFullPath($versionRoot) + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'ZIP path khong hop le.' }
        }
    } finally { $zip.Dispose() }
    [IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $versionRoot)
}
$editor = Join-Path $versionRoot 'luma-studio'
if ($manifest.layout -and $manifest.layout -ne 'shared-assets-v1') { throw 'Source layout chua duoc ho tro.' }
if ($manifest.layout -eq 'shared-assets-v1') {
    if ($manifest.assets.Count -gt 64) { throw 'Qua nhieu source assets.' }
    $assetTotal = 0L
    foreach ($shared in $manifest.assets) {
        if ($shared.asset -notmatch '^(ai|vendor)/[a-zA-Z0-9._/-]+$' -or $shared.asset -match '(^|/)\.{1,2}(/|$)' -or $shared.path -ne ('luma-studio/dist/' + $shared.asset) -or $shared.bytes -lt 1 -or $shared.bytes -gt 16777216 -or $shared.sha256 -notmatch '^[a-f0-9]{64}$') { throw 'Source asset khong hop le.' }
        $assetTotal += $shared.bytes
        if ($assetTotal -gt 268435456) { throw 'Source assets vuot gioi han.' }
        $assetPath = [IO.Path]::GetFullPath((Join-Path (Join-Path $editor 'dist') $shared.asset))
        if (-not $assetPath.StartsWith([IO.Path]::GetFullPath((Join-Path $editor 'dist')) + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Asset path khong hop le.' }
        if ((Test-Path $assetPath) -and (Get-Item $assetPath).Length -eq $shared.bytes -and (Get-FileHash -Algorithm SHA256 $assetPath).Hash.ToLowerInvariant() -eq $shared.sha256) { continue }
        New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($assetPath)) -Force | Out-Null
        Write-Host "Dang tai model / runtime $($shared.asset)..."
        Invoke-WebRequest -Uri "$origin/$($shared.asset)" -OutFile $assetPath -UseBasicParsing
        if ((Get-Item $assetPath).Length -ne $shared.bytes -or (Get-FileHash -Algorithm SHA256 $assetPath).Hash.ToLowerInvariant() -ne $shared.sha256) { throw 'Source asset SHA-256 khong khop.' }
    }
}
if (-not (Test-Path (Join-Path $editor 'dist/local-runtime.js'))) { throw 'Ma nguon web chua co Local GPU 6.1. Cho ban phat hanh 6.1 duoc dua len trang roi chay lai.' }
# Restore the verified source download parts for offline self-hosting.
Copy-Item (Join-Path $download 'luma-source.part*') (Join-Path $editor 'dist/assets') -Force
$manifest | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $editor 'dist/assets/source-manifest.json') -Encoding UTF8
$deps = Join-Path $runtime 'research-deps'
if ($Research) {
    New-Item -ItemType Directory -Path $deps -Force | Out-Null
    & $python -s -m pip install --target $deps -r (Join-Path $root 'requirements-research.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Cai thu vien nghien cuu that bai. ComfyUI goc khong bi sua.' }
}
@{ portable = $portable; editor = $editor; deps = $deps; researchInstalled = [bool](Test-Path (Join-Path $deps 'transformers')) } | ConvertTo-Json | Set-Content (Join-Path $runtime 'config.json') -Encoding UTF8
Write-Host 'Da chuan bi xong. Dat checkpoint SD / SDXL .safetensors ban co quyen su dung vao ComfyUI/models/checkpoints.'
Write-Host 'Chay Start-Luma.ps1 de mo ung dung local. Khong co model benh da / checkpoint sinh anh duoc tu tai hoac tu chap nhan dieu khoan.'
