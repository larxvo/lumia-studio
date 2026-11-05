const CONTOURS = {
  oval: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
  leftEye: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
  rightEye: [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466],
  lips: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146],
  leftBrow: [70, 63, 105, 66, 107, 55, 65, 52, 53, 46],
  rightBrow: [336, 296, 334, 293, 300, 276, 283, 282, 295, 285]
};
const limit = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function polygon(face, name, w = 1, h = 1) {
  return CONTOURS[name].map((i) => ({ x: face.points[i].x * w, y: face.points[i].y * h }));
}
function regionBounds(points) {
  const x = Math.min(...points.map((p) => p.x)), y = Math.min(...points.map((p) => p.y)), right = Math.max(...points.map((p) => p.x)), bottom = Math.max(...points.map((p) => p.y));
  return { x, y, width: Math.max(1e-5, right - x), height: Math.max(1e-5, bottom - y), cx: (x + right) / 2, cy: (y + bottom) / 2 };
}
function insidePolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if (a.y > y !== b.y > y && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function softmaxSkin(logits) {
  const n = logits.length / 6, skin = new Float32Array(n), face = new Float32Array(n), hair = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const k = i * 6, max = Math.max(...logits.subarray(k, k + 6));
    let sum = 0, s = 0, f = 0, t = 0;
    for (let c = 0; c < 6; c++) {
      const v = Math.exp(logits[k + c] - max);
      sum += v;
      if (c === 2 || c === 3) s += v;
      if (c === 3) f = v;
      if (c === 1) t = v;
    }
    skin[i] = s / sum;
    face[i] = f / sum;
    hair[i] = t / sum;
  }
  return { skin, face, hair };
}
function nms(boxes, threshold = 0.35, max = 8) {
  const out = [];
  for (const b of [...boxes].sort((a, b2) => b2.score - a.score)) {
    if (out.some((a) => {
      const iw = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)), ih = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)), intersection = iw * ih;
      return intersection / (a.width * a.height + b.width * b.height - intersection) > threshold;
    })) continue;
    out.push(b);
    if (out.length >= max) break;
  }
  return out;
}
function decodeYuNet(outputs, { width, height, size = 640, threshold = 0.65 } = {}) {
  const scale = size / Math.max(width, height), padX = (size - width * scale) / 2, padY = (size - height * scale) / 2, boxes = [];
  for (const stride of [8, 16, 32]) {
    const cls = outputs["cls_" + stride]?.data, obj = outputs["obj_" + stride]?.data, bbox = outputs["bbox_" + stride]?.data, kps = outputs["kps_" + stride]?.data;
    if (!cls || !obj || !bbox || !kps) throw new Error("Unexpected face detector output.");
    const cols = size / stride;
    for (let i = 0; i < cls.length; i++) {
      const score = Math.sqrt(limit(cls[i], 0, 1) * limit(obj[i], 0, 1));
      if (score < threshold) continue;
      const col = i % cols, row = Math.floor(i / cols), cx = (col + bbox[i * 4]) * stride, cy = (row + bbox[i * 4 + 1]) * stride, w = Math.exp(bbox[i * 4 + 2]) * stride, h = Math.exp(bbox[i * 4 + 3]) * stride;
      const points = Array.from({ length: 5 }, (_, k) => ({ x: ((col + kps[i * 10 + k * 2]) * stride - padX) / scale, y: ((row + kps[i * 10 + k * 2 + 1]) * stride - padY) / scale }));
      boxes.push({ x: (cx - w / 2 - padX) / scale, y: (cy - h / 2 - padY) / scale, width: w / scale, height: h / scale, score, keypoints: points });
    }
  }
  return nms(boxes).filter((b) => b.width > 12 && b.height > 12 && b.x < width && b.y < height && b.x + b.width > 0 && b.y + b.height > 0);
}
function roiFromDetection(box) {
  const eyes = box.keypoints.slice(0, 2).sort((a, b) => a.x - b.x), angle = Math.atan2(eyes[1].y - eyes[0].y, eyes[1].x - eyes[0].x);
  return { cx: box.x + box.width / 2, cy: box.y + box.height / 2, side: Math.max(box.width, box.height) * 1.5, angle };
}
function projectLandmarks(values, roi, width, height) {
  const c = Math.cos(roi.angle), s = Math.sin(roi.angle);
  return Array.from({ length: 478 }, (_, i) => {
    const x = (values[i * 3] / 256 - 0.5) * roi.side, y = (values[i * 3 + 1] / 256 - 0.5) * roi.side;
    return { x: (roi.cx + x * c - y * s) / width, y: (roi.cy + x * s + y * c) / height, z: values[i * 3 + 2] / 256 * roi.side / width };
  });
}
export {
  CONTOURS,
  decodeYuNet,
  insidePolygon,
  limit,
  nms,
  polygon,
  projectLandmarks,
  regionBounds,
  roiFromDetection,
  softmaxSkin
};
