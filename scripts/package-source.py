"""Create a complete self-hostable ZIP and bounded public download parts."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
import json
import re

root = Path(__file__).resolve().parent.parent
assets = root / 'dist/assets'
version = json.loads((root / 'package.json').read_text())['version']
target = root / 'releases' / f'luma-studio-{version}-source.zip'
target.parent.mkdir(exist_ok=True)
# Generated download files cannot recursively contain themselves.
(assets / 'luma-studio-source.zip').unlink(missing_ok=True)
for old in assets.glob('luma-source.part*'):
    old.unlink()
manifest_path = assets / 'source-manifest.json'
manifest_path.unlink(missing_ok=True)
files = [p for p in root.iterdir() if p.is_file() and (p.suffix == '.md' or p.name in ('package.json','package-lock.json','LICENSE','.gitignore','.gitattributes','.editorconfig'))]
for directory in ('dist', 'src', 'scripts', 'tests', 'gpu-kit', 'qa', 'desktop', 'docs', '.github'):
    files.extend(p for p in (root / directory).rglob('*') if p.is_file() and not p.name.startswith('.') and '__pycache__' not in p.parts and 'runtime' not in p.parts)
with ZipFile(target, 'w', ZIP_DEFLATED, compresslevel=8) as archive:
    for file in sorted(set(files)):
        archive.write(file, 'luma-studio/' + file.relative_to(root).as_posix())
shared = [p for p in files if p.is_relative_to(root / 'dist/ai') and (p.suffix == '.onnx' or re.search(r'\.part\d+$', p.name)) or p.is_relative_to(root / 'dist/vendor') and p.suffix == '.wasm']
code_target = target.with_name(f'luma-studio-{version}-code.zip')
with ZipFile(code_target, 'w', ZIP_DEFLATED, compresslevel=8) as archive:
    for file in sorted(set(files) - set(shared)):
        archive.write(file, 'luma-studio/' + file.relative_to(root).as_posix())
parts = []
with code_target.open('rb') as archive:
    while data := archive.read(16 * 1024 * 1024):
        name = f'luma-source.part{len(parts) + 1}'
        (assets / name).write_bytes(data)
        parts.append({'file': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
supplements = [{'asset': p.relative_to(root / 'dist').as_posix(), 'path': 'luma-studio/' + p.relative_to(root).as_posix(), 'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(set(shared))]
manifest_path.write_text(json.dumps({'layout': 'shared-assets-v1', 'filename': target.name, 'bytes': code_target.stat().st_size, 'parts': parts, 'assets': supplements}, indent=2) + '\n')
print(f'{target}: {target.stat().st_size:,} bytes; hosted code ZIP {code_target.stat().st_size:,} bytes plus {len(supplements)} shared model/runtime assets (no duplicate models)')
