# Luma Studio 9.0

Created by **Larx Vo · https://vovinhlac.com** · Free to use.

Windows setup, Canva Connect and verification details: [PLATFORM-9.vi.md](../../PLATFORM-9.vi.md). Build the installer with `npm run desktop:win`. Native Canva layer-tree editing offline and physical GPU photo-quality validation remain incomplete; the guide states the exact scope.

# Luma Studio8.0 — Creative essentials

**Created by Larx Vo · [vovinhlac.com](https://vovinhlac.com) · Free to use.**

Operation-specific layer locks, independently movable masks, real alpha channels, Work/Saved Paths with Direct Selection and Bézier-handle editing, and mixed character/paragraph typography now have actual canvas operations, Cancel/Undo and .luma persistence. Open **Help → Thử tính năng8.0** for an editable example.

The RGB8 PSD/PSB bridge reads/writes native alpha planes and path resources and retains compatible Gaussian Blur/Unsharp Mask Smart Object filters. Unsupported features use the saved composite with a notice. This is not full Photoshop parity. See [CORE-STUDIO.vi.md](../../CORE-STUDIO.vi.md) for controls and precise limits, and [QA.md](../../QA.md) for verification. This remains a desktop-oriented browser editor; native Canva, a signed Windows installer, full CMYK16/32-bit, clinical skin classification and physical-GPU aesthetic verification are not delivered.

## Previous release notes

# Luma Studio 7.2 — Desktop Workspace

**Created by Larx Vo · [vovinhlac.com](https://vovinhlac.com) · Free to use.**

The desktop dock now organizes Color / Swatches / Gradients / Patterns, contextual Properties, Navigator / Histogram / Info and Layers / Channels / Paths / History. Photo, Design and Retouch layouts and a Window menu keep global actions separate from task editors. Panel width/visibility preferences are local; document parameters stay in .luma.

New actual editing controls include Fill separate from Opacity, aspect-ratio lock, mask density/disable, per-channel Levels with output endpoints, Colorize and nine Canvas-native layer style families with preview, Cancel and Undo. Layers expose editable filter/effect children and embedded Smart Object badges. PSD/PSB export preserves supported settings or renders unsupported appearances; SVG embeds raster where needed. This does not add Photoshop Smart Filter compatibility, independent alpha/workpath editing or complete Photoshop typography/style parity.

See [DESKTOP-WORKSPACE.vi.md](../../DESKTOP-WORKSPACE.vi.md) for the detailed comparison against all four reference screenshots, menu map, controls and remaining work. This remains a desktop-oriented browser editor, not a signed Windows installer.

## Previous release notes

# Luma Studio 7.1 — Art & Pattern

**Created by Larx Vo · [vovinhlac.com](https://vovinhlac.com) · Free to use.**

Photo → art adds 17 local presets: halftone dots, cross grids, pixel silhouettes and geometric marks, genuine palette/contour SVG, pixel art, poster, comic, watercolor, pencil, voxel blocks and relief. Presets populate editable controls; source-preserving layers, subject AI/mask brushes, Ctrl+Z/Redo, .luma/Smart Object recipes and native PNG/300DPI remain available. Pattern/trace/voxel can export geometry-only SVG at 100% effect amount.

Four optional generative Art/3D illustration looks use actual reference-image img2img on a connected ComfyUI machine. They produce 2D images, not 3D meshes. Model inference is limited to a 1024px long edge, then upsampled; no physical-GPU quality pass is claimed. Local paint filters are algorithms, not generative neural models.

Open **Chỉnh ảnh → Preset & hiệu ứng → Art & Pattern** or search Ctrl+K. See [ART-PATTERN.vi.md](../../ART-PATTERN.vi.md) for controls/export/limits and [QA.md](../../QA.md) for measured verification. Previous 7.0 native-size/print features remain. No user screenshots are public assets; the new photographic crab demo is generated and credited in its notice.

## Previous release notes

# Luma Studio 7.0 — Created by Larx Vo

**[vovinhlac.com](https://vovinhlac.com) · Free to use.** A local-first browser photo and design editor. Application code is MIT; bundled third-party components retain their licenses.

Version 7.0 adds 13 editable studio/season/lighting/shadow presets, six ready actions, custom preset/action JSON, photographic leaf overlays, snow, sun/moon, reviewed lamp hints and source-preserving native-resolution scene recipes. Main image import no longer has a fixed MB/16MP/8192px cutoff or silently downsamples PNG/JPEG/WebP. Actual device/browser memory and format limits still apply. Print export adds adjustable DPI in PNG/JPEG/PSD/PSB, JPEG quality 100% by default, and author metadata; ICC-based CMYK TIFF remains available through Print Color.

**Chỉnh ảnh → Preset & hiệu ứng** opens the new tools. Presets populate sliders; Ctrl+Z/Redo, mask corrections, comparison, zoom and .luma recipes retain editability. These are Luma presets and parameter actions, not Lightroom .XMP or Photoshop .ATN import. Scene effects use 2D compositing plus actual local DeepLab people labels and editable sky/foliage hints. An optional ComfyUI handoff is included; no GPU quality pass or physical 3D scene reconstruction is claimed.

See [STUDIO-7.vi.md](../../STUDIO-7.vi.md) and [QA.md](../../QA.md). Verified on one Chrome device: synthetic 25.8MB JPEG, 6000 × 4000 px, native preset application, original retained and 300DPI PNG export. This is not a Windows installer or a guarantee of unlimited size on every machine.

## Previous release notes

# Luma Studio 6.9 — Task Workspace & Auto Portrait

The workspace now has five stable task entries: **Chỉnh ảnh, Thiết kế, Tệp, AI, Nâng cao**. Photo tools are grouped by task with category chips, accent-insensitive search, session recents and source-recipe resume buttons. Design has Template / Elements / Type subtabs. The header keeps global menus, search, Save and Export; Properties shows only relevant recipe editors. All former actions remain in the command palette.

**Auto chân dung** adds one-click mild cheek/jaw/chin slimming, adaptive shine reduction, eyebrow tone/thickness, sparse-stubble reduction and source-texture studio tone. Populated sliders, local Undo/Redo and portable version-1 recipes keep the adjustments editable. Strong contours may deform adjacent background; dense beard removal retains its separate AI workflow. Core processing runs locally; no new model or GPU service is added.

See [NAVIGATION.vi.md](../../NAVIGATION.vi.md), [PORTRAIT-AUTO.vi.md](../../PORTRAIT-AUTO.vi.md) and [QA.md](../../QA.md). This is a web editor with self-hostable source, not a Windows installer.

## Previous release notes

# Luma Studio 6.8 — Landscape Studio

One-click **HDR chiều nhẹ** opens visible shadows, rolls off highlights, adds bounded luma detail/vibrance, enriches cool sky and retains warm sunset clouds. Four editable presets, 17 sliders, source-based warm-light center, top-connected color sky hint with brush corrections, comparison/zoom, Undo/Redo, native-resolution PNG and editable `.luma` recipes are included. No new model weights or AI service are needed.

This is single-image **SDR HDR-look processing**, not exposure-bracket merging or HDR10 export. It does not invent missing texture, replace skies or recover clipped/defocused detail. Sky hints may need correction around bright objects, trees and skylines. See [LANDSCAPE.vi.md](../../LANDSCAPE.vi.md) and [QA.md](../../QA.md).

## Previous release notes

# Luma Studio 6.7 — Wardrobe Color & Beverage Studio

Click a garment and preview ten swatches or a custom HEX color while retaining source fabric shading. YuNet face-aware candidate ranking, confidence remapping, three SAM alternatives, positive/negative points, polygon/brush corrections and bounded Undo/Redo help review the selection. The supplied vest was checked with real CPU/WASM inference at native resolution. This is prompt-based selection, not a dedicated clothing parser.

Beverage Studio adds reviewed dark-print proposals and local LaMa cleanup, independent cup color, scene grading, uploaded/photo or graphic backgrounds, normalized background-only blur, 2D sun/bokeh/contact shadows, four editable presets and original-resolution PNG. Source, masks/strokes, cleanup, background and controls survive `.luma` saving and reopening. Transparent refraction and occluded details remain limited. No real GPU quality claim or Windows installer is added. See [COLOR-BEVERAGE.vi.md](../../COLOR-BEVERAGE.vi.md) and [QA.md](../../QA.md).

## Previous release notes

# Luma Studio 6.6 — Subject & Paper Studio

Keep a main person and remove remaining semantic people, refine missing parts with positive/negative keeper prompts, restore cutout pixels from the retained source, and undo tool settings/strokes locally. Person prompts use anonymous face boxes plus click/torso hints. Deep removal compares distinct context sizes, with protected keeper pixels and residual review. This is not a universal clean-removal guarantee for crowded or heavily occluded scenes.

Paper Studio adds one-touch local shading/color/crease reduction, existing text and red-ink enhancement, ten sliders, four manually chosen page corners, original-resolution PNG and editable source-preserving `.luma` recipes. No seal, signature or text generation/retyping. See [SUBJECT-PAPER.vi.md](../../SUBJECT-PAPER.vi.md) and [QA.md](../../QA.md).

## Previous release notes

# Luma Studio 6.5 — Product Studio

Click a coin/product to select it with local SlimSAM and automatically retouch its tone. Silver cast reduction, original-detail contrast, directional tone shaping and optional scene lighting have 18 editable sliders, mask brushes/ellipse, before/after, original-resolution PNG and an editable `.luma` recipe. Source pixels are retained in a separate layer. This does not recover defocused lettering, classify materials or provide a new physical-GPU benchmark. See [PRODUCT-STUDIO.vi.md](../../PRODUCT-STUDIO.vi.md).

## Previous release notes

# Luma Studio 6.4

Version 6.4 adds **Smart Remove**: click an unwanted person/object to select it with global/local SlimSAM and reconstruct the background automatically with local LaMa. It adds nearby small-item suggestions, optional occlusion cleanup, visible foliage/bright-strand protection hints, erase/keep brushes, context variants, editable `.luma` recipes and original-resolution PNG up to 16 MP. Only effective repair regions are composited; source pixels outside the mask stay exact. See **REMOVE-STUDIO.vi.md** and **QA.md** for limitations and measured verification. No new model weights or external AI service are needed.

Version 6.3 adds **Portrait Studio**: 42 editable presets, one-click red-eye correction plus manual eye taps, protected iris color, semantic hair recoloring, six procedural strand beard styles, stubble reduction, full lip-arc expression warps and studio frequency separation retaining original pore texture. Local LaMa can reconstruct a beard region; photorealistic beard generation and novel smile/teeth presets require a connected ComfyUI machine. See **PORTRAIT-STUDIO.vi.md** and **QA.md** for verified behavior and limits. Core editing and local models are free and run on CPU/WASM, loaded on demand. This release prioritizes Luma; native Canva integration remains deferred.

Subject Studio from 6.2 remains: foreground removal, semantic-region suggestions, SlimSAM point selection, MODNet portrait alpha, hair masks, refinement, eight cutout layers, editable masks and transparent PNG. See **SUBJECT-STUDIO.vi.md**.

Version 6.1 adds a Windows/NVIDIA local GPU install kit, authenticated loopback companion, actual CUDA tensor proof, three-mask ComfyUI benchmark, and an optional local MedSigLIP semantic research ranking UI. No clinical validation or live GPU quality pass is claimed; native Canva remains unavailable pending an approved scope. See gpu-kit/README.vi.md and gpu-kit/CANVA-NATIVE.vi.md.

Version 6.0 adds local PPTX/SVG editable interchange with fidelity reports, skin surface candidate maps, three-point reference patching, guided Lab color, and a ComfyUI hardware/known-image verification workspace. Open **Production** for the new tools. See **PRODUCTION.vi.md** for exact support and limitations. Native Canva API editing, clinical disease classification and a verified hosted GPU service are not included.


A free independent browser photo and design editor. Version 5.0 adds embedded editable Smart Objects, native supported PSD/PSB Smart Object interchange, LittleCMS ICC-based CMYK proof/output, real local neural colorization and inpainting, an optional ComfyUI generative editing client and two-person collaboration. Read **PRODUCTION.vi.md** for the complete new workflows, deployment requirements and limits. This remains an advanced beta, not full Photoshop or Canva compatibility.

Application code is MIT licensed. Bundled runtimes, fonts and neural models retain their own licenses. Read **FEATURES.vi.md** for the Vietnamese feature guide and workflows.

## Run and self-host

Node.js 22+ is required for the included local server:

```sh
node scripts/serve.mjs
```

Open `http://localhost:3000`. The prebuilt `dist/` folder can also be served by a static HTTPS host. Module scripts and workers require a web server; opening `index.html` with `file://` is unsupported. The source archive excludes Site identity, account configuration and credentials.

The full source ZIP contains the prebuilt editor and all model weights. Download support files are excluded from that ZIP to avoid recursive archives. To enable the in-app Source download on a self-hosted copy, run `python scripts/package-source.py`; it creates a complete release ZIP and smaller public parts that the browser automatically combines into one ZIP.

For development:

```sh
npm ci
npm run build
npm test
```

## Layered editing

- Multiple documents, image drag-and-drop and paste, new-canvas presets, crop, image size, canvas size and rotation.
- Image, paint, text, shape, adjustment and actual nested group layers. Group opacity applies to the combined group once. Normal groups isolate their children; full-opacity unmasked Pass-through groups share the outer backdrop.
- Shift-click range selection and Ctrl/Command-click individual selection; hierarchy-aware move, duplicate, delete, group, ungroup, reorder and merge. Search and filter layers by kind; collapse groups.
- 16 standard blend modes plus Pass-through for groups. Visibility, ancestor visibility/locking, opacity, clipping masks, pixel/group masks and separate layer styles.
- Multi-layer alignment, equal-gap distribution, persistent document guides, snapping to guides/canvas/peer bounds and precise uniform scale/rotation/translation. Flips and transforms move masks with content.
- Merge selected preserves adjacent, unlocked, Normal-blend siblings. Other combinations display a reason rather than silently changing their rendering. Styled, masked or partially transparent groups must be simplified before ungrouping. Pass-through groups must be changed to Normal before rasterization.

## Retouch Lab

Choose **Retouch Lab** in the header/rail or the **Filter** menu. The Vietnamese interface has **42 presets across six tabs**, before/after comparison, mask overlays, face focus, 200/400% zoom and drag-to-pan. Output is recomputed from the original source. See **PORTRAIT-STUDIO.vi.md** for the complete 6.3 workflow.

- **Skin (7 presets):** studio tone balancing, natural skin, small blemishes, freckles/age spots, fine wrinkles, red/flaky texture and mature skin. Six-class segmentation supplies face/body skin probabilities; landmark contours protect eyes, lips and brows. Frequency separation retains original pore detail while reducing uneven tone. Optional added grain defaults to zero. This processes visible texture, not clinical disease labels.
- **Facial features (11 presets):** eye size/width, lip thickness, mouth width/opening, the complete lip arc, asymmetric smile, neutral corners, brow thickness and density. YuNet plus FaceMesh V2 supplies 478 landmarks for up to eight faces. Local inverse warps use existing image pixels; generative smile/teeth options are separately available through ComfyUI.
- **Eyes (6 presets):** one-click red-eye correction and five iris colors, custom color, left/right/both, catchlight and pupil protection. Manual taps cover missed eyes, with a controlled radius and saved normalized points. Strong-red gating deliberately abstains when red flash is not detected.
- **Hair (6 presets):** chocolate, copper, burgundy, black, blonde and ash, plus custom color and lift. Semantic hair probability is retained from class 1 of the existing model. Brush correction and feature protection constrain the recoloring.
- **Beard (7 presets):** local stubble reduction plus six procedural strand styles: stubble, moustache, chin, goatee, boxed and full. Color, density, length, opacity and seed remain editable. This is a graphical simulation. The separate Râu AI workflow offers local LaMa beard-region removal and ComfyUI photorealistic styles; concealed skin is predicted.
- **Restoration (5 presets):** faded, monochrome, light water stains, small scratches/dust and archive tone. Neighbor-based repairs handle small defects; larger reconstruction and colorization are available in Generative Studio. No operation guarantees lost original details or historical colors.

Changes combine across six tabs. Presets reset their own tab's parameters. Applying creates a separate layer and hides the original; reopening updates the existing recipe. `.luma` retains source pixels, parameters, normalized eye taps, strokes, selection, 478-point landmarks and a compact face/body/hair probability image. Older recipes remain compatible. PSD/PSB and raster/SVG exports contain the rendered result; `.luma` retains the full editable recipe. Painting directly on result pixels detaches its recipe; Undo restores it.

Preview has a maximum side of 1000 pixels. Output is capped at **8,388,608 pixels**; larger originals remain embedded while the result copy is reduced. Layer geometry, opacity, filters and masks remain editable. Models load on demand and run locally on CPU/WASM; no new large model was added in 6.3. Optional ComfyUI sends inputs to the machine explicitly configured by the user.

Use **Filter → Ảnh mẫu · Retouch chân dung** or the simulated old-photo sample. The fixture is a public-domain Pete Souza / White House portrait, resized by Google's MediaPipe test assets. Quality checks are documented in **QA.md**; there is no diverse studio-quality benchmark or actual GPU quality pass for these new presets.

## Photo tools

**19 tools:** Move, rectangle selection, ellipse selection, lasso, Magic Wand, Crop, Brush, Eraser, Clone stamp, Healing blend, Dodge, Burn, Bezier Pen, Text, Shape, Gradient shape, Eyedropper, Hand and Zoom.

- Selection Replace/Add/Subtract/Intersect, connected Magic Wand with tolerance, inverse, feather, Expand/Contract, mask creation and manual mask painting.
- Clone and Healing blend sample with Alt-click. Retouch tools paint to a separate layer, respect selections and expose size, strength and hardness. Healing blend is a simple color-matched patch blend, not content-aware or Poisson reconstruction.
- Bezier Pen creates editable cubic path commands; click for corners, drag for handles, Enter or Finish to complete. Escape cancels. There is no individual-node editing UI after creation.
- **16 live adjustments:** Curves with individual RGB channels, Levels/histogram, Exposure, Brightness/Contrast, Hue/Saturation, Vibrance, Black & White, Temperature/Tint, Blur, Invert, Grain, Color Balance, Shadows/Highlights, Posterize, Threshold and Channel Mixer.
- **9 ordered live filters:** Sharpen, Unsharp Mask, Gaussian Blur, Pixelate, Median Noise Reduction, Emboss, High Pass, Vignette and Sepia. Add, toggle, reorder, remove and edit parameters, with preview and cancel. Up to 12 filters per layer, including groups. Gaussian blur uses a three-pass box approximation; median uses a fixed 3×3 neighborhood. Source image bytes remain unchanged.
- Shadow, glow and stroke on layers and groups, style copy/paste, editable gradient angle and radial/linear type.
- RGB/alpha channel previews and adjustment/filter bypass preview. These previews do not modify exports.

## Type and design

Editable text supports font, size, weight, italic, underline, line height, tracking, color, alignment and word wrapping. Local WOFF/WOFF2/TTF/OTF fonts can be embedded in `.luma` projects (up to 8 fonts, 2.5 MB each); users must have rights to share embedded fonts. PSD fonts may be substituted; SVG embeds imported fonts.

The Design rail contains six original editable templates: Botanical Stories, Objects of Desire, The Slow Edit, After Hours, Something Good and A Fresh Perspective. Filter by social, poster, story or presentation; search by name. Text, shapes and colors remain editable. Elements, typography presets and palettes have insertion/application commands.

This supplies a Canva-style design workflow. It does not open native Canva documents or connect to Canva accounts. Version 5.0 provides two-person collaboration inside Luma via WebRTC or a self-hosted encrypted WebSocket relay.

## Projects and output

- `.luma` keeps the full editor model, source images, fonts, hierarchy, filters, paths, masks and guides. Earlier Luma projects open in this version; older app versions cannot read all new layer types. History is session-only.
- PNG, JPEG and WebP exports at document resolution; SVG retains supported text/shapes/paths/groups and embeds rasters for clipping, styles and filters. Any live adjustment causes SVG to embed the finished composite. A toast reports SVG rasterization.
- Size-pack ZIP: original, square 1080×1080, portrait 1080×1350, story 1080×1920 and landscape 1920×1080. Fit pads, Fill crops, Stretch changes proportions; optional transparent/white/dark background. It does not rearrange design elements.
- PSD and PSB layered interchange; details below.
- IndexedDB autosave, recent documents, command palette, navigator, keyboard shortcuts and bounded Undo/Redo. Download `.luma` for portable backups; autosave is local to the browser/device.

## On-device AI

Both AI tools use ONNX Runtime Web in a CPU WebAssembly worker. Images and API keys are not sent to an inference service.

- **Portrait:** neural human foreground alpha matte, with threshold and edge-softness controls.
- **Objects:** DeepLab semantic segmentation for person, cat, dog, bottle, chair, car, plant, bicycle, bird, cow, horse or sofa.
- Preview, then apply an editable mask or load a selection. Existing masks are intersected; source pixels remain intact. Undo reverses application. Source/geometry changes invalidate pending results; cancellation stops the worker.

AI loads on demand. First portrait use downloads roughly 15 MB; object segmentation roughly 23 MB including the shared runtime. Current browsers need WebAssembly SIMD, Workers, OffscreenCanvas and ImageBitmap. GPU, accounts and paid inference credits are unnecessary. Mask accuracy and latency depend on the image/device; refine masks manually as needed.

Version 5.0 adds real local LaMa inpainting (~60 MB lazy model), ECCV16 colorization (~31 MB lazy model), and an optional ComfyUI prompt-edit workflow. The public static site does not include a free shared GPU or WSS relay. Classical presets and Magic Wand are ordinary algorithms, not neural AI.

## PSD / PSB compatibility

| Component | Import | Editable export |
| --- | --- | --- |
| RGB, 8-bit pixels | Separate layers, blends, opacity | Separate rendered pixel layers |
| Nested groups | Actual hierarchy, opacity, visibility | Native groups; group effects/filters become a rendered layer |
| Clipping | Native layer/group clipping flag | Native clipping flags |
| Pixel and group masks | Editable bitmap masks | Native masks; styled/filter-rendered groups have baked masks |
| Simple unrotated, single-style text | Editable, known font or Arial substitution | Native text metadata plus rendered preview |
| Curves, Levels, Brightness/Contrast, Exposure, Vibrance, Hue/Saturation, Invert, Posterize, Threshold | Supported settings stay live | Native records if all visible adjustments qualify and have no masks |
| Mixed/rotated/complex text | Saved raster | Rendered raster |
| Luma shapes, paths, styles and live filters | PSD vector masks/effects require merged fallback | Rendered pixels; not Photoshop smart filters |
| Supported embedded raster / PSD Smart Objects with affine geometry | Editable shared embedded content | Native placed layer + embedded PSD/PNG; shared instances |
| Warped/filtered/missing linked Smart Objects, PSD vector masks, unsupported blends/adjustments/effects | Saved merged preview, with a report | Rendered appearance; not native feature parity |
| CMYK, Lab, 16/32-bit | Rejected with conversion guidance | Unsupported |

PSD and PSB share the same resource limits. PSB support does not enable giant documents. Font metrics, adjustment math and some group blending differ from Photoshop; no universal lossless round-trip claim is made. Pass-through groups with opacity, masks, styles or filters use isolated compositing. Imported unsupported features require a saved merged composite.

If a visible adjustment cannot be exported natively, export retains hidden rendered source layers and adds the finished visible composite. Pixel export does the same for adjustments while retaining eligible groups/clipping and group masks. Keep `.luma` as the full-edit master.

## Resource limits and architecture

- ES modules, Canvas 2D, RGB 8-bit sRGB. No native Rust/wgpu engine or GPU tile cache. Editing remains sRGB. LittleCMS handles real ICC CMYK separation, round-trip print preview and ICC-tagged 8-bit CMYK TIFF export. No native CMYK painting, Lab/HDR or GPU tile engine.
- Canvas: 16,777,216 pixels, each side ≤8192 px, ≤150 layers. Large input images are resized with a notice.
- PSD/PSB export: ≤40 layers, ≤8 MP canvas, ≤48 million total layer pixels. Filters/retouch and full-canvas layer surfaces can consume substantial memory.
- Up to 50 guides; 100 anchors during Pen creation; 500 saved path commands.
- History: 40 snapshots and a 100 MB serialized-history target (at least two snapshots retained). Undo history is not included in `.luma`.
- Desktop workspace; responsive CSS does not imply a fully tested touch/mobile editor.
- No comparative benchmark establishes faster rendering or lower memory than Photoshop or PhotoCraft.

## Verification

`npm run build` and `npm test` are the repeatable verification commands. See **QA.md** for results, browser checks and unverified areas. Generated PSD fixtures exercise model and pixel round trips, not Photoshop itself.

## Source map and credits

- `dist/app.js`: commands, sessions, canvas gestures, menus and properties.
- `dist/pro-model.js`: hierarchy, multiselection, grouping, transforms and snapping.
- `dist/pro-ui.js`: advanced workflows, retouch, Pen, filter/export dialogs.
- `dist/filters.js`, `dist/pro-export.js`: pixel filters, SVG and ZIP encoding.
- `dist/model.js`, `dist/renderer.js`: validation, history and recursive compositor.
- `dist/workspace.js`, `dist/templates.js`: design library and AI UI.
- `dist/photo-lab.js`, `dist/photo-settings.js`: photo workflows, presets and recipes.
- `dist/portrait-engine.js`, `dist/photo-client.js`, `dist/portrait-worker.js`: pixel processing and cancellable workers.
- `dist/face-geometry.js`, `dist/face-inference.js`, `dist/photo-recipe.js`: neural preprocessing, regions and recipe validation.
- `dist/ai.js`, `dist/ai-worker.js`: subject inference and mask conversion; `dist/ai/NOTICE.md` records model provenance and hashes.
- `src/psd.js`: ag-psd adapter bundled into `dist/vendor/psd.js`.
- ag-psd and ONNX Runtime Web: MIT; portrait/DeepLab models: Apache-2.0; Inter: SIL OFL. Included license notices remain applicable.
- Sample artwork: Hokusai's The Great Wave, public domain, via Wikimedia Commons.
- Portrait fixture: https://storage.googleapis.com/mediapipe-assets/portrait.jpg ; Pete Souza / White House, U.S. public domain. Original attribution: https://commons.wikimedia.org/wiki/File:President_Barack_Obama.jpg . Facial/skin edits in this app are user-created modifications, not part of the original photograph.
- YuNet: MIT. Face Mesh V2 and Selfie Multiclass: Apache-2.0. Exact model URLs, conversion provenance and SHA-256 checksums are in `dist/ai/NOTICE.md`.
- Research reference: https://github.com/storytold/photocraft. This project includes no PhotoCraft application code or branding, and no proprietary Photoshop code.

## Version 5.0 implementation

`smart-objects.js`, `advanced-ui.js`: editable embedded documents and print workflow; `color-engine.js`: LittleCMS/ICC and baseline CMYK TIFF. `neural-worker.js`, `neural-models.js`, `neural-math.js`, `colorization-math.js`: validated lazy model assets, color science, contextual crop and outside-mask preservation. `comfy-client.js`, `generative-ui.js`: actual upload/queue/history/output integration, masks and isolated results. `collaboration-core.js`: property registers, validation and chunking. `collaboration-relay.js`, `scripts/collab-relay.mjs`: client AES-GCM and optional opaque WebSocket relay. `collaboration-ui.js`: direct/manual signaling and relay room UI.

Self host with `npm ci`, `npm run build`, `npm start` (localhost:3000). For public relay deployment, use a HTTPS/WSS reverse proxy, set exact allowed origins with `LUMA_ALLOWED_ORIGINS`, and retain the Node process. The Sites deployment serves `dist` statically and does not execute that Node process. Never expose an unauthenticated ComfyUI instance directly to the Internet; provide your usual gateway/access control.

Colorization model upstream BSD-2-Clause; LaMa Apache-2.0; LittleCMS/WASM MIT; bundled Amethyst ICC CC0 and experimental. See exact model/profile provenance in `dist/ai/*NOTICE.md` and `dist/color/NOTICE.md`. Weight-only color-model quantization retains float32 compute.

Patch 5.0.1 preserves an existing local tab, Undo history and open Smart Object content links when joining a shared document with the same project ID.

The public Source code download assembles a complete standalone ZIP on demand in a worker, reusing the editor’s hosted model/runtime files rather than shipping duplicate weights. The Windows local kit also restores and verifies these shared assets.
