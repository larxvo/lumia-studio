"""Three known-image reconstruction jobs on the owner's local ComfyUI."""
from __future__ import annotations
import argparse, hashlib, io, json, math, re, time, uuid, urllib.request
from datetime import datetime, timezone
from pathlib import Path
from research_core import cuda_proof

def metrics(truth, generated, mask):
    import numpy as np
    error = truth[:, :, :3].astype('float32') - generated[:, :, :3].astype('float32')
    chosen = error[mask]
    mse = float(np.mean(chosen ** 2))
    # Region SSIM is a coarse paired-image statistic, not local-window/perceptual quality.
    a = truth[:, :, :3].astype('float64')[mask]; b = generated[:, :, :3].astype('float64')[mask]
    ma, mb = a.mean(axis=0), b.mean(axis=0)
    va, vb = a.var(axis=0), b.var(axis=0); cov = ((a-ma)*(b-mb)).mean(axis=0)
    ssim = ((2*ma*mb+6.5025)*(2*cov+58.5225))/((ma*ma+mb*mb+6.5025)*(va+vb+58.5225))
    boundary = mask & ~(np.roll(mask, 1, 0) & np.roll(mask, -1, 0) & np.roll(mask, 1, 1) & np.roll(mask, -1, 1))
    return {'maskedPixels': int(mask.sum()), 'maskedMAE': float(np.mean(np.abs(chosen))),
            'maskedRegionSSIM': float(ssim.mean()), 'boundaryMAE': float(np.abs(error[boundary]).mean()) if boundary.any() else None,
            'maskedPSNR': None if mse == 0 else 10 * math.log10(255 * 255 / mse),
            'perfectMatch': mse == 0, 'outsideChangedPixels': int(np.any(truth != generated, axis=2)[~mask].sum())}

