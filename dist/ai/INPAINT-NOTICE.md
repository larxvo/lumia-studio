# LaMa inpainting asset

- Model source: https://huggingface.co/g-ronimo/lama
- Frozen commit: `418036c6b541e526cdbb0bead1ec3a87dabede53`
- File: `lama_512_int8.onnx`
- Frozen download: https://huggingface.co/g-ronimo/lama/resolve/418036c6b541e526cdbb0bead1ec3a87dabede53/lama_512_int8.onnx
- Upstream: LaMa, Samsung Research, https://github.com/advimman/lama
- ONNX export lineage: https://huggingface.co/Carve/LaMa-ONNX
- Fixed 512 graph and per-channel INT8 weight quantization: g-ronimo.
- License: Apache-2.0, declared by model card; upstream `INPAINT-LICENSE.txt` included.
- Architecture: Large Mask Inpainting with Fourier Convolutions, WACV 2022. Trained on Places2.
- Changes by Luma: none to model; hosting split/reassembly only.
- Size: 62,074,990 bytes.
- SHA-256: `cab19978adc306622fe37ef60d4a52103b99c98141d499c2a2366a7ed1255dbe`
- Four parts, each at most 16 MiB, recorded in `inpaint-manifest.json`.

## Contract

Input `input`: float32 `[1, 4, 512, 512]`, NCHW. First three channels are RGB / 255 with masked pixels zeroed. Fourth channel is a binary mask: 1 = reconstruct, 0 = preserve. Output `output`: float32 `[1, 3, 512, 512]`, RGB in 0–1; multiply by 255 for display.

The model changes pixels outside the mask. Always composite its prediction only within the user mask, over the original source. Preserve source alpha outside the filled area. Use a correctly unmapped context crop or letterbox to the fixed square size.

## Verified

Actual onnxruntime-web 1.30.0 WASM single-thread inference, using the project's existing vendored runtime. A 512 × 512 sample loaded in 0.667 seconds and inferred in 19.201 seconds in the shared CPU container. This is not a device performance promise. All 786,432 output floats were finite. A 90 × 110-pixel selected background area was reconstructed in the bundled public-domain portrait. The final composition preserved every unmasked source pixel.

A repeatable inference check is included in tests/neural.test.mjs.

## Limits

Contextual neural inpainting without text prompts. Large missing faces and objects can produce plausible invented detail rather than the original. No guarantee of historical accuracy or identity details. This model does not support a claim of controlled smile/neutral expression generation; that requires another model or provider.
