# Luma v5 colorization model asset research

- Upstream work: Richard Zhang, Phillip Isola, Alexei A. Efros, **Colorful Image Colorization**, ECCV2016. https://github.com/richzhang/colorization
- ONNX conversion source: https://github.com/clibdev/colorization/releases/tag/1.0.0
- Original file: https://github.com/clibdev/colorization/releases/download/1.0.0/colorization-eccv-16.onnx
- Original SHA256: `b4a4cecae9e84e776d665e85774815b0bb43de382813b02fb13144f8fd5d6c83` (128,964,624 bytes; matches published release README).
- License: BSD2Clause. Preserve accompanying `COLORIZATION-LICENSE.txt` in source and binary distributions.
- Local derivative: `colorization-eccv16-int8-weights.onnx`, 32,347,931 bytes, SHA256 `953dce79b48dfc35b5daaf15445693c1f70aea5510d5c856f6c6893fc6f152ba`.
- Derivation: `quantize.py` stores tensors with >=1024 entries as symmetric per-axis int8 with DequantizeLinear nodes. All computations remain float32; this reduces transfer size, not working memory/GFLOPS. No unsupported ConvInteger kernels required.
- Hosting-ready: `colorization.part1` and `.part2`, each <=16MiB, manifest with complete and per-part lengths/hashes.

## Runtime contract

- Input named `input`: float32 NCHW `[1,1,256,256]`, actual CIE L*0–100. The model normalizes internally by `(L-50)/100`.
- Output named `output`: float32 NCHW `[1,2,256,256]`, CIE a* channel followed by CIE b*. These are actual unnormalized a*/b*, no multiplication by110 needed after inference.
- Resize source RGB to256×256 before calculating its L* input. Recombine the predicted ab (bilinear upscale) with **original-resolution L***, preserving alpha; this preserves luminance detail while neural chrominance has256px sampling.
- Reference JS implementation in `colorization-reference.mjs`.
- The predicted colors are plausible AI suggestions and must not be advertised as historically accurate colors.

## Verified smoke

Actual onnxruntime-web1.30.0 CPU WASM, numThreads1, graphOptimizationLevel all. Input is the existing public-domain Pete Souza portrait fixture converted to grayscale.

- Original float32 model: load588ms, inference4493ms.
- Weight-quantized derivative: load56ms, inference3683ms; output finite, range approximately-21..42.
- Mean absolute a*/b* difference from original model0.2868356; RMSE0.3703026.
- `smoke-colorized.png` and `smoke-grayscale.png` record the observed visual result, not generative image assets.
- Timing is for this machine/single fixture, not a browser performance guarantee.

