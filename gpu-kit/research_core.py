"""Local research ranking only. No diagnosis, calibrated risk, or treatment output."""
from __future__ import annotations
import hashlib
import io
import math
import time
from pathlib import Path

LABELS = [
    ('acne', 'Mụn trứng cá', 'acne vulgaris with comedones and pimples'),
    ('psoriasis', 'Vảy nến', 'psoriasis with well-demarcated scaly plaques'),
    ('eczema', 'Chàm / viêm da', 'eczematous dermatitis with a red dry rash'),
    ('rosacea', 'Rosacea', 'rosacea with facial redness'),
    ('vitiligo', 'Bạch biến', 'vitiligo with depigmented patches'),
    ('freckles', 'Tàn nhang', 'freckles with small brown pigmented macules'),
    ('hyperpigmentation', 'Tăng sắc tố', 'hyperpigmentation with brown dark patches'),
    ('wrinkles', 'Nếp nhăn', 'skin wrinkles and fine lines'),
    ('normal', 'Không có dấu hiệu rõ', 'normal skin without a visible lesion'),
    ('other', 'Ngoài nhóm nhãn', 'a skin condition other than these conditions'),
    ('not_skin', 'Không phải vùng da phù hợp', 'a non-skin object, drawing, or landscape'),
]

def rank_candidates(scores):
    if len(scores) != len(LABELS) or any(not math.isfinite(float(s)) or abs(float(s)) > 1.001 for s in scores):
        raise ValueError('Invalid similarity output.')
    order = sorted(range(len(scores)), key=lambda i: float(scores[i]), reverse=True)
    first, second = order[:2]
    gap = float(scores[first]) - float(scores[second])
    # Engineering abstention thresholds, not clinical calibration or an OOD detector.
    reasons = []
    if LABELS[first][0] in ('normal', 'other', 'not_skin'):
        reasons.append('Nhãn ngoài nhóm bệnh hoặc không đủ dấu hiệu rõ.')
    if float(scores[first]) < .20 or gap < .015:
        reasons.append('Điểm tương đồng hoặc độ tách nhãn chưa đủ theo ngưỡng nghiên cứu.')
    candidates = [{'id': LABELS[i][0], 'label': LABELS[i][1], 'score': float(scores[i])} for i in order[:3]]
    return {'abstained': bool(reasons), 'reasons': reasons, 'candidates': candidates,
            'scoreType': 'cosine_similarity', 'calibration': 'none', 'validated': False,
            'margin': gap, 'thresholds': {'minimumScore': .20, 'minimumMargin': .015},
            'intendedUse': 'research-ranking-only',
            'notice': 'Không phải chẩn đoán hoặc xác suất mắc bệnh. Không dùng để quyết định điều trị hay tự động retouch.'}

def image_quality(image):
    from PIL import ImageStat, ImageFilter
    if min(image.size) < 64 or image.width * image.height > 16777216:
        return ['Vùng ảnh quá nhỏ hoặc vượt 16 MP.']
    gray = image.convert('L').resize((256, 256))
    stat = ImageStat.Stat(gray)
    issues = []
    if stat.mean[0] < 25: issues.append('Ảnh quá tối.')
    if stat.mean[0] > 242: issues.append('Ảnh quá sáng.')
    if stat.stddev[0] < 3: issues.append('Thiếu tương phản và chi tiết.')
    return issues

def cuda_proof(torch_module=None):
    if torch_module is None:
        import torch as torch_module
    t = torch_module
    if not t.cuda.is_available():
        raise RuntimeError('CUDA không sẵn sàng. Bài kiểm chứng không chuyển sang CPU.')
    device = t.device('cuda:0')
    props = t.cuda.get_device_properties(device)
    start, end = t.cuda.Event(enable_timing=True), t.cuda.Event(enable_timing=True)
    prior = t.backends.cuda.matmul.allow_tf32
    try:
        t.backends.cuda.matmul.allow_tf32 = False
        a = t.arange(1024 * 1024, device=device, dtype=t.float32).reshape(1024, 1024) / 1024
        identity = t.eye(1024, device=device, dtype=t.float32)
        t.cuda.synchronize(device)
        start.record()
        result = a @ identity
        end.record()
        t.cuda.synchronize(device)
        error = (result - a).abs().max().item()
        if result.device.type != 'cuda' or not t.isfinite(result).all().item() or error > 1e-4:
            raise RuntimeError('Phép tính CUDA không vượt kiểm tra kết quả.')
        digest = hashlib.sha256(result.detach().cpu().numpy().tobytes()).hexdigest()
        return {'schema': 'luma-cuda-proof-v1', 'status': 'passed', 'backend': 'cuda',
                'torch': str(t.__version__), 'cudaRuntime': str(t.version.cuda),
                'device': str(props.name), 'capability': list(t.cuda.get_device_capability(device)),
                'vramBytes': int(props.total_memory), 'operation': 'float32-matmul-identity-1024',
                'tensorDevice': str(result.device), 'maxAbsoluteError': float(error),
                'gpuEventMilliseconds': float(start.elapsed_time(end)), 'outputSHA256': digest,
                'scope': 'Proof that this Python process executed the checked tensor operation on CUDA; not proof of ComfyUI image quality.'}
    finally:
        t.backends.cuda.matmul.allow_tf32 = prior

