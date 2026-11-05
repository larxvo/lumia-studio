import { decodeYuNet, roiFromDetection, projectLandmarks, softmaxSkin } from "./face-geometry.js";
function createFaceAnalyzer(ort, { createCanvas = (w, h) => new OffscreenCanvas(w, h), modelBase = new URL("./ai/", import.meta.url).href, loadModel = null } = {}) {
  const sessions = /* @__PURE__ */ new Map();
  async function session(name, onProgress) {
    if (!sessions.has(name)) {
      onProgress?.("Loading " + name + " on your device…");
      sessions.set(name, ort.InferenceSession.create(loadModel ? await loadModel(name) : modelBase + name + ".onnx", { executionProviders: ["wasm"], graphOptimizationLevel: "all" }).catch((error) => {
        sessions.delete(name);
        throw error;
      }));
    }
    return sessions.get(name);
  }
  const tensor = (rgba, size, bgr = false) => {
    const a = new Float32Array(size * size * 3), n = size * size;
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) {
      if (bgr) a[k * n + i] = rgba[i * 4 + 2 - k];
      else a[i * 3 + k] = rgba[i * 4 + k] / 255;
    }
    return new ort.Tensor("float32", a, bgr ? [1, 3, size, size] : [1, size, size, 3]);
  };
  async function analyze(image, { skin = true, faces = true, onProgress = () => {
  } } = {}) {
    const width = image.width, height = image.height, result = { width, height, faces: [], skin: null };
    if (skin) {
      const task = await session("skin", onProgress), c = createCanvas(256, 256), x = c.getContext("2d");
      x.drawImage(image, 0, 0, 256, 256);
      onProgress("Recognizing face and body skin…");
      const outputs = await task.run({ [task.inputNames[0]]: tensor(x.getImageData(0, 0, 256, 256).data, 256) }), out = outputs[task.outputNames[0]];
      if (out.data.length !== 256 * 256 * 6) throw new Error("Unexpected skin model output.");
      const { skin: values, face, hair } = softmaxSkin(out.data);
      result.skin = { width: 256, height: 256, values, face, hair };
    }
    if (faces) {
      const task = await session("face-detector", onProgress), size = 640, c = createCanvas(size, size), x = c.getContext("2d"), scale = size / Math.max(width, height);
      x.fillStyle = "#000";
      x.fillRect(0, 0, size, size);
      x.drawImage(image, (size - width * scale) / 2, (size - height * scale) / 2, width * scale, height * scale);
      onProgress("Finding facial landmarks…");
      const out = await task.run({ [task.inputNames[0]]: tensor(x.getImageData(0, 0, size, size).data, size, true) }), detections = decodeYuNet(out, { width, height, size });
      if (detections.length) {
        const mesh = await session("face-landmarks", onProgress);
        for (const box of detections) {
          const roi = roiFromDetection(box), crop = createCanvas(256, 256), ctx = crop.getContext("2d");
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, 256, 256);
          ctx.translate(128, 128);
          ctx.scale(256 / roi.side, 256 / roi.side);
          ctx.rotate(-roi.angle);
          ctx.translate(-roi.cx, -roi.cy);
          ctx.drawImage(image, 0, 0);
          const outputs = await mesh.run({ [mesh.inputNames[0]]: tensor(ctx.getImageData(0, 0, 256, 256).data, 256) }), values = Object.values(outputs).find((o) => o.data.length === 1434)?.data, presence = outputs.Identity_1?.data[0], score = presence === void 0 ? box.score : 1 / (1 + Math.exp(-presence));
          if (!values || score < 0.5) continue;
          const points = projectLandmarks(values, roi, width, height);
          if (points.some((p) => !Number.isFinite(p.x + p.y))) continue;
          result.faces.push({ points, score, box: { x: box.x / width, y: box.y / height, width: box.width / width, height: box.height / height } });
        }
      }
    }
    return result;
  }
  return { analyze, dispose: async () => {
    for (const promise of sessions.values()) try {
      await (await promise).release();
    } catch {
    }
    sessions.clear();
  } };
}
export {
  createFaceAnalyzer
};
