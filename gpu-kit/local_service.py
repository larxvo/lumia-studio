"""Loopback-only Luma companion. No remote access, wildcard CORS or image storage."""
from __future__ import annotations
import argparse, base64, hmac, json, mimetypes, os, re, secrets, sys, threading, urllib.request, urllib.error, webbrowser
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote, urlsplit

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--dist', required=True); p.add_argument('--port', type=int, default=8788)
    p.add_argument('--comfy-port', type=int, default=8188); p.add_argument('--model-dir')
    p.add_argument('--deps'); p.add_argument('--no-browser', action='store_true')
    args = p.parse_args()
    if args.deps: sys.path.insert(0, str(Path(args.deps).resolve()))
    from research_core import SkinResearch, cuda_proof
    root = Path(args.dist).resolve()
    if not (root / 'index.html').is_file(): p.error('Missing Luma dist/index.html.')
    if not 1024 <= args.port <= 65535 or not 1024 <= args.comfy_port <= 65535: p.error('Invalid port.')
    token, skin, lock, owned_jobs = secrets.token_urlsafe(32), SkinResearch(args.model_dir), threading.Lock(), set()
    origin = f'http://127.0.0.1:{args.port}'

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_): pass  # No image names, headers, tokens or private URLs in logs.
        def send(self, status, content, kind='application/json'):
            if kind == 'application/json': content = json.dumps(content, ensure_ascii=False).encode()
            self.send_response(status); self.send_header('Content-Type', kind)
            self.send_header('Content-Length', str(len(content))); self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff'); self.end_headers(); self.wfile.write(content)
        def valid_host(self):
            return self.headers.get('Host') in (f'127.0.0.1:{args.port}', f'localhost:{args.port}')
        def authorized(self):
            supplied = self.headers.get('Authorization', '')
            allowed_origin = self.headers.get('Origin') in (None, origin, f'http://localhost:{args.port}')
            return self.valid_host() and allowed_origin and hmac.compare_digest(supplied, 'Bearer ' + token)
        def read_body(self, maximum=32*1024*1024):
            raw = self.headers.get('Content-Length', '')
            if not raw.isdecimal() or not 0 < int(raw) <= maximum: raise ValueError('Invalid body length.')
            return self.rfile.read(int(raw))
        def do_OPTIONS(self): self.send(403, {'error': 'Cross-origin API is disabled.'})
        def do_GET(self): self.dispatch()
        def do_POST(self): self.dispatch()
        def dispatch(self):
            if not self.valid_host(): self.send(403, {'error': 'Invalid host.'}); return
            path = urlsplit(self.path).path
            if path.startswith('/api/') or path.startswith('/comfy/'):
                if not self.authorized(): self.send(401, {'error': 'Open Luma using the session link printed in this window.'}); return
                try:
                    if path == '/api/local-info' and self.command == 'GET':
                        self.send(200, {'schema': 'luma-local-v1', 'researchConfigured': skin.configured(),
                                        'researchLoaded': skin.model is not None, 'modelId': 'google/medsiglip-448',
                                        'clinicalValidation': 'not-performed'}); return
                    if path == '/api/cuda-proof' and self.command == 'POST':
                        self.read_body(1000)
                        with lock: answer = cuda_proof()
                        self.send(200, answer); return
                    if path == '/api/skin-classify' and self.command == 'POST':
                        body = json.loads(self.read_body(8*1024*1024))
                        encoded = body.get('image', '')
                        if not isinstance(encoded, str) or not re.fullmatch(r'data:image/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+', encoded):
                            raise ValueError('Invalid image.')
                        image = base64.b64decode(encoded.split(',', 1)[1], validate=True)
                        with lock: answer = skin.predict(image)
                        self.send(200, answer); return
                    if path.startswith('/comfy/'):
                        suffix = self.path[len('/comfy'):]
                        allowed_get = r'/(?:object_info(?:/[A-Za-z0-9_]+)?|system_stats|history/[A-Za-z0-9_-]+|view)'
                        allowed_post = ('/upload/image', '/prompt', '/queue')
                        subpath = urlsplit(suffix).path
                        if not (self.command == 'GET' and re.fullmatch(allowed_get, subpath) or self.command == 'POST' and subpath in allowed_post):
                            self.send(403, {'error': 'Unsupported ComfyUI operation.'}); return
                        payload = self.read_body() if self.command == 'POST' else None
                        if subpath == '/queue':
                            cancellation = json.loads(payload)
                            if set(cancellation) != {'delete'} or not isinstance(cancellation['delete'], list) or not all(i in owned_jobs for i in cancellation['delete']):
                                self.send(403, {'error': 'Only this session queued jobs can be cancelled.'}); return
                        request = urllib.request.Request(f'http://127.0.0.1:{args.comfy_port}' + suffix, data=payload, method=self.command,
                                                         headers={'Content-Type': self.headers.get('Content-Type', 'application/json')})
                        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
                        with opener.open(request, timeout=60) as response:
                            data = response.read(32*1024*1024+1)
                            if len(data) > 32*1024*1024: raise ValueError('ComfyUI response too large.')
                            if subpath == '/prompt':
                                job = json.loads(data).get('prompt_id')
                                if isinstance(job, str): owned_jobs.add(job)
                            self.send(200, data, response.headers.get('Content-Type', 'application/octet-stream')); return
                    self.send(404, {'error': 'Unknown API.'})
                except urllib.error.HTTPError as e: self.send(e.code, {'error': f'ComfyUI HTTP {e.code}.'})
                except Exception as e: self.send(400, {'error': str(e)[:500]})
                return
            if self.command != 'GET': self.send(405, {'error': 'Method not allowed.'}); return
            target = (root / unquote(path).lstrip('/')).resolve()
            if path == '/': target = root / 'index.html'
            if root not in target.parents or not target.is_file(): self.send(404, b'Not found', 'text/plain'); return
            self.send(200, target.read_bytes(), mimetypes.guess_type(target.name)[0] or 'application/octet-stream')

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *_args, **_kwargs): return None
    mimetypes.add_type('text/javascript', '.mjs'); mimetypes.add_type('application/wasm', '.wasm')
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    link = origin + '/#luma-local-token=' + token
    print('\nLuma local session (private, do not share):\n' + link + '\n', flush=True)
    print('Close this window to stop the local service. No images are sent to Canva or a cloud model.', flush=True)
    if not args.no_browser: webbrowser.open(link)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()

if __name__ == '__main__': main()
