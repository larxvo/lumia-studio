# Third-party components and assets

Luma application code is covered by the root MIT license. This does not replace the licenses of dependencies, model weights, fonts, color profiles or sample images.

| Component | Notice/provenance |
| --- | --- |
| ag-psd | `dist/vendor/ag-psd-LICENSE.txt`; PSD/PSB read/write adapter. |
| ONNX Runtime Web | `dist/ai/ONNX-RUNTIME-LICENSE.txt`; local CPU/WASM inference. |
| MediaPipe-derived segmentation / landmarks and DeepLab | `dist/ai/NOTICE.md`, `dist/ai/MODEL-LICENSE.txt`; conversion sources and SHA-256 values retained. |
| YuNet | `dist/ai/YUNET-LICENSE.txt`, `dist/ai/NOTICE.md`. |
| SlimSAM, MODNet and U2NetP | `dist/ai/CUTOUT-NOTICE.md` and associated license files. |
| LaMa | `dist/ai/INPAINT-NOTICE.md`, `dist/ai/INPAINT-LICENSE.txt`. |
| Colorization model/conversion | `dist/ai/COLORIZATION-NOTICE.md`, `dist/ai/COLORIZATION-LICENSE.txt`, `dist/ai/colorization-manifest.json`. |
| LittleCMS / lcms-wasm | `dist/vendor/lcms/LICENSE.md`; bundled color profiles retain their own notes. |
| fflate | `dist/vendor/fflate-LICENSE.txt`. |
| Electron / Chromium | License files included in the packaged runtime; Electron is pinned by package-lock. |
| Fonts and demonstrations | See the license/notice files under `dist/assets/`; generated and public-domain samples are identified there. |

Additional npm dependencies retain the licenses in their distributions. Review `package-lock.json` for exact resolved versions. Optional ComfyUI checkpoints and MedSigLIP research weights are supplied separately by the user and are governed by their upstream terms. They are not relicensed or bundled by this repository.
