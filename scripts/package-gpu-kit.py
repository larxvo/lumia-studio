"""Small install kit only; model/runtime/user reports are never bundled."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root = Path(__file__).resolve().parent.parent
target = root / 'dist/assets/luma-local-gpu-kit.zip'
with ZipFile(target, 'w', ZIP_DEFLATED, compresslevel=8) as z:
    for path in sorted((root / 'gpu-kit').glob('*')):
        if path.is_file() and path.suffix in ('.py', '.ps1', '.txt', '.md'):
            z.write(path, 'luma-local-gpu/' + path.name)
    z.write(root / 'LICENSE', 'luma-local-gpu/LICENSE')
print(str(target) + ': ' + str(target.stat().st_size) + ' bytes')
