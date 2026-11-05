import { decodeYuNet } from './face-geometry.js';
import { loadCutoutModel } from './cutout-models.js';
import { resizeMask, samMask, semanticRegions } from './cutout-math.js';

export function createCutoutEngine(ort, { createCanvas = (w, h) => new OffscreenCanvas(w, h), loadModel = (kind, progress) => ['objects', 'skin', 'face-detector'].includes(kind) ? new URL(`./ai/${kind}.onnx`, import.meta.url).href : loadCutoutModel(kind, progress) } = {}) {
  const sessions = new Map();
  let cachedImage = null, embeddings = null, samSize = null;
  async function session(kind, progress) {
    if (!sessions.has(kind)) sessions.set(kind, (async () => {
      progress('Đang mở mô hình trên thiết bị…');
      const bytes = await loadModel(kind, progress);
      return ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    })().catch(error => { sessions.delete(kind); throw error; }));
    return sessions.get(kind);
  }
  function pixels(image, width, height, { letterbox = false, size = width } = {}) {
    const c = createCanvas(size, letterbox ? size : height), x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = letterbox ? '#000' : '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#fff'; x.fillRect(0, 0, width, height);
    x.drawImage(image, 0, 0, width, height);
    return x.getImageData(0, 0, c.width, c.height).data;
  }
  function chw(rgba, width, height, mean, std, divisor = 255) {
    const n = width * height, out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) out[k * n + i] = (rgba[i * 4 + k] / divisor - mean[k]) / std[k];
    return out;
  }
  async function run(image, { mode = 'auto', points = [], imageKey = '', onProgress: progress = () => {} } = {}) {
    const width = image.width, height = image.height;
    if (!width || !height || width * height > 1048576 || Math.max(width, height) > 1024) throw Error('Ảnh phân tích phải có cạnh dài tối đa 1024 px.');
    if (mode === 'point') {
      if (!Array.isArray(points) || points.length < 1 || points.length > 24 || !points.some(p => p.label === 1) || points.some(p => ![0, 1].includes(p.label) || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)) throw Error('Bấm ít nhất một điểm giữ; tối đa 24 điểm thêm / bớt.');
      const rw = Math.round(width * 1024 / Math.max(width, height)), rh = Math.round(height * 1024 / Math.max(width, height));
      if (!embeddings || !imageKey || cachedImage !== imageKey) {
        if (embeddings) for (const t of Object.values(embeddings)) t.dispose?.();
        embeddings = null; cachedImage = null;
        const task = await session('sam-encoder', progress), rgba = pixels(image, rw, rh, { letterbox: true, size: 1024 }), input = chw(rgba, 1024, 1024, [.485, .456, .406], [.229, .224, .225]);
        // SAM pads AFTER normalization. The normalized padded border is zero.
        for (let k = 0; k < 3; k++) for (let y = 0; y < 1024; y++) for (let x = y < rh ? rw : 0; x < 1024; x++) input[k * 1048576 + y * 1024 + x] = 0;
        progress('Đang đọc bố cục ảnh · lần đầu có thể mất 10–40 giây…');
        const tensor = new ort.Tensor('float32', input, [1, 3, 1024, 1024]);
        try { embeddings = await task.run({ pixel_values: tensor }); } finally { tensor.dispose?.(); }
        cachedImage = imageKey; samSize = [rw, rh];
      }
      const task = await session('sam-decoder', progress), coords = [], labels = [];
      for (const p of points) { coords.push(p.x * samSize[0], p.y * samSize[1]); labels.push(BigInt(p.label)); }
      // One padding prompt matches the official SAM point-only processor contract.
      coords.push(0, 0); labels.push(-1n);
      const inputPoints = new ort.Tensor('float32', new Float32Array(coords), [1, 1, labels.length, 2]), inputLabels = new ort.Tensor('int64', new BigInt64Array(labels), [1, 1, labels.length]);
      progress('Đang chọn theo các điểm giữ / bỏ…');
      let output;
      try { output = await task.run({ input_points: inputPoints, input_labels: inputLabels, ...embeddings }); } finally { inputPoints.dispose?.(); inputLabels.dispose?.(); }
      try {
        const scores = Array.from(output.iou_scores.data), masks = scores.map((_, i) => samMask(output.pred_masks.data, i, ...samSize, width, height));
        const best = scores.indexOf(Math.max(...scores));
        return { width, height, values: masks[best], masks, scores, best, method: 'SlimSAM-77 · điểm giữ / bỏ' };
      } finally { for (const tensor of Object.values(output)) tensor.dispose?.(); }
    }
    if (mode === 'faces') {
      const task = await session('face-detector', progress), size = 640, c = createCanvas(size, size), x = c.getContext('2d'), scale = size / Math.max(width, height); x.fillStyle = '#000'; x.fillRect(0, 0, size, size); x.drawImage(image, (size - width * scale) / 2, (size - height * scale) / 2, width * scale, height * scale); const rgba = x.getImageData(0, 0, size, size).data, values = new Float32Array(size * size * 3); for (let i = 0; i < size * size; i++) for (let k = 0; k < 3; k++) values[k * size * size + i] = rgba[i * 4 + 2 - k];
      const input = new ort.Tensor('float32', values, [1, 3, size, size]); let output;
      try { output = await task.run({ [task.inputNames[0]]: input }); return { width, height, faces: decodeYuNet(output, { width, height, size }).map(b => ({ x: b.x / width, y: b.y / height, width: b.width / width, height: b.height / height, score: b.score })) }; } finally { input.dispose?.(); if (output) for (const t of Object.values(output)) t.dispose?.(); }
    }
    if (mode === 'detect') {
      const task = await session('objects', progress), size = 513, scale = size / Math.max(width, height), rw = Math.round(width * scale), rh = Math.round(height * scale), rgba = pixels(image, rw, rh, { letterbox: true, size });
      const data = new Uint8Array(size * size * 3);
      for (let i = 0; i < size * size; i++) for (let k = 0; k < 3; k++) data[i * 3 + k] = rgba[i * 4 + k];
      progress('Đang tìm các vùng vật thể được nhận diện…');
      const input = new ort.Tensor('uint8', data, [1, size, size, 3]);
      let output;
      try { output = await task.run({ [task.inputNames[0]]: input }); } finally { input.dispose?.(); }
      try {
        const labels = output[task.outputNames[0]], sw = labels.dims.at(-1), sh = labels.dims.at(-2), w = Math.max(1, Math.round(sw * rw / size)), h = Math.max(1, Math.round(sh * rh / size)), cropped = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cropped[y * w + x] = Number(labels.data[y * sw + x]);
        return { ...semanticRegions(cropped, w, h), classMap:cropped, method: 'DeepLabV3 · vùng ngữ nghĩa' };
      } finally { for (const tensor of Object.values(output)) tensor.dispose?.(); }
    }
    if (mode === 'hair') {
      const task = await session('skin', progress), rgba = pixels(image, 256, 256), data = new Float32Array(256 * 256 * 3);
      for (let i = 0; i < data.length; i++) data[i] = rgba[Math.floor(i / 3) * 4 + i % 3] / 255;
      const input = new ort.Tensor('float32', data, [1, 256, 256, 3]);
      progress('Đang nhận diện vùng tóc…');
      let output;
      try { output = await task.run({ [task.inputNames[0]]: input }); } finally { input.dispose?.(); }
      let hair;
      try {
        const logits = output[task.outputNames[0]].data, alpha = new Float32Array(256 * 256);
        for (let i = 0; i < alpha.length; i++) { const o = i * 6, max = Math.max(...logits.subarray(o, o + 6)); let sum = 0; for (let k = 0; k < 6; k++) sum += Math.exp(logits[o + k] - max); alpha[i] = Math.exp(logits[o + 1] - max) / sum; }
        hair = resizeMask(alpha, 256, 256, width, height);
      } finally { for (const tensor of Object.values(output)) tensor.dispose?.(); }
      const matte = await run(image, { mode: 'portrait', onProgress: progress });
      for (let i = 0; i < hair.length; i++) hair[i] *= matte.values[i];
      return { width, height, values: hair, method: 'MediaPipe vùng tóc × MODNet alpha' };
    }
    if (!['auto', 'portrait'].includes(mode)) throw Error('Unknown cutout mode.');
    const kind = mode === 'auto' ? 'saliency' : 'matting', task = await session(kind, progress);
    let w = 320, h = 320;
    if (mode === 'portrait') {
      const factor = Math.min(512 / Math.min(width, height), 1024 / Math.max(width, height));
      w = Math.max(32, Math.floor(width * factor / 32) * 32); h = Math.max(32, Math.floor(height * factor / 32) * 32);
    }
    const rgba = pixels(image, w, h), means = mode === 'auto' ? [.485, .456, .406] : [.5, .5, .5], std = mode === 'auto' ? [.229, .224, .225] : [.5, .5, .5];
    // U²-Net follows its author's per-image maximum normalization.
    let divisor = 255;
    if (mode === 'auto') { divisor = 1; for (let i = 0; i < rgba.length; i += 4) divisor = Math.max(divisor, rgba[i], rgba[i + 1], rgba[i + 2]); }
    const data = chw(rgba, w, h, means, std, divisor), input = new ort.Tensor('float32', data, [1, 3, h, w]);
    progress(mode === 'portrait' ? 'Đang ước lượng alpha chân dung và viền tóc…' : 'Đang tự tìm chủ thể nổi bật…');
    let output;
    try { output = await task.run({ [task.inputNames[0]]: input }); } finally { input.dispose?.(); }
    try {
      const mask = new Float32Array(output[task.outputNames[0]].data);
      if (mode === 'auto') {
        let min = Infinity, max = -Infinity;
        for (const v of mask) { min = Math.min(min, v); max = Math.max(max, v); }
        if (max - min < .02) throw Error('Chưa thấy chủ thể đủ rõ. Thử chế độ Bấm vật thể hoặc cọ thêm / bớt.');
        for (let i = 0; i < mask.length; i++) mask[i] = (mask[i] - min) / (max - min);
      }
      return { width, height, values: resizeMask(mask, w, h, width, height), method: mode === 'auto' ? 'U²-Net nhỏ · chủ thể nổi bật' : 'MODNet · alpha chân dung' };
    } finally { for (const tensor of Object.values(output)) tensor.dispose?.(); }
  }
  async function dispose() {
    if (embeddings) for (const tensor of Object.values(embeddings)) tensor.dispose?.();
    embeddings = null; cachedImage = null;
    for (const promise of sessions.values()) { try { await (await promise).release(); } catch {} }
    sessions.clear();
  }
  return { run, dispose };
}