def workflow(checkpoint, image, seed):
    return {
        '1': {'class_type': 'CheckpointLoaderSimple', 'inputs': {'ckpt_name': checkpoint}},
        '2': {'class_type': 'LoadImage', 'inputs': {'image': image}},
        '3': {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['1', 1], 'text': 'Restore the missing region of this portrait photograph. Preserve the same person, natural skin texture, lighting and photographic detail.'}},
        '4': {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['1', 1], 'text': 'text, watermark, distorted face, extra features'}},
        '5': {'class_type': 'VAEEncodeForInpaint', 'inputs': {'pixels': ['2', 0], 'vae': ['1', 2], 'mask': ['2', 1], 'grow_mask_by': 6}},
        '6': {'class_type': 'KSampler', 'inputs': {'model': ['1', 0], 'positive': ['3', 0], 'negative': ['4', 0], 'latent_image': ['5', 0], 'seed': seed, 'steps': 16, 'cfg': 6, 'sampler_name': 'euler', 'scheduler': 'normal', 'denoise': .85}},
        '7': {'class_type': 'VAEDecode', 'inputs': {'samples': ['6', 0], 'vae': ['1', 2]}},
        '8': {'class_type': 'SaveImage', 'inputs': {'images': ['7', 0], 'filename_prefix': 'LumaBenchmark'}},
    }

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--image', required=True); p.add_argument('--checkpoint', required=True)
    p.add_argument('--checkpoint-dir'); p.add_argument('--port', type=int, default=8188)
    p.add_argument('--output', default='reports'); args = p.parse_args()
    if not 1024 <= args.port <= 65535: p.error('Invalid port.')
    from PIL import Image, ImageOps
    import numpy as np
    base = f'http://127.0.0.1:{args.port}'
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *_args, **_kwargs): return None
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    def request(path, data=None, kind='application/json', binary=False):
        body = json.dumps(data).encode() if data is not None and kind == 'application/json' else data
        req = urllib.request.Request(base + path, data=body, headers={'Content-Type': kind}, method='POST' if body is not None else 'GET')
        with opener.open(req, timeout=60) as response:
            content = response.read(32*1024*1024+1)
            if len(content) > 32*1024*1024: raise RuntimeError('Response too large.')
            return content if binary else json.loads(content)
    proof = cuda_proof()
    if proof.get('status') != 'passed' or proof.get('backend') != 'cuda' or not str(proof.get('tensorDevice', '')).startswith('cuda:'):
        raise RuntimeError('Checked CUDA operation did not pass. No CPU fallback.')
    stats = request('/system_stats')
    if not any(d.get('type') == 'cuda' for d in stats.get('devices', [])):
        raise RuntimeError('ComfyUI không báo dùng CUDA. Không chứng nhận bài thử CPU là GPU.')
    models = request('/object_info/CheckpointLoaderSimple')['CheckpointLoaderSimple']['input']['required']['ckpt_name'][0]
    if args.checkpoint not in models: raise RuntimeError('Checkpoint không có trên ComfyUI.')
    checkpoint_hash = None
    if args.checkpoint_dir:
        root = Path(args.checkpoint_dir).resolve(); target = (root / args.checkpoint).resolve()
        if root not in target.parents or not target.is_file(): raise RuntimeError('Checkpoint path không hợp lệ.')
        digest = hashlib.sha256()
        with target.open('rb') as f:
            for block in iter(lambda: f.read(8*1024*1024), b''): digest.update(block)
        checkpoint_hash = digest.hexdigest()
    with Image.open(args.image) as image:
        image = ImageOps.fit(ImageOps.exif_transpose(image).convert('RGBA'), (512, 512))
    truth = np.array(image)
    output_dir = Path(args.output) / (datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:6])
    output_dir.mkdir(parents=True, exist_ok=False); image.save(output_dir / 'truth.png')
    report = {'schema': 'luma-gpu-benchmark-v2', 'status': 'running', 'computeVerified': True, 'imageQualityVerified': False, 'time': datetime.now(timezone.utc).isoformat(),
              'cudaProof': proof, 'comfyDeviceEvidence': [{'name': d.get('name'), 'type': d.get('type')} for d in stats.get('devices', [])],
              'comfyVersion': stats.get('system', {}).get('comfyui_version'), 'checkpoint': args.checkpoint,
              'checkpointSHA256': checkpoint_hash, 'inputSHA256': hashlib.sha256(truth.tobytes()).hexdigest(),
              'steps': 16, 'cfg': 6, 'denoise': .85, 'cases': [],
              'scope': 'Three synthetic damage masks on one known image. Not a validation of every photo, identity, disease, or historical truth.'}
    cases = [('small64', (218, 212, 282, 276), 731), ('large128', (192, 176, 320, 304), 732), ('tear', (246, 100, 266, 408), 733)]
    queued_id = None
    try:
        for name, (left, top, right, bottom), seed in cases:
            print(f'Running {name}, seed {seed}...', flush=True)
            mask = np.zeros((512, 512), dtype=bool); mask[top:bottom, left:right] = True
            damaged = truth.copy(); damaged[mask] = 0
            img = Image.fromarray(damaged); img.save(output_dir / f'{name}-input.png')
            buf = io.BytesIO(); img.save(buf, format='PNG')
            boundary = 'Luma' + uuid.uuid4().hex
            payload = (f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="luma-{uuid.uuid4().hex}.png"\r\nContent-Type: image/png\r\n\r\n'.encode() + buf.getvalue() + f'\r\n--{boundary}--\r\n'.encode())
            uploaded = request('/upload/image', payload, 'multipart/form-data; boundary=' + boundary)
            filename = (uploaded.get('subfolder', '') + '/' if uploaded.get('subfolder') else '') + uploaded['name']
            start = time.perf_counter()
            queued = request('/prompt', {'prompt': workflow(args.checkpoint, filename, seed), 'client_id': uuid.uuid4().hex})
            queued_id = queued.get('prompt_id')
            if not isinstance(queued_id, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,100}', queued_id): raise RuntimeError('ComfyUI từ chối workflow.')
            generated = None
            for _ in range(450):
                job = request('/history/' + queued_id).get(queued_id, {})
                if job.get('status', {}).get('status_str') == 'error': raise RuntimeError('ComfyUI xử lý thất bại.')
                outputs = job.get('outputs', {}).get('8', {}).get('images', [])
                if outputs:
                    from urllib.parse import urlencode
                    value = outputs[0]
                    binary = request('/view?' + urlencode({'filename': value['filename'], 'subfolder': value.get('subfolder', ''), 'type': value.get('type', 'output')}), binary=True)
                    with Image.open(io.BytesIO(binary)) as result:
                        if result.size != (512, 512): raise RuntimeError('Output không đúng 512 × 512.')
                        generated = np.array(result.convert('RGBA'))
                    break
                time.sleep(2)
            if generated is None: raise RuntimeError('ComfyUI chưa xong sau 15 phút.')
            composed = truth.copy(); composed[mask] = generated[mask]
            Image.fromarray(generated).save(output_dir / f'{name}-raw.png')
            Image.fromarray(composed).save(output_dir / f'{name}-composed.png')
            report['cases'].append({'name': name, 'maskBounds': [left, top, right, bottom], 'seed': seed,
                                    'promptId': queued_id, 'elapsedSeconds': time.perf_counter()-start,
                                    'rawMetrics': metrics(truth, generated, mask), 'composedMetrics': metrics(truth, composed, mask),
                                    'outputSHA256': hashlib.sha256(composed.tobytes()).hexdigest(),
                                    'manualReview': {'identity': 'not-reviewed', 'anatomy': 'not-reviewed', 'seam': 'not-reviewed'}})
            queued_id = None
            (output_dir / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
        report['status'] = 'gpu-executed-review-required'
        (output_dir / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
        # Static, offline visual review; paths are fixed local generated names.
        rows = ''.join('<section><h2>'+name+'</h2><div>' + ''.join('<figure><img src="'+filename+'"><figcaption>'+label+'</figcaption></figure>' for filename,label in [('truth.png','Known source'),(name+'-input.png','Damaged input'),(name+'-raw.png','Raw model output'),(name+'-composed.png','Luma masked composite')]) + '</div></section>' for name,*_ in cases)
        (output_dir / 'review.html').write_text('<!doctype html><meta charset="utf-8"><title>Luma GPU review</title><style>body{background:#1c2228;color:#e0e8e5;font:14px system-ui;margin:28px}section>div{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}figure{margin:0}img{width:100%}figcaption{padding:8px}</style><h1>Luma Studio · GPU reconstruction review</h1><p>Larx Vo · vovinhlac.com. Three masks on one image. Review identity, anatomy, texture and seam. Metrics do not establish historical truth or general photo quality.</p>'+rows, encoding='utf-8')
        print('Report saved to: ' + str(output_dir.resolve()), flush=True)
        print('Review truth/input/raw/composed PNGs. Metrics do not replace visual/identity review.', flush=True)
    finally:
        if queued_id:
            try: request('/queue', {'delete': [queued_id]})
            except Exception: pass  # Never interrupt another process or all running work.

if __name__ == '__main__': main()
