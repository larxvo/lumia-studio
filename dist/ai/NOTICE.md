# AI assets

All model inference runs locally in a browser worker. Assets are served from the same origin.

## Portrait

- Model: `onnx-community/mediapipe_selfie_segmentation`, FP32 ONNX conversion of Google's MediaPipe Selfie Segmentation model.
- Source: https://huggingface.co/onnx-community/mediapipe_selfie_segmentation
- Downloaded file: `onnx/model.onnx`.
- Apache-2.0. See MODEL-LICENSE.txt.
- Processor: RGB, float32, NCHW, 256×256, values 0–1. Output: foreground alpha matte.

## Objects

- Model: `ketiswp/google-coral-DeepLabV3-MobileNetV2-1.0-PascalVOC-fp32-onnx`.
- Source: https://huggingface.co/ketiswp/google-coral-DeepLabV3-MobileNetV2-1.0-PascalVOC-fp32-onnx
- Original Google TensorFlow artifact: https://storage.googleapis.com/download.tensorflow.org/models/deeplabv3_mnv2_pascal_train_aug_2018_01_29.tar.gz
- Source project: https://github.com/tensorflow/models/tree/archive/research/deeplab
- Apache-2.0. See MODEL-LICENSE.txt.
- Processor: RGB uint8, NHWC, 513×513, letterboxed. Output: semantic class labels, not calibrated confidence scores. A small edge feather is applied before mask refinement.

## Runtime

ONNX Runtime Web 1.30.0, Microsoft, MIT. See ONNX-RUNTIME-LICENSE.txt. The WebAssembly execution provider uses one thread for compatibility without cross-origin isolation. Its SIMD binary is loaded on demand.

## Asset checksums

- `portrait.onnx`: SHA-256 `3241ac4ad8aa35bdaf33946776db29f7c283a413aa0b0dacb9483594b4531aad`
- `objects.onnx`: SHA-256 `f7296d6022cbe94094fcad2e335a5e117dc3ede70e3388d0b892989864a29c6a`

## Retouch Lab (4.0)

These assets load only when face/skin analysis is requested. Inference uses CPU ONNX Runtime Web in a cancellable module worker. The skin map and face geometry are saved locally in the edit recipe; no identification or disease classification is performed.

### Skin and person-part segmentation

- Original: Google MediaPipe Selfie Multiclass 256×256, six categories (background, hair, body skin, face skin, clothes, accessories).
- Original reference: https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter
- Original TFLite v1: https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite
- ONNX conversion: https://huggingface.co/senty-au/selfie_multiclass_256x256-ONNX/tree/6db8421a7150ac20558f2c24675078eb3a1a04d0
- File: `onnx/model.onnx`, vendored as `skin.onnx`. Conversion only; weights unchanged according to its publisher. Apache-2.0, Google LLC; see MODEL-LICENSE.txt.
- RGB float32 NHWC [1,256,256,3], values 0–1, stretched. Six output logits are converted with stable softmax; face/body skin probabilities are combined or separated by scope.
- SHA-256: `35ec1ecd9ee7f85073c99c00020b7f6751b69506eeacf683bc8665f6117f85b0` (16,454,560 bytes).

### Face detection

- OpenCV Zoo YuNet: https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet
- Model: `face_detection_yunet_2023mar.onnx`, vendored as `face-detector.onnx`.
- Source bytes: https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx
- MIT; see YUNET-LICENSE.txt. Local implementation uses raw BGR NCHW 640×640 input, stride decoding and NMS. Five coarse points orient the crop; no face identity embeddings are created.
- SHA-256: `8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4` (232,589 bytes).

### Face landmarks

- Google MediaPipe Face Mesh V2, 478 3D landmark estimates.
- Original model bundle: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
- Model card/license: https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Face%20Mesh%20V2.pdf (Apache-2.0).
- ONNX conversion: https://huggingface.co/naklitechie/face-landmarks-onnx/tree/575c33816c840c5b156398adb485e4f8d138adc2
- File: `face_landmarks.onnx`, vendored as `face-landmarks.onnx`. Format conversion only according to its publisher.
- RGB float32 NHWC [1,256,256,3] crop with orientation correction and margin, values 0–1. Pixel-coordinate landmark output is projected to normalized source coordinates. The face-presence logit gates acceptance.
- SHA-256: `f38c3321ceffbc9e95103480ad38cc3f52e7e1bde2bcee7cd9355d0b9138ac0c` (4,920,995 bytes).

### Actual scope

Neural models identify skin regions and face geometry. Blemish/texture filtering, local warping, scratch detection, tone correction and neighboring-pixel inpainting are ordinary image algorithms authored for this app. They are not generative restoration, automatic historical color recovery or a medical classifier. Image quality, lighting, pose and mask accuracy affect the result. The model formats/preprocessing are exercised by a real CPU inference test; this does not constitute a demographic accuracy study.
