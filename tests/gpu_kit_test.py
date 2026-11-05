import importlib.util, io, json, math, socket, subprocess, sys, threading, time, unittest, urllib.request, urllib.error
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'gpu-kit'))
from research_core import rank_candidates, image_quality, cuda_proof, LABELS
from benchmark import metrics, workflow
from probe import probe

class ResearchContract(unittest.TestCase):
    def test_probe_never_confuses_cpu_with_cuda_or_image_quality(self):
        report = probe(lambda: {'status': 'passed', 'backend': 'cpu', 'tensorDevice': 'cpu', 'outputSHA256': 'test'})
        self.assertFalse(report['computeVerified'])
        self.assertFalse(report['imageQualityVerified'])
        self.assertEqual(report['status'], 'blocked')
        # Explicit unit-test double: exercises report gating; not physical GPU evidence.
        report = probe(lambda: {'status': 'passed', 'backend': 'cuda', 'tensorDevice': 'cuda:0', 'outputSHA256': 'test-double-not-hardware'})
        self.assertTrue(report['computeVerified'])
        self.assertFalse(report['imageQualityVerified'])

    def test_rank_is_not_a_disease_probability(self):
        values = [.1] * len(LABELS); values[0] = .6
        r = rank_candidates(values)
        self.assertEqual(r['candidates'][0]['id'], 'acne')
        self.assertEqual(r['scoreType'], 'cosine_similarity')
        self.assertFalse(r['validated']); self.assertEqual(r['calibration'], 'none')
        self.assertFalse(r['abstained'])
    def test_unknown_ties_low_scores_and_invalid_outputs(self):
        tied = rank_candidates([.4]*len(LABELS)); self.assertTrue(tied['abstained'])
        unknown = [.1]*len(LABELS); unknown[-1] = .9
        self.assertTrue(rank_candidates(unknown)['abstained'])
        self.assertTrue(rank_candidates([.05]*len(LABELS))['abstained'])
        with self.assertRaises(ValueError): rank_candidates([float('nan')]*len(LABELS))
    def test_quality_abstains_on_dark_uniform_or_tiny_input(self):
        self.assertTrue(image_quality(Image.new('RGB', (128,128), 'black')))
        self.assertTrue(image_quality(Image.new('RGB', (128,128), '#aaaaaa')))
        self.assertTrue(image_quality(Image.new('RGB', (32,128), '#888888')))
    def test_cpu_is_never_reported_as_cuda_success(self):
        class NoCUDA:
            class cuda:
                @staticmethod
                def is_available(): return False
        with self.assertRaisesRegex(RuntimeError, 'CPU'): cuda_proof(NoCUDA)
    def test_metrics_keep_uint8_subtraction_correct_and_measure_exterior(self):
        import numpy as np
        source = np.zeros((8,8,4), dtype=np.uint8); source[:,:,3] = 255
        generated = source.copy(); generated[2:6,2:6,:3] = 255
        mask = np.zeros((8,8),bool); mask[2:6,2:6] = True
        r = metrics(source,generated,mask)
        self.assertEqual(r['maskedMAE'],255); self.assertEqual(r['maskedPSNR'],0)
        self.assertEqual(r['outsideChangedPixels'],0)
        generated[0,0,0]=10
        self.assertEqual(metrics(source,generated,mask)['outsideChangedPixels'],1)
    def test_benchmark_http_pipeline_runs_three_masks_and_keeps_exterior_pixels(self):
        import contextlib, tempfile
        import numpy as np
        import benchmark
        from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
        truth = np.zeros((512,512,4),dtype=np.uint8)
        truth[:,:,0] = np.arange(512)[None,:] % 256
        truth[:,:,1] = np.arange(512)[:,None] % 256
        truth[:,:,2] = 90; truth[:,:,3] = 255
        generated = Image.new('RGBA',(512,512),(17,34,51,255)); buf=io.BytesIO(); generated.save(buf,format='PNG'); result_png=buf.getvalue()
        masks=[]; seeds=[]
        class FixtureHandler(BaseHTTPRequestHandler):
            def log_message(self,*_): pass
            def answer(self,value,binary=False):
                raw=value if binary else json.dumps(value).encode(); self.send_response(200);self.send_header('Content-Type','image/png' if binary else 'application/json');self.end_headers();self.wfile.write(raw)
            def do_GET(self):
                if self.path=='/system_stats': self.answer({'system':{'comfyui_version':'fixture-only'},'devices':[{'name':'TEST DOUBLE','type':'cuda'}]})
                elif self.path.startswith('/object_info'): self.answer({'CheckpointLoaderSimple':{'input':{'required':{'ckpt_name':[['fixture.safetensors']]}}}})
                elif self.path.startswith('/history/'):
                    job=self.path.split('/')[-1];self.answer({job:{'outputs':{'8':{'images':[{'filename':'fixture.png','type':'output'}]}}}})
                elif self.path.startswith('/view?'):self.answer(result_png,True)
                else:self.send_error(404)
            def do_POST(self):
                raw=self.rfile.read(int(self.headers['Content-Length']))
                if self.path=='/upload/image':
                    payload=raw.split(b'\r\n\r\n',1)[1].split(b'\r\n--Luma',1)[0]
                    with Image.open(io.BytesIO(payload)) as im:masks.append(int((np.array(im)[:,:,3]==0).sum()))
                    self.answer({'name':'uploaded.png','subfolder':''})
                elif self.path=='/prompt':
                    graph=json.loads(raw)['prompt'];seeds.append(graph['6']['inputs']['seed']);self.answer({'prompt_id':'case'+str(len(seeds))})
                else:self.send_error(404)
        server=ThreadingHTTPServer(('127.0.0.1',0),FixtureHandler); thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        prior_argv, prior_proof=sys.argv,benchmark.cuda_proof
        try:
            with tempfile.TemporaryDirectory() as td:
                source=Path(td)/'truth.png';Image.fromarray(truth).save(source)
                # A clearly labeled test double validates HTTP/math only, never GPU performance.
                benchmark.cuda_proof=lambda:{'schema':'test-double-not-hardware-evidence','status':'passed','backend':'cuda','tensorDevice':'cuda:0'}
                sys.argv=['benchmark.py','--image',str(source),'--checkpoint','fixture.safetensors','--port',str(server.server_port),'--output',str(Path(td)/'reports')]
                with contextlib.redirect_stdout(io.StringIO()):benchmark.main()
                report=json.loads(next((Path(td)/'reports').glob('*/report.json')).read_text())
                self.assertEqual(seeds,[731,732,733]);self.assertEqual(masks,[4096,16384,6160]);self.assertEqual(len(report['cases']),3)
                for case in report['cases']:
                    self.assertEqual(case['composedMetrics']['outsideChangedPixels'],0)
                    self.assertGreater(case['rawMetrics']['outsideChangedPixels'],0)
                    self.assertEqual(case['manualReview']['identity'],'not-reviewed')
        finally:
            benchmark.cuda_proof=prior_proof;sys.argv=prior_argv;server.shutdown();server.server_close();thread.join(timeout=3)

