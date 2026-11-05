# Subject Studio 6.2 — model provenance

All inference executes in a cancellable browser worker with ONNX Runtime Web WASM. Models are served from this Site and downloaded only when their operation is requested. No image pixels are uploaded to an external inference API. Cache behavior is the browser's normal HTTP cache. Mask inference is limited to a longest edge of 1024 pixels; original source pixels and editable layer geometry are retained.

These models estimate masks. They do not guarantee every strand of hair, transparent/reflected objects, instance separation for touching objects, or general recognition of arbitrary semantic categories. No new general quality benchmark is claimed from the portrait smoke fixture.

## SlimSAM-77, quantized ONNX

- Upstream model: https://huggingface.co/nielsr/slimsam-77-uniform
- ONNX conversion/quantization: Xenova, https://huggingface.co/Xenova/slimsam-77-uniform/tree/5850ab45f587c112167512ffef949107115e26a0
- License: Apache-2.0. Full license is included as MODEL-LICENSE.txt.
- Encoder bytes: 8,882,165; SHA-256 `cce23c7b2e5d4f330932738fb67ba518e04b0d99ccdd1cccd22a7da4e01f2971`.
- Prompt encoder/mask decoder bytes: 4,903,810; SHA-256 `cb90b279f549d2cab7fd6e20c38522438c65d84bdcca3d2a764cff7d857fdce2`.
- RGB/ImageNet normalization, longest edge 1024, normalized zero padding at right/bottom, positive/negative points and a padding prompt. Encoder embeddings are cached for the source within the open session; closed/cancelled workers discard the cache. Three model mask hypotheses can be reviewed. Predicted IoU scores rank hypotheses, not semantic or human-verified confidence.

## MODNet photographic portrait matting

- Author/source: ZHKKKe/MODNet, https://github.com/ZHKKKe/MODNet ; ONNX reference https://github.com/ZHKKKe/MODNet/tree/master/onnx
- Model mirror: https://huggingface.co/DavG25/modnet-pretrained-models/tree/903cc06311b3b12071edfa1b42b534e4a31c718a
- License: Apache-2.0, code/models/demos as stated by the author. See MODEL-LICENSE.txt.
- Original ONNX SHA-256 `07c308cf0fc7e6e8b2065a12ed7fc07e1de8febb7dc7839d7b7f15dd66584df9`, 25,888,640 bytes. This hash matches the mirror's documented photographic model.
- RGB float32 NCHW normalized to -1..1, dynamic dimensions in multiples of 32, short edge up to 512 and long edge capped at 1024. Output is used as continuous alpha without a binary threshold. The model is for portraits, not a standalone hair classifier.

## U²-Net small saliency (u2netp)

- Author/source: https://github.com/xuebinqin/U-2-Net
- Distributed model: https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx
- License: Apache-2.0. See MODEL-LICENSE.txt.
- SHA-256 `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8`, 4,574,861 bytes. MD5 `8e83ca70e441ab06c318d82300c84806` also matches rembg's pinned model checksum.
- RGB 320×320, per-image maximum normalization then ImageNet mean/std. First saliency output is range-normalized; nearly uniform responses are rejected. This predicts salient foreground, without assigning object names.

## Reused models

- DeepLabV3-MobileNetV2 Pascal VOC supplies 20 foreground categories plus background. The UI calls connected components of its semantic class map "suggested regions"; these are not detector boxes or guaranteed instances. The full foreground list is present in cutout-math.js. Region suggestions may miss unsupported categories. Point selection can be used independently of those labels.
- MediaPipe Selfie Multiclass supplies hair probabilities (class 1 of six logits). Hair mode multiplies these with MODNet alpha; this separates the hair region from the face/body while retaining portrait boundary transitions. Its part map is 256×256 and may miss fine internal hair regions.
- Provenance and licenses for both reused models are recorded in NOTICE.md and MODEL-LICENSE.txt.

The bundled model bytes are unchanged; only split into bounded assets. cutout-manifest.json records source URLs, sizes and SHA-256 for the full models and individual parts. scripts/package-cutout-models.py reproduces the split from matching local model bytes.

## Smart Remove 6.4 reuse

The removal workflow reuses DeepLab region suggestions, SlimSAM point masks (global and close-up), and the existing local LaMa weights described in INPAINT-NOTICE.md. It adds crop-based composition and bounded source-patch residual transfer, not a newly trained removal model. Visible-green/bright-strand and nearby-occlusion cleanup hints are heuristics requiring review. No new model files are bundled.
