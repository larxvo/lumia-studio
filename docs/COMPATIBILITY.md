# Compatibility and current boundaries

This matrix describes implemented behavior. It is not a claim of complete Photoshop, Lightroom, Illustrator or Canva compatibility.

| Area | Supported behavior | Boundary |
| --- | --- | --- |
| Native project | `.luma` layers, masks, supported recipes, paths and history snapshots | Preserve the original input alongside projects. |
| Image import | PNG, JPEG, WebP, GIF and BMP through browser decoding | Animated inputs are not a full timeline editor; RAW/HEIC have no dedicated decoder. |
| Large images | No fixed MB cutoff on normal image import; original compressed source retained where supported | RAM, canvas allocation, format limits and individual tools determine practical capacity. |
| PSD/PSB | RGB 8-bit pixel layers, groups, supported blend/opacity settings, pixel masks, alpha and paths | CMYK and 16/32-bit PSD editing are not implemented. Complex files may require a saved composite. |
| Text | Editable supported character runs and paragraph metrics | Missing fonts and layout differences can alter wrapping/appearance. Complex type can rasterize. |
| Smart Objects | Supported embedded raster/PSD content, replace/edit content | Arbitrary perspective/warp and unsupported linked formats are not live equivalents. |
| Smart Filters | Gaussian Blur, Unsharp Mask, High Pass and Invert under supported conditions | Normal blend, full filter opacity, no separate filter mask; supported radii/transforms only. Luma kernels can differ. |
| Layer styles | Editable Canvas effects and PSD appearance fallback | Controls and rendering do not reproduce every Photoshop effect record. |
| Canva | OAuth connector, design search, open original in Canva, import exported page, upload edited image | Original native elements remain in Canva. Imported PNG is flattened; no offline `.canva` parser or complete two-way layer sync. |
| PPTX/SVG | Supported shapes, text, images and paths as interchange | Masters, effects, advanced SVG constructs and some layouts are limited. Read the import report. |
| Print | Native-size PNG/JPEG with DPI metadata; flattened CMYK TIFF with an ICC profile through LittleCMS | DPI does not add detail. Use the print provider's profile. The editing engine remains RGB 8-bit. |
| Presets/actions | Editable Luma presets, parameter actions and custom JSON | Lightroom `.xmp` and Photoshop `.atn` import are not implemented. |
| Art/3D | Raster looks and supported geometric/vector exports; optional generative illustration | 3D-style output is a 2D image, not a recovered mesh or GLB/OBJ file. |
| GPU AI | User-configured ComfyUI, CUDA probe and a known-image benchmark | No bundled GPU server, universal quality certification or guaranteed recovery of lost historical detail. |
| Skin tools | Region detection and cosmetic retouch; separate experimental research module | Not a clinical diagnostic system; research weights are not bundled. |
| Windows | x64 Electron package and NSIS setup/removal | Unsigned. Review the per-release CI and installation report. No macOS/Linux native installer is currently released. |

## Quality control for edits

Review masks at 100%, especially hair, fingers, transparent edges and overlapping people. Keep/remove prompts and source-restoration brushes are available because automatic selection can miss pixels. Inpainting reconstructs plausible missing content; pixels hidden in the original cannot be verified without reference material. Blurred text or seals cannot be guaranteed to recover their exact original characters.

## Verification levels

1. Unit/DOM/pixel fixtures establish behavior under the checked inputs.
2. CPU/WASM inference establishes that the bundled models load and run on the tested environment.
3. Windows install/removal smoke tests establish packaging behavior on the reported runner; they do not establish every UI workflow on every PC.
4. CUDA proof establishes the checked compute operation, not photographic quality.
5. Generative quality requires actual jobs plus visual review on a representative dataset. This broad assessment remains incomplete.

Historical reports live in `qa/` and `QA.md`. Their version and scope matter. A previous successful run is not a new certification for unrelated changes.
