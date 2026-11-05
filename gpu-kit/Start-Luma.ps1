[CmdletBinding()]
param([string]$SkinModelDir = '')
$ErrorActionPreference = 'Stop'
$configPath = Join-Path $PSScriptRoot 'runtime/config.json'
if (-not (Test-Path $configPath)) { throw 'Chay Install-Luma.ps1 truoc.' }
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$python = Join-Path $config.portable 'python_embeded/python.exe'
$main = Join-Path $config.portable 'ComfyUI/main.py'
if (-not (Test-Path $python) -or -not (Test-Path $main)) { throw 'Khong tim thay ComfyUI Portable da cai.' }
if ($SkinModelDir -and -not $config.researchInstalled) { throw 'Cai them thu vien bang Install-Luma.ps1 -PortablePath <thu-muc-ComfyUI> -Research truoc.' }
if ($SkinModelDir -and -not (Test-Path $SkinModelDir)) { throw 'Khong tim thay thu muc MedSigLIP local.' }
$checkpoints = Join-Path $config.portable 'ComfyUI/models/checkpoints'
if (-not (Get-ChildItem $checkpoints -Filter '*.safetensors' -ErrorAction SilentlyContinue)) { Write-Warning 'Chua co checkpoint sinh anh .safetensors. Luma van mo duoc, nhung chua chay duoc bai thu ComfyUI.' }
$existing = Get-NetTCPConnection -State Listen -LocalPort 8188 -ErrorAction SilentlyContinue
if (-not $existing) {
    Start-Process -FilePath $python -WorkingDirectory $config.portable -ArgumentList @('-s', ('"' + $main + '"'), '--listen', '127.0.0.1', '--port', '8188', '--windows-standalone-build', '--disable-auto-launch')
} else { Write-Host 'Cong 8188 dang duoc dung. Tai su dung dich vu; khong dung hoac thay doi tien trinh khac.' }
$arguments = @('-s', (Join-Path $PSScriptRoot 'local_service.py'), '--dist', (Join-Path $config.editor 'dist'), '--deps', $config.deps)
if ($SkinModelDir) { $arguments += @('--model-dir', (Resolve-Path $SkinModelDir).Path) }
& $python @arguments
if ($LASTEXITCODE -ne 0) { throw 'Local service dung voi loi. Xem thong bao trong cua so nay.' }
