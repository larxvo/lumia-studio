"""Vendor verified ONNX cutout weights as bounded, same-origin assets."""
import hashlib
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
source = Path(sys.argv[1])
records = json.loads((source / 'records.json').read_text())
assets = root / 'dist/ai'
manifest = {'version': 1, 'models': {}}
for record in records:
    name = Path(record['file']).stem
    data = (source / record['file']).read_bytes()
    assert len(data) == record['bytes'] and hashlib.sha256(data).hexdigest() == record['sha256']
    if name == 'matting':
        assert record['sha256'] == '07c308cf0fc7e6e8b2065a12ed7fc07e1de8febb7dc7839d7b7f15dd66584df9'
    if name == 'saliency':
        assert hashlib.md5(data).hexdigest() == '8e83ca70e441ab06c318d82300c84806'
    parts = []
    for start in range(0, len(data), 16 * 1024 * 1024):
        block = data[start:start + 16 * 1024 * 1024]
        filename = f'{name}.part{len(parts) + 1}'
        (assets / filename).write_bytes(block)
        parts.append({'file': filename, 'bytes': len(block), 'sha256': hashlib.sha256(block).hexdigest()})
    manifest['models'][name] = {'bytes': len(data), 'sha256': record['sha256'], 'source': record['source'], 'parts': parts}
(assets / 'cutout-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('Vendored', len(records), 'cutout models,', sum(x['bytes'] for x in records), 'bytes; each asset <=16 MiB')
