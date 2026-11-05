"""One-time verified migration of the owner's published 9.0 source into GitHub.
Existing reviewed repository files take precedence. This never imports hosting identity or secrets.
"""
from __future__ import annotations
import hashlib, io, json, re, stat, sys, urllib.request, urllib.error, zipfile
from pathlib import Path, PurePosixPath

ORIGIN = 'https://luma-photo-studio.tuhaotp.chatgpt.site/'
MANIFEST_SHA256 = '333ee131968d25e01572f271e951b4aed29e816375f90bfc851e3f573e7c2b9a'

def open_source(relative, timeout):
    request=urllib.request.Request(ORIGIN+relative,headers={'User-Agent':'Luma-Studio-Repository-Import/9.0 (https://github.com/larxvo/lumia-studio)'})
    try: return urllib.request.urlopen(request,timeout=timeout)
    except urllib.error.HTTPError as error:
        print('Source transfer failed:',error.code,error.headers.get('Content-Type'),error.read(500).decode('utf-8','replace'))
        raise

def download(relative, size, digest):
    if not re.fullmatch(r'[A-Za-z0-9._/-]+', relative) or '..' in PurePosixPath(relative).parts:
        raise ValueError('Invalid asset path')
    with open_source(relative,120) as response:
        data = response.read(size + 1)
    if len(data) != size or hashlib.sha256(data).hexdigest() != digest:
        raise ValueError('Asset integrity mismatch: ' + relative)
    return data

def main():
    root = Path.cwd()
    if (root / 'package.json').exists():
        print('Source already present; migration skipped.'); return
    with open_source('assets/source-manifest.json',60) as response:
        manifest_bytes = response.read(1024*1024)
    if hashlib.sha256(manifest_bytes).hexdigest() != MANIFEST_SHA256:
        raise ValueError('Published source changed; refusing an unreviewed import.')
    manifest = json.loads(manifest_bytes)
    if manifest.get('layout') != 'shared-assets-v1': raise ValueError('Unknown layout')
    data = b''.join(download('assets/' + p['file'], p['bytes'], p['sha256']) for p in manifest['parts'])
    if len(data) != manifest['bytes']: raise ValueError('Code archive length mismatch')
    count = 0
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        if archive.testzip(): raise ValueError('Source ZIP CRC mismatch')
        for entry in archive.infolist():
            if entry.is_dir(): continue
            parts = PurePosixPath(entry.filename).parts
            if not parts or parts[0] != 'luma-studio' or any(x in ('..','.git','.github','.openai','node_modules','releases') or x.startswith('.env') for x in parts):
                raise ValueError('Disallowed source entry')
            if stat.S_ISLNK(entry.external_attr >> 16): raise ValueError('Symlink not allowed')
            target = root.joinpath(*parts[1:])
            if target.exists(): continue
            target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes(archive.read(entry)); count += 1
    for asset in manifest['assets']:
        rel = asset['asset']; parts = PurePosixPath(asset['path']).parts
        if parts[:2] != ('luma-studio','dist') or parts[2:] != PurePosixPath(rel).parts or '..' in parts:
            raise ValueError('Invalid model mapping')
        target = root.joinpath(*parts[1:]); target.parent.mkdir(parents=True,exist_ok=True)
        target.write_bytes(download(rel,asset['bytes'],asset['sha256'])); count += 1
    # The first GitHub release is a packaging/documentation patch over the checked 9.0 editor.
    version = '9.0.1'
    package_path = root/'package.json'; package=json.loads(package_path.read_text())
    package.update(version=version,description='Free local-first photo and design editor by Larx Vo',
                   author={'name':'Larx Vo','url':'https://vovinhlac.com'},license='MIT',
                   homepage='https://github.com/larxvo/lumia-studio',repository={'type':'git','url':'https://github.com/larxvo/lumia-studio.git'},
                   bugs={'url':'https://github.com/larxvo/lumia-studio/issues'},engines={'node':'>=24 <25'})
    package_path.write_text(json.dumps(package,indent=2)+'\n')
    lock_path=root/'package-lock.json'; lock=json.loads(lock_path.read_text()); lock['version']=version;lock['packages']['']['version']=version
    lock['packages']['']['license']='MIT';lock['packages']['']['engines']=package['engines'];lock_path.write_text(json.dumps(lock,indent=2)+'\n')
    for name in ('desktop/app/package.json','desktop/app/main.cjs','desktop/app/preload.cjs','dist/app.js','dist/index.html'):
        p=root/name;p.write_text(p.read_text().replace('9.0.0','9.0.1'))
    p=root/'dist/app.js'; text=p.read_text(); marker='source: async () => {\n'
    if marker not in text: raise ValueError('Source action changed')
    text=text.replace(marker,marker+'    if(window.lumaDesktop){window.open("https://github.com/larxvo/lumia-studio/releases/latest","_blank","noopener");return;}\n',1);p.write_text(text)
    p=root/'scripts/package-source.py'; text=p.read_text(); start=text.index('files = [root / p for p in ('); end=text.index('\nfor directory in ',start)
    text=text[:start]+"files = [p for p in root.iterdir() if p.is_file() and (p.suffix == '.md' or p.name in ('package.json','package-lock.json','LICENSE','.gitignore','.gitattributes','.editorconfig'))]"+text[end:]
    text=text.replace("'qa', 'desktop'","'qa', 'desktop', 'docs', '.github'");p.write_text(text)
    p=root/'QA.md';p.write_text('# Luma Studio 9.0.1 — GitHub distribution\n\nCurrent validation is recorded by GitHub CI and release reports. Historical results below retain their original version scope. Windows packaging smoke tests do not establish every interactive workflow, live Canva access or physical-GPU image quality.\n\n---\n\n'+p.read_text())
    print(json.dumps({'imported_files':count,'version':version,'source_manifest_sha256':MANIFEST_SHA256}))

if __name__ == '__main__': main()