class LocalServiceSecurity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with socket.socket() as s: s.bind(('127.0.0.1',0)); cls.port=s.getsockname()[1]
        cls.process=subprocess.Popen([sys.executable,str(ROOT/'gpu-kit/local_service.py'),'--dist',str(ROOT/'dist'),'--port',str(cls.port),'--no-browser'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        cls.base=f'http://127.0.0.1:{cls.port}'; cls.token=None
        for _ in range(6):
            line=cls.process.stdout.readline()
            if '#luma-local-token=' in line: cls.token=line.strip().split('#luma-local-token=')[1];break
        if not cls.token: raise RuntimeError('Local service failed to start.')
    @classmethod
    def tearDownClass(cls):
        cls.process.terminate();cls.process.communicate(timeout=5)
    def request(self,path,body=None,auth=True,origin=None):
        headers={'Authorization':'Bearer '+self.token} if auth else {}
        if origin:headers['Origin']=origin
        if body is not None:headers['Content-Type']='application/json'
        req=urllib.request.Request(self.base+path,data=json.dumps(body).encode() if body is not None else None,headers=headers)
        try:
            with urllib.request.urlopen(req,timeout=5) as r:return r.status,r.read()
        except urllib.error.HTTPError as e:return e.code,e.read()
    def test_health_needs_token_and_same_origin(self):
        self.assertEqual(self.request('/api/local-info',auth=False)[0],401)
        self.assertEqual(self.request('/api/local-info',origin='https://evil.invalid')[0],401)
        code,body=self.request('/api/local-info');self.assertEqual(code,200)
        data=json.loads(body);self.assertFalse(data['researchConfigured']);self.assertFalse(data['researchLoaded'])
        self.assertNotIn(self.token,body.decode())
    def test_proxy_forbids_arbitrary_routes_and_other_sessions_cancellation(self):
        self.assertEqual(self.request('/comfy/history')[0],403)
        self.assertEqual(self.request('/comfy/queue',{'delete':['someone-else']})[0],403)
        self.assertEqual(self.request('/comfy/queue',{'clear':True})[0],403)
        self.assertEqual(self.request('/comfy/interrupt',{})[0],403)
    def test_static_traversal_is_rejected(self):
        self.assertEqual(self.request('/../package.json',auth=False)[0],404)
        self.assertEqual(self.request('/index.html',auth=False)[0],200)
    def test_flat_skin_image_abstains_without_loading_a_model(self):
        import base64
        b=io.BytesIO();Image.new('RGB',(128,128),'#888888').save(b,format='PNG')
        code,body=self.request('/api/skin-classify',{'image':'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()})
        self.assertEqual(code,200);r=json.loads(body);self.assertTrue(r['abstained']);self.assertFalse(r['validated']);self.assertEqual(r['candidates'],[])

if __name__=='__main__':unittest.main()