class SkinResearch:
    def __init__(self, model_dir=None):
        self.model_dir = Path(model_dir).resolve() if model_dir else None
        self.model = None
        self.processor = None
        self.weights_hash = None

    def configured(self):
        return bool(self.model_dir and (self.model_dir / 'config.json').is_file()
                    and list(self.model_dir.glob('*.safetensors')))

    def load(self):
        if self.model is not None: return
        if not self.configured():
            raise RuntimeError('Chưa có MedSigLIP local hợp lệ. Tải mô hình từ Google sau khi bạn chấp nhận điều khoản rồi chọn thư mục trong Start-Luma.ps1.')
        import json
        import torch
        from transformers import AutoModel, AutoProcessor
        if not torch.cuda.is_available():
            raise RuntimeError('Nghiên cứu da trong bộ này yêu cầu CUDA; không tự chuyển sang CPU.')
        config = json.loads((self.model_dir / 'config.json').read_text(encoding='utf-8'))
        if config.get('model_type') != 'siglip' or config.get('vision_config', {}).get('image_size') != 448:
            raise RuntimeError('Chỉ hỗ trợ kiến trúc SigLIP của google/medsiglip-448.')
        digest = hashlib.sha256()
        for path in sorted(self.model_dir.glob('*.safetensors')):
            digest.update(path.name.encode())
            with path.open('rb') as f:
                for block in iter(lambda: f.read(8 * 1024 * 1024), b''): digest.update(block)
        self.weights_hash = digest.hexdigest()
        processor = AutoProcessor.from_pretrained(str(self.model_dir), local_files_only=True, trust_remote_code=False)
        model = AutoModel.from_pretrained(str(self.model_dir), local_files_only=True,
                                         trust_remote_code=False, use_safetensors=True).to('cuda').eval()
        self.processor, self.model = processor, model

    def predict(self, encoded):
        from PIL import Image, ImageOps
        Image.MAX_IMAGE_PIXELS = 16777216
        with Image.open(io.BytesIO(encoded)) as source:
            if source.format not in ('PNG', 'JPEG', 'WEBP'):
                raise ValueError('Chỉ nhận PNG/JPEG/WebP.')
            if source.width * source.height > 16777216:
                raise ValueError('Vùng ảnh vượt 16 MP.')
            image = ImageOps.exif_transpose(source).convert('RGB')
        issues = image_quality(image)
        if issues:
            return {'abstained': True, 'reasons': issues, 'candidates': [], 'scoreType': 'cosine_similarity',
                    'calibration': 'none', 'validated': False, 'intendedUse': 'research-ranking-only'}
        self.load()
        import torch
        prompts = [f'A clinical photograph of {description}.' for _, _, description in LABELS]
        inputs = self.processor(text=prompts, images=image, padding='max_length', max_length=64, return_tensors='pt').to('cuda')
        before = time.perf_counter()
        with torch.inference_mode():
            output = self.model(**inputs)
            images = torch.nn.functional.normalize(output.image_embeds.float(), dim=-1)
            texts = torch.nn.functional.normalize(output.text_embeds.float(), dim=-1)
            scores = (images[0] @ texts.T).detach().cpu().tolist()
        answer = rank_candidates(scores)
        answer['model'] = {'id': 'local-siglip-448', 'expectedSource': 'google/medsiglip-448',
                           'sourceIdentityIndependentlyVerified': False, 'weightsSHA256': self.weights_hash,
                           'backend': 'cuda', 'tensorDevice': str(output.image_embeds.device),
                           'adaptation': 'fixed-label-semantic-ranking-v1', 'clinicalValidation': 'not-performed'}
        answer['inputSHA256'] = hashlib.sha256(encoded).hexdigest()
        answer['elapsedSeconds'] = time.perf_counter() - before
        return answer
