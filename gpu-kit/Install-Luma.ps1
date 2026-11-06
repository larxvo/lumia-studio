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

# The complete repository snapshot is distributed through versioned GitHub Releases.
$lumaRelease = Invoke-RestMethod -Uri 'https://api.github.com/repos/larxvo/lumia-studio/releases/latest' -Headers @{ 'User-Agent' = 'Luma-Local-GPU-Setup' }
$lumaAssets = @($lumaRelease.assets | Where-Object { $_.name -match '^luma-studio-[0-9]+\.[0-9]+\.[0-9]+-source\.zip$' })
if ($lumaAssets.Count -ne 1) { throw 'Chua co source ZIP day du trong GitHub Releases. Hay tai ban phat hanh chinh thuc.' }
$lumaAsset = $lumaAssets[0]
if ($lumaAsset.digest -notmatch '^sha256:[0-9a-f]{64}$' -or $lumaAsset.size -lt 1 -or $lumaAsset.size -gt 2147483647) { throw 'Source ZIP thieu SHA-256 hoac kich thuoc khong hop le.' }
if ($lumaAsset.browser_download_url -notmatch '^https://github\.com/larxvo/lumia-studio/releases/download/[^/]+/luma-studio-[0-9.]+-source\.zip$') { throw 'Nguon tai Luma khong hop le.' }
$zipPath = Join-Path $download $lumaAsset.name
Write-Host "Dang tai Luma $($lumaRelease.tag_name) tu GitHub Releases..."
Invoke-WebRequest -Uri $lumaAsset.browser_download_url -OutFile $zipPath -UseBasicParsing
$sourceHash = $lumaAsset.digest.Substring(7)
if ((Get-Item $zipPath).Length -ne $lumaAsset.size -or (Get-FileHash -Algorithm SHA256 $zipPath).Hash.ToLowerInvariant() -ne $sourceHash) { throw 'Source ZIP SHA-256 / kich thuoc khong khop. Khong giai nen / chay.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$versionRoot = Join-Path $runtime (($lumaAsset.name -replace '-source\.zip$', '') + '-' + $sourceHash.Substring(0,12))
if (-not (Test-Path $versionRoot)) {
    $zip = [IO.Compression.ZipFile]::OpenRead($zipPath)
    try {
        foreach ($entry in $zip.Entries) {
            if ($entry.FullName -notmatch '^luma-studio/' -or $entry.FullName -match '\\') { throw 'Source ZIP root khong hop le.' }
            $destination = [IO.Path]::GetFullPath((Join-Path $versionRoot $entry.FullName))
            if (-not $destination.StartsWith([IO.Path]::GetFullPath($versionRoot) + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'ZIP path khong hop le.' }
        }
    } finally { $zip.Dispose() }
    [IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $versionRoot)
}
$editor = Join-Path $versionRoot 'luma-studio'
if (-not (Test-Path (Join-Path $editor 'dist/local-runtime.js'))) { throw 'Source ZIP khong co Local GPU runtime.' }
# Generate local download bundles from the verified complete repository snapshot.
& $python -s (Join-Path $editor 'scripts/package-source.py')
if ($LASTEXITCODE -ne 0) { throw 'Khong tao duoc source download cho may local.' }
$deps = Join-Path $runtime 'research-deps'
if ($Research) {
    New-Item -ItemType Directory -Path $deps -Force | Out-Null
    & $python -s -m pip install --target $deps -r (Join-Path $root 'requirements-research.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Cai thu vien nghien cuu that bai. ComfyUI goc khong bi sua.' }
}
@{ portable = $portable; editor = $editor; deps = $deps; researchInstalled = [bool](Test-Path (Join-Path $deps 'transformers')) } | ConvertTo-Json | Set-Content (Join-Path $runtime 'config.json') -Encoding UTF8
Write-Host 'Da chuan bi xong. Dat checkpoint SD / SDXL .safetensors ban co quyen su dung vao ComfyUI/models/checkpoints.'
Write-Host 'Chay Start-Luma.ps1 de mo ung dung local. Khong co model benh da / checkpoint sinh anh duoc tu tai hoac tu chap nhan dieu khoan.'
