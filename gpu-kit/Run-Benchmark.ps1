[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$Checkpoint)
$ErrorActionPreference = 'Stop'
$config = Get-Content (Join-Path $PSScriptRoot 'runtime/config.json') -Raw | ConvertFrom-Json
$python = Join-Path $config.portable 'python_embeded/python.exe'
$image = Join-Path $config.editor 'dist/assets/portrait-demo.jpg'
& $python -s (Join-Path $PSScriptRoot 'benchmark.py') --image $image --checkpoint $Checkpoint --checkpoint-dir (Join-Path $config.portable 'ComfyUI/models/checkpoints') --output (Join-Path $PSScriptRoot 'runtime/reports')
if ($LASTEXITCODE -ne 0) { throw 'Bai thu chua hoan tat. Khong danh dau GPU quality da dat.' }
