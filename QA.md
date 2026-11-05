# Luma Studio 9.0.1 — GitHub distribution

Current validation is recorded by GitHub CI and release reports. Historical results below retain their original version scope. Windows packaging smoke tests do not establish every interactive workflow, live Canva access or physical-GPU image quality.

---

# Luma Studio8.0 — Core verification

Verified2026-11-05. Current feature/limit map is [CORE-STUDIO.vi.md](CORE-STUDIO.vi.md).

- Full sequential suite: **397 passed, 0 failed, 0 skipped**,154.67s (`node --test --test-concurrency=1 tests/*.test.mjs`). After final alpha/channel UX, panel placement and icon changes, the affected Core8/Desktop UI suite passed **20/20** again. These are the same checks, not an inflated sum.
- New tests: inherited operation-specific locks and atomic subtree alignment/transform; unlinked mask movement/crop; exact world/local Bézier round trips; character-range diff/scaling; malformed input; alpha paint at50% without doubled opacity; Escape/Undo; independent Work Path; numeric and direct anchor edits; Type Studio run-preserving recolor, local Undo/Redo, Cancel/global Undo; valid example data.
- Sixteen actual binary PSD/PSB checks inspect header/plane/resource bytes; opaque/transparent named alpha; RAW/RLE/ZIP/prediction including truncation; empty transparent composite; fixed-point path records; distinct protection flags; native character ranges/paragraph metadata; native Gaussian/Unsharp descriptors and live reopen; unsupported filter blend/mask rejection to merged fallback. Native Canvas comparisons check pixel/alpha output. This does not constitute Adobe-app validation.
- Existing photo recipe fixtures now represent unlocked editable results. A new regression ensures a protected existing recipe remains previewable but cannot overwrite source pixels. Separate new retouch/cutout results clear inherited own lock flags while retaining the original source.
- Actual Chrome1364×936: sample, global menus, Type Studio range8–17 recolor kept Georgia144px/italic/tracking-6, local Undo/Redo; numeric path872→882 and document Undo restored872 after reselect; alpha preview and RGB return; lock-row layout; provenance/free edition. Screenshots are `qa/core8-desktop.png` and `qa/core8-type-studio.png`.
- A browser PSD export was observed before a long file-chooser stall reset the runtime. Source changes were recovered and all code/file tests above rerun. A browser downloaded-file reopen after recovery is not claimed. No private user photographs or document images were published as samples. The new poster is native vector/type data.
- Remaining limits: RGB8 working engine, font/filter rendering approximations, native Smart Filter subset only, PSD mask-link state/legacy path labels may differ. No native Canva, clinical skin classification, full CMYK16/32, RAW/HEIC, signed Windows installer or physical-GPU aesthetic benchmark was added.

## Previous verification history

# Luma Studio 7.2 — Desktop Workspace verification

Verified 2026-11-04. The four supplied reference images were compared with source implementation; they are not public assets. Detailed feature/status/menu map is in `DESKTOP-WORKSPACE.vi.md` (also available from Help).

- Full sequential suite: **367/367 passed**, 0 failures, 135.49s (`node --test --test-concurrency=1 tests/*.test.mjs`). After the final menu availability/keyboard and compact Help changes, the affected desktop/navigation/core UI suites passed **33/33**, including one additional menu test. There are **368 distinct passing checks** across these runs; a single final full-suite run of368 is not claimed.
- New native Canvas pixel checks cover all nine style families, Fill versus Opacity, effect independence at Fill0, disabled masks/density, Colorize, Levels output endpoints and channel banks, repeating patterns, open unfilled Bezier strokes and ungroup guards. UI checks cover aspect lock/masked transforms, Undo/Cancel, layer-tree filtering, live children, layouts, HEX/RGB, paths-to-selection and Select & Mask output.
- PSD/PSB round trips compare actual pixels for all nine styles with Fill, retain editable per-channel Levels/output endpoints and disabled masks, import Photoshop mask density, and preserve Colorize through a baked composite with hidden sources. ag-psd30.1 writes Levels green/blue in the opposite order to its reader/spec; the export adapter compensates and a channel-specific regression test checks this.
- Actual Chrome at1364×936: Photo/Design layouts, Window menu, expanded fx children, SV color dragging, Levels red output12→Undo0, independent histogram channel, Layer Style numeric opacity55, Cancel and channel preview were exercised. Screenshots `qa/desktop-7.2-menu.png` and `qa/desktop-7.2-styles.png` show the actual editor. The source retains the earlier public-domain/generated demos; private user screenshots were not uploaded as app assets.
- Channels is a preview; Paths lists vector shape paths and can convert closed paths into selections. Existing path-anchor editing, saved independent Work Paths, independent alpha-channel editing, per-part locks and unlinked masks are not claimed.
- New styles are Canvas approximations with the controls shown, not exact Photoshop style compatibility. Unsupported Photoshop Smart Filters still trigger the honest merged-document fallback. `.luma` preserves Luma controls. PSD/PSB/SVG render unsupported appearance into pixels rather than pretending those records remain editable.
- No new physical GPU inference, native Canva support, clinical skin classification, RAW/HEIC decoder or signed Windows installer was introduced. Print/large-image claims retain the measured limitations of7.0.

## Previous verification history

# Luma Studio 7.1 — current verification

- Complete sequential JavaScript suite: **331 passed, 0 failed, 0 skipped**, 194.7 seconds. After the final SVG download-link change, the six Art UI checks passed again, including one new test (332 distinct checks across these runs). Final targeted Art/ComfyUI and navigation suites also pass. Build/syntax/whitespace and packaged source-download integrity checks pass. No physical GPU quality claim is made.
- Seventeen actual CPU/Canvas variants were rendered from the generated photographic crab demo; source alpha, palette, vector paths and contour results were visually reviewed. Real dot/cross/square silhouette comparisons match the requested effect families; no user screenshot is shipped as a sample. Local poster/comic/watercolor/pencil/relief are image algorithms, not generative neural models. Source and prompts for the generated asset are in its NOTICE. See `qa/art-7.1-verification.json`.
- Actual Chrome preview ran the worker, changed a cross density80 →81, Ctrl+Z restored80 and Ctrl+Shift+Z restored81. Native Apply kept a hidden original and one separate result; reopening restored81. Downloaded PNG independently decoded at **1254 ×1254, pHYs11811 pixels/metre (~300 DPI)**, creator Software metadata present. SVG serialization and rasterization passed independent decoding checks with no embedded image/script. SVG download events timed out in this cloud browser even though the app prepared the file; a visible fallback download link is supplied and its actual Blob bytes are tested. Transport through this browser remains unverified for SVG, as for earlier .luma downloaded-file round trips.
- Tests cover deterministic tone-sensitive/rotated grids, inverse/silhouette/alpha gating, valid geometry-only native-size SVG, real transparency holes versus merged tiny palette islands, zero-master/source/alpha preservation, all five raster modes across native tile boundaries, premultiplied crossfades, cancellation, latest-preview wins, stale source rejection, one-time document-mask baking, saved source/mask/controls reopening and Smart Object transfer. The final download link is hidden after edits to avoid returning stale geometry.
- The ComfyUI Art graph uses **VAEEncode**, retaining the reference-image latent, instead of erasing the whole photograph with VAEEncodeForInpaint. Graph and local UI/HTTP mocks verify denoise, uploaded opaque reference pixels, style prompt, selected-layer geometry/visibility and output provenance. These are interface correctness checks, not an actual SD/SDXL run, GPU benchmark, identity guarantee or aesthetic score. Inference is bounded to a1024px long edge and upsampled; local pattern/paint outputs retain source dimensions subject to canvas/RAM capacity. Art/3D gives 2D illustrations; no GLB/OBJ/STL or inferred360° model.
- Vector detail uses an analysis grid up to1024px, a bounded mark/boundary count and approximate polygon simplification. This does not imply lossless vector reconstruction or Illustrator parity. Native Canva, clinical skin classification, RAW/HEIC, signed Windows packaging and physical GPU verification are not added in7.1. Read `ART-PATTERN.vi.md` for controls, formats and limits.

## Previous verification history

# Luma Studio 7.0 — current verification

- **315 passed, 0 failed, 0 skipped** in the full sequential JavaScript suite (117.4 seconds). After the final panel layout change, all five Scene UI integration tests also passed. Source-download packaging checks are rerun after assembling the release. Build, syntax and whitespace checks pass.
- Actual Chrome file chooser opened a **25,766,300-byte JPEG, 6000 × 4000 px (24 MP)**. Its working preview was 1600 × 1067; native source dimensions stayed 6000 × 4000. The real Scene worker applied Studio Auto in tiles, retained the hidden original and created a separate editable result. A second actual browser export was independently decoded as 6000 × 4000 RGBA, pHYs 11811 pixels/metre (approximately 300 DPI), Software `Luma Studio - Larx Vo - vovinhlac.com`. A 200 × 200 sample differed from source by about 10.45/10.48/10.43 mean RGB values. This is a seeded noise capacity fixture, not a photographic quality benchmark or universal hardware guarantee. See `qa/capacity-7.0-verification.json`.
- Browser Undo restored the large document to its single original layer. On the scene demo, a slider changed foliage hue 40 → 41, Ctrl+Z restored 40, and Ctrl+Shift+Z restored 41. Real browser preset/action previews, layer Apply/reopen, visible footer layout and branding were reviewed. Synthetic input and large browser exports remain outside source/public artifacts.
- Real local ONNX/WASM CPU DeepLab analysis ran on the generated park demo (not a camera photograph). The component-filtered region list was empty for its small figure; raw class labels nevertheless protected **1024 preview pixels**. This avoids silently dropping small person components, without making the model itself more accurate. The refined street-lamp hints found the two pale globes instead of the earlier bright canopy gaps. Six local variants and their unchanged alpha were inspected; metrics are in `qa/scene-7.0-verification.json`. The atlas and park sample are AI-generated assets with provenance notices.
- Checks cover zero-master exactness, untouched source/alpha, small semantic people, corrected region channels after saving/reopen, deterministic particles, photographic leaf tile continuity, cancellation, stale source rejection, native output size, document-space mask baking once, Smart Object recipe transfer, safe preset/action JSON, actual PNG CRC/pHYs, JPEG JFIF density and retained scan data, requested PSD/PSB PPI at 41 layers, and CMYK TIFF sorted tags/ICC/Software/DPI.
- The source and result remain 8-bit sRGB. PNG/JPEG/PSD/PSB density metadata sets print size, not new detail. ICC-based CMYK output still needs a suitable printer profile; the demo ICC is experimental. Browser canvas/decode/RAM limits, PSD format bounds, classic TIFF offsets, layer/model and archive-format limits still exist. Scene presets are editable 2D effects with color/connectivity region hints and optional local semantic people protection; they are not physical 3D relighting or validated scene generation. Native Canva, Lightroom .XMP / Photoshop .ATN import, RAW/HEIC and a signed Windows installer are not added. No physical GPU or ComfyUI generation quality pass is claimed.

## Previous verification history

# Luma Studio 6.9 — current verification

- **295 passed, 0 failed, 0 skipped**, 113.1 seconds in the final sequential JavaScript suite. Build and whitespace checks pass. This includes all existing PSD/PSB, ICC, Smart Objects, restoration, removal, wardrobe/beverage, landscape, collaboration and source-download tests, plus 20 new portrait/navigation/async workflow checks.
- Navigation has five stable sidebar entries and a header containing global menus, search, conditional Smart Object/collaboration actions, Save and Export. A real Chrome desktop viewport measured **1363 px**: header client/scroll width both **1363 px**, final export button right edge **1347 px**. No horizontal header overflow was observed. Mobile is outside this release's acceptance scope.
- Real browser checks exercised category chips, `mau ao` search, opening the wardrobe editor through its new card, Design Elements subtab selection, command search to the portrait sample, local ONNX recognition, one-click portrait auto, slider change, Ctrl+Z and Ctrl+Shift+Z, apply to a separate layer and reopening the saved controls. The reopened chin value was **19** and shine **62**. Properties displayed one tool launcher plus only the existing Retouch recipe editor. Source remained a separate hidden layer.
- Native verification on the public-domain **820×1024** portrait found **1 face / 478 landmarks** in **1012 ms**. Six variants were rendered; natural auto took **903 ms**, changed **45,519 pixels**, and all six results kept **0 alpha changes**. This is a real local CPU/WASM run, single thread, not a GPU result. See `qa/portrait-auto-6.9-verification.json`.
- The supplied private **1152×1536** portrait was also reviewed locally earlier in this task with natural auto, stronger oil reduction, face/chin and both brow directions. A hard transition near an excluded brow was found and corrected with smooth coverage and inward edge guards. That supplied photo and all its derivatives are excluded from source and deployment. The packaged native benchmark uses the public-domain fixture.
- New deterministic engine tests cover mild defaults, preserving unrelated parameters, stacking partial presets, pore detail in a synthetic highlight, protected feature pixels, flat skin, upright/tilted/non-square geometry, bounded displacement, another face left intact, alpha/source preservation, signed brow direction, legacy recipe validation, zero strength and a feathered selection applied once. These are isolation/behavior checks, not a diverse aesthetic-quality benchmark.
- Async/UI tests cover one auto click while detection is pending, cancellation and late detection, Undo during in-flight processing, stale result rejection, local history without changing document history, same-layer recipe reopen, reset to exact source, JSON portability, task/category search, legacy action discoverability, Design tab persistence, no-image state, contextual Properties, independent panel queries and Ctrl+K from a focused input.
- Only anonymous dimensions, parameters, timing and aggregate statistics are packaged. User photos, per-face coordinates, native/browser QA images and downloads remain outside the checkout. Shared runtime/model hashes and source ZIP CRC/bytes are verified during packaging.

## Current limits

One-click portrait is local appearance editing using skin masks and landmarks. The shine estimate cannot establish whether a highlight is oil or scene lighting. Sparse stubble reduction is not dense-beard reconstruction; dense removal and photographic beard generation retain their separate reviewed AI workflows. Strong contour sliders can deform background near the face. Output is capped at 8 MP with source retained. No Windows installer, native Canva editor, medical classifier or real GPU quality claim is added.

## Earlier verification history

# Luma Studio 6.8 — current verification

- Full JavaScript regression suite: **275 passed, 0 failed, 0 skipped**, about 117.7 seconds. Build and whitespace checks pass. This includes the 18 new landscape math / DOM-native Canvas workflow tests and all prior PSD/PSB, ICC, Smart Objects, portrait, cutout, removal, Paper, wardrobe/beverage, collaboration and source-download checks. No GPU run was performed; the new landscape processor uses deterministic CPU pixel processing and adds no models.
- The supplied landscape ran at **864×1536**. Native preparation took **219 ms** and four preset renders took **588–650 ms** each on this container, excluding PNG encoding. The default HDR chiều nhẹ preset raised the manually observed road median from **49.93 to 61.22 / 255**, and the dark-tree crop median from **4.50 to 6.29**. The cool-sky observation crop retained blue hue (mean RGB about **115.6 / 146.0 / 189.4** after processing). In the broad warm-cloud observation box, channel clipping ≥250 decreased from **17.34% to 15.86%**. The source contains clipped shadows/highlights; no actual missing detail was reconstructed. See `qa/landscape-6.8-verification.json`.
- All four preset results retained **0 alpha changes** and **0 changes to hidden transparent RGB**. Zero master and neutral controls are byte-identical. Sky-only blue controls leave the unselected exterior exact when all global controls are neutral; warm clouds are excluded from the cool-blue tint. Luma sharpening is bounded and attenuated on smooth sky/deep shadow. These checks do not guarantee halo-free or noise-free output at arbitrary slider extremes.
- The automatic sky hint covered about **53.25%** of this photo. Visual review of the native overlay showed the sky above the street, with dark wire/tree silhouettes excluded. This is a heuristic based on color/luminance/top connectivity, not a dedicated semantic sky model. There is no hand-labeled sky ground truth or diverse landscape benchmark. The manual observation boxes used for tone statistics are not segmentation ground truth or an aesthetic quality score.
- Real Chrome Worker test on the supplied photo: default one-click preset, sky overlay review, HDR rõ sâu, Ctrl+Z back to HDR chiều nhẹ and Ctrl+Shift+Z forward, Apply to a separate second layer, and reopening the source/mask/parameters were verified. Native PNG download decoded at **864×1536**. The app returned “Saved on device” after project Save; the cloud browser download-event waiter did not capture the `.luma` download within 10 seconds, so a downloaded-file browser round trip is not claimed. Portable `.luma` sources/masks/parameters validate in integration tests.
- New workflow tests cover four presets, exact original reset, grouped sliders, sky paint/reset/Undo, stable panning, moving the warm-light center, same-layer recipe update, latest-slider wins, an edit during initial preparation, stop/cancel/late responses, stale source, invalid inputs, selection/Smart Object rejection, nested Smart Object recipe transfer and downstream Paper consuming the current pixels.
- The private input, all derivatives, region statistics investigation images and browser downloads remain outside the repository, public `dist` and source archive. Only anonymous dimensions, settings, timing and aggregate measurements are packaged. The built-in landscape sample is labeled Canvas artwork and contains no user photo.

## Current limits

This is **single-image SDR HDR-look processing**. It does not merge exposure brackets, export HDR10, replace skies, create a real new light source, identify weather or recover clipped/defocused texture. The warm-light control enhances existing warm sky under a 2D emphasis region. Bright walls, water, reflections or unusual skylines can confuse the sky hint; paint corrections or disable sky-specific controls. No Windows installer, native Canva integration, medical classifier or new GPU claim is added.

## Earlier verification history

# Luma Studio 6.7 — current verification

- Full JavaScript regression suite: **255 passed, 0 failed, 0 skipped** in 108.1 seconds. After the explicit full-label rectangle option was added, the affected color engine and UI suite passed **24/24**, including the new rectangle review/Undo and opaque-lid mask tests. Build and whitespace checks pass. Existing PSD/PSB, ICC, Smart Objects, portrait, cutout, removal, Paper, collaboration and source-download tests remain passing. No real GPU was used.
- Real CPU/WASM **YuNet + SlimSAM** processed the supplied vest at **1147×1536** (analysis 765×1024). One chest click selected candidate 2 (index 1), score .9690, covering both sleeves and both vest fronts. Selection took about **13.6 s**, native mask preparation about **1.16 s**, and each of three colors about **342–415 ms** on this container. With global grading off, all three colors changed **0 exterior pixels**, **0 alpha pixels** and **0 detected-face-core pixels**. See `qa/color-6.7-verification.json`. This is one supplied photo with no hand-labeled mask ground truth, not a diverse garment benchmark or an identity analysis.
- Visual inspection found the raw SAM masks had soft probabilities on shirt/skin even when the main garment was correct. Confidence remapping before guided upsampling removes low-confidence leakage. Optional near-white protection reduced residual shirt tint in the demonstrated vest. This option must be turned off to recolor white garments. A face-aware penalty avoids the whole-person candidate when a detected face is present; failed/small/occluded face detection can still rank incorrectly. Three alternatives, positive/negative points, polygon and brush review remain necessary for hard cases.
- Real Chrome on the supplied vest: click → full garment candidate → Navy and Bordeaux; optional white protection; Ctrl+Z restored Bordeaux and Ctrl+Shift+Z restored Navy. Apply created a second layer; update on reopening retained two layers. Browser reload restored the saved source/mask/parameters from device autosave. Native PNG download decoded at **1147×1536**. `.luma` portable data is validated in DOM/native Canvas tests; the cloud browser's download-event waiter timed out on the long-name project Save action, so a downloaded-file browser round trip is not claimed. The UI did return “Saved on device”.
- Actual CPU/WASM **SlimSAM + LaMa** ran on a clearly synthetic 650×850 cup illustration. SAM silhouette IoU against the known synthetic mask was **.987** after correcting the illustration’s known lid mask. Dark-print proposal cleanup took **37.3 s**; a separately reviewed full-label rectangle took **36.1 s**. Both retained **0 changes outside the repair mask** and **0 alpha changes**. Four preset renders took about **253–419 ms** each. This is functional evidence on an illustration, not photorealistic quality verification on the earlier real cup photograph. The earlier unpublished workspace and its private cup QA images were unavailable after environment pruning; those previous results are not treated as final evidence for this code.
- The automatic dark-print proposal left faint small-text artifacts in the synthetic test. The explicit **Chọn kín khung nhãn** alternative selects the reviewed whole label including color print, at the cost of reconstructing a larger area. It is not automatic logo/OCR recognition. Either path can invent missing drink detail or leave artifacts; the user must review the mask and output. See `qa/beverage-6.7-verification.json`.
- Real Chrome Beverage worker also completed a reviewed full-label cleanup on the known-mask illustration. A separate uploaded graphic background replaced the original; Ctrl+Z restored the original background and Ctrl+Shift+Z restored the upload while retaining cleanup. This is UI/worker evidence on an illustration, not a real beverage-photo quality pass.
- Color recipes retain original source, native base mask and independent strokes (avoiding double grow/feather on reopen), reviewed ink mask/strokes, cleanup pixels, custom background and all settings. Tests cover zero amount/source equality, neutral processing, alpha/transparent RGB, source isolation, normalized blur without cup-colored halos, deterministic light/bokeh, stale source, latest-slider wins, cancel/late AI, mask/recipe bounds, Smart Object provenance and consuming Paper edits.
- Source photos, model investigation contact sheets, browser downloads and all private derivatives are outside `dist`, the tracked repository, deployment and source ZIP. The built-in vest/cup samples are Canvas illustrations with explicitly known masks, not user photos or model-quality evidence.

## Current limits

Garment selection uses prompt-based SlimSAM, not a dedicated fashion parser. Color processing preserves visible source shading; it cannot recover fabric detail from clipped black/white or occlusion. The garment workspace does not use its garment mask to replace the rest of a person with a background. Beverage backgrounds are graphic gradients or an uploaded photo; sun/bokeh/contact shadow are 2D effects. Transparent plastic retains source refraction/reflections. There is no new Windows `.exe`, real-GPU benchmark, native Canva document integration or medical classifier claim.

## Earlier verification history

# Luma Studio 6.6 — current verification

- Full JavaScript suite: **233 passed, 0 failed, 0 skipped**. Build and whitespace checks pass. The suite includes actual CPU/WASM model regression tests, DOM/native Canvas workflow tests, and pixel math tests; injected predictions in UI unit tests are explicitly synthetic. No real GPU run was performed.
- Main-subject stress check used an existing public-domain group portrait at 1280×853, with four touching people. Real CPU/WASM YuNet face boxes, DeepLab, global/local SlimSAM and LaMa ran. Face-assisted keeper selection took about 29.2 seconds; fill/texture about 22.9 seconds on this container. **129,511 protected pixels changed 0 pixels; all exterior pixels changed 0 pixels.** Two remaining semantic regions were selected. The photo, crops and derivative images are outside the source tree.
- **That crowded stress case did not pass photographic quality review.** Main face/body selection improved with face/torso prompts, but LaMa produced warped background and clothing/ghost artifacts when reconstructing most of the group. Exact keeper preservation and passing tests are not evidence of realistic hidden-scene recovery. UI flags large repair areas and optionally detects residual person semantics; no automatic aesthetic quality pass is claimed. Small/occluded faces, touching people and limbs can still need extra keep/remove points or brushes.
- Cutout now reopens an existing mask for replacement rather than intersecting a restoration with the old hole. Automated Canvas integration verifies a source-filled shoulder/arm-like hole becomes opaque after restore, survives Apply, and Undo/Redo restores the strokes/settings. Native guided refinement was exercised beyond one megapixel. Edge RGB decontamination preserves alpha and opaque pixels; source provenance is serialized with the result and embedded portably.
- Real Chrome preview ran the full hybrid cutout (DeepLab, MODNet and source-crop SlimSAM) on the bundled 820×1024 portrait. Visual review showed head, shoulders and crossed arms retained. Ctrl+Z restored an edge slider, PNG decoded independently as **820×1024 RGBA with alpha 0–255**, and Apply created a separate pixel layer with editable mask plus a hidden original. A browser-created central body mask hole was applied, reopened and restored from source: exported center alpha was 0 after Undo and 255 after restoration. Redo restored the recovery stroke. This is one portrait, not a diverse hair/body benchmark. The user's small cutout screenshots have missing pixels baked in; their intact original man photo was unavailable for an exact before/after regression.
- Paper processor ran independently on two supplied document photos at **1080×1589** and **1046×1504** with four presets. Paper shading/cast and existing ink contrast improved visually. One second-photo clean render plus PNG writing took about 1.54 seconds; four presets plus preparation/encoding took about 6.47 seconds. Source photos and all derivatives remain outside the repository/public deployment/source ZIP. Only anonymous dimensions/timings are in `qa/paper-6.6-verification.json`.
- Original smeared stamp contours remain smeared, rather than being replaced with the clearer stamp in another photo. No OCR substitution, seal/text/signature generation, inferred missing letters or cross-photo content replacement was performed. Residual paper shading and deep creases can remain. Four-point homography corrects perspective; it is not 3D page dewarping. Bounded sharpening/deconvolution can create halos at excessive settings.
- Real Chrome Paper worker: automatic clean, two slider key changes, Ctrl+Z to 81 / Ctrl+Shift+Z to 80, native PNG download decoded at **1000×1400**, Apply to a separate layer, and cached recipe reopening retaining 80 were verified. The public-facing demo is synthetic and visibly marked DEMO / no validity, without private document data. All three editors have bounded local history and late-response cancellation.
- Integration tests cover source-preserving recipes, stale-source rejection, same-layer update on reopen, zero-master exactness, alpha/transparent RGB, invalid quads/settings, perspective sampling, latest-slider wins, stop/late output, keeper precedence over brushes/dilation/feather, clothing vs automatic foliage hints, negative prompt ranking and model-footprint masking. Release ZIP CRC, exact source bytes/version, private-input exclusion, all shared model hashes and the five source-download tests passed.

## Current limits

The existing INT8 LaMa 512 model remains. More context and conservative masks improve control, not model capacity. A large removal can still look poor; foreground hidden behind a person cannot be known from a single photo. Keeper protection applies to the selected mask, not an inferred perfect human instance. Cutout recovery needs intact source pixels. Paper enhancement makes present pixels easier to inspect and does not certify unknown content. No new native Canva support, clinical skin classification, hosted GPU, Photoshop parity or physical GPU quality claim is made.

Reproduce with `node scripts/verify-subjects.mjs INPUT OUTSIDE_CHECKOUT_OUTPUT keep_x keep_y` and `node scripts/verify-paper.mjs INPUT OUTSIDE_CHECKOUT_OUTPUT`. `.luma` retains recipes; PSD/PSB retains supported appearance/layer data rather than these tool sliders. Session history has a soft buffer budget and is not saved as an undo stack. Mobile device/Safari, 16MP memory stress and the .luma downloaded-file browser round trip were not verified for this release.

## Previous verification history

# Luma Studio 6.5 — current verification

- Complete JavaScript suite: **214 passed, 0 failed, 0 skipped**. New product engine/recipe/UI checks: **18 passed**. Build and source whitespace checks pass. No GPU or Python companion changes are part of this release.
- Actual CPU/WASM SlimSAM selected a coin in a privately supplied 864×1536 photo, then refined the boundary on a crop from the source. Selection took about 25.3 seconds on this CPU. Native tone processing for full-scene and isolated outputs took about 364 ms together in the local script; these are device-specific timings, not a speed guarantee. No weights were added.
- The final native repair mask covered **15,937 pixels**. Product-only output changed **0 pixels outside the mask**, and both modes changed **0 alpha pixels**. Dimensions stayed 864×1536. Source, crops, masks, output and comparison images are excluded from the repository, public samples and source ZIP.
- On this one fixture, mean absolute red/blue channel difference within the mask changed from about 28.63 to 2.22, object luminance from 173.85 to 200.60, and scene luminance from 135.82 to 143.79. These are cast/tone measurements, not a percentage of tarnish removed, a photographic quality score or ground-truth restoration. Soft highlight compression can lower clipped output values; it does not restore information already clipped in the source.
- Visual QA inspected the complete scene and an aspect-preserving coin comparison. The coin was already defocused; the low-detail heuristic flagged it. Brown rim fragments, physical scratches, blurred lettering and selective material reflections can remain. Strong settings can look flat. Selection and aesthetic quality need a wider set of product photos and human review.
- Real Chrome preview: one click ran actual SAM global/local selection plus the product worker. Adjusting the clean slider updated the preview and blocked Apply until current. Exported PNG was independently decoded at **864×1536 RGBA**. Apply retained a hidden original and created a separate visible layer; later Update reused the same result layer. Browser autosave/reload retained source, mask and slider values. Cached recipe reopening showed the saved result immediately, and the low-detail warning persisted after Update/reopen. Footer layout and preview magnification were revised from observed browser issues.
- Automated checks cover exterior/alpha/transparent RGB equality, neutral and zero-master output, scene toggle, fractional selection applied once, cropped mask placement, brush/ellipse and erosion/feather, invalid masks/settings/recipes, portable JSON validation, unchanged source, geometry, Undo, cached reopen, latest-slider wins, cancellation/late results and stale source/selection rejection. UI tests explicitly inject SAM boundaries and use the real pixel engine; the local script and browser run real model inference.
- Cross-tool integration moves product recipes into native Smart Object content and consumes current pixels when switching to removal or portrait retouch, avoiding a stale previous recipe on the new output. Existing PSD/PSB, Smart Object, ICC, retouch, cutout, removal, source-download and collaboration regressions remain in the full suite. PSD/PSB retain supported appearance/layer data; product sliders require `.luma`.
- A `.luma` downloaded-file browser round trip was not verified in this cloud browser; JSON recipe serialization/validation and actual browser autosave/reopen are verified. Mobile responsive styles were implemented, but physical iPhone/Safari, broad photographic quality and real GPU performance have not been tested for this release.

## Current limits

Product retouch is mask-guided tone/cast processing. It does not classify metal chemistry, prove that an altered coin would be physically clean, synthesize exact missing lettering, recover defocus or reconstruct a 3D lighting scene. Directional shaping is a 2D tone gradient; contact shadows enhance existing nearby darkness. Global scene mode intentionally changes the surrounding image. Product-only mode preserves exterior source pixels. Each result recipe holds one product region; another click replaces that region. No native Canva, clinical skin accuracy, Photoshop parity or new physical-GPU/ComfyUI quality claim is made.

Reproduce local inference with `node scripts/verify-product.mjs INPUT_IMAGE OUTPUT_DIRECTORY normalized_x normalized_y`. Outputs must be outside the checkout. `qa/product-verification.json` contains only anonymized numerical checks.

## Previous verification history

# Luma Studio 6.4 — current verification

- Full JavaScript suite: **196 passed, 0 failed, 0 skipped**. Focused removal engine/math/recipe/UI checks: **16 passed** after final context-variant and memory changes. Build and source whitespace checks pass.
- Actual CPU/WASM DeepLab, global and close-up SlimSAM, and LaMa ran on a privately supplied 1152×1536 outdoor photograph. One click selected a person plus one nearby small-object proposal and triggered local fill automatically. The input image, derived masks, crops and output are not in the repository, public demo or source release.
- The final local fixture retained 1152×1536 output. It measured **0 changed pixels outside the effective repair mask**, **8,691 fully protected pixels with 0 changes**, and **35,368 changed pixels** within the repair area. Timing was about 32 seconds selection/refinement plus 18 seconds neural fill/texture composition on this CPU; timings depend on device and scene.
- These counts verify isolation, not correct scene reconstruction. Visual QA found that fragmented carried objects and dense leaf overlap require more careful mask cleanup; nearby cleanup was bounded and made optional. Tiny isolated green reflections were filtered. Fine occlusion seams, partially hidden objects and synthesized texture still require review. No claim is made that all foliage is semantically recognized or every hidden leaf is recovered.
- A separate automated real-LaMa test uses a known public-domain Wave image with a synthetic magenta intrusion. Masked error must decrease by at least 40%, output dimensions remain exact and every exterior byte remains unchanged. This is a synthetic regression with ground truth, not a diverse photographic quality benchmark.
- Tests cover empty/dilated mask borders, close-up coordinate placement, distant-region crop separation, foliage vs isolated green clothing/blue plastic, manual erase/keep precedence, optional nearby cleanup, donor exclusion, texture no-op/alpha, context changes, unsafe recipe rejection, original source, layer geometry, stale-input rejection, cancellation/late results, editable reopen, selection and Undo. UI tests inject outputs for workflow only; inference tests and the local script run real weights.
- Chrome preview completed an actual one-click selection and neural repair through browser workers on the supplied photo. Exported PNG was independently decoded at 1152×1536. Applying a separate layer retained the hidden source, and browser autosave/reload reopened the editable recipe with its saved result immediately visible. The final cached-reopen change passed all 5 UI tests. A browser `.luma` download event was not observed, so a downloaded-file browser round trip remains unverified; recipe serialization/validation is covered by automated tests. The editor keeps source images local; no private test photo is hosted in the release.
- Existing PSD/PSB, Smart Objects, ICC, portrait retouch, cutout, source-download and collaboration regressions remain in the full suite. No new model weights are added; no GPU or Python companion code changed.

## Current limits

This is not a guarantee of clean one-click output on every image. SlimSAM/semantic suggestions can miss or merge parts. Nearby-object, foreground-green and bright-strand hints can select incorrectly, especially green clothes, non-green foliage, shadows, reflections and strongly occluded fragments. Optional hull/nearby cleanup can include visible background details; inspect the mask, disable it or use the keep brush. LaMa may reconstruct soft, repetitive or incorrect structure; patch residual transfer does not prove historical or scene truth. Native Canva, Photoshop parity, clinical skin accuracy and actual ComfyUI/GPU quality remain outside this release's verified scope.

## Previous verification history

# Luma Studio 6.3 — current verification

- Full JavaScript suite: **179 passed, 0 failed, 0 skipped**. After final red-eye de-duplication, stable strand seeding and busy-state guards, the focused portrait math/engine/recipe/UI suite also passed **38/38**.
- Build and source whitespace checks passed. Source packager compiles. No Python companion logic or GPU behavior changed in 6.3; its prior 10-test result remains recorded below.
- Actual CPU/WASM YuNet + 478-point FaceMesh + six-class segmentation ran on the bundled 820×1024 public-domain portrait. Hair probability is retained as a separate class. All six portrait groups produced finite output; the neutral baseline was byte-identical. Skin, iris, hair and beard operations changed zero pixels outside their processing masks and changed no alpha bytes on this fixture.
- Red-eye fixture: synthetic red was placed inside the real detected iris geometry. **89/89 injected pixels** were corrected below R=80; the original portrait yielded **0 detected red-flash pixels**. Additional tests protect warm brown irises, white catchlights, selection exterior and alpha; overlapping auto/manual regions do not double-count. This is not a real-world sensitivity/specificity measure.
- Actual LaMa CPU/WASM ran on a 410×512 known portrait with a **procedurally simulated** full beard. The lip-protected mask covered 2,259 measured pixels; outside-mask changes and sampled lip-anchor changes were both zero. Masked MAE against the known clean portrait decreased from about 84.1 to 19.3 (about 77%). This is a synthetic functional regression, not validation of removing dense real beards or recovering hidden anatomy.
- Reproducible scripts and machine-readable reports: `scripts/verify-portrait.mjs`, `scripts/verify-beard-inpaint.mjs`, `qa/portrait-verification.json`, `qa/beard-inpaint-verification.json`. Contact sheets were visually inspected. Timing is specific to this CPU environment, not a GPU benchmark or a performance guarantee.
- Chrome preview: actual model recognition, face zoom, copper hair preset, red-eye action, beard controls and the Apply-retouch → Râu AI transition were exercised. Local LaMa completed a real browser-worker generation and enabled the review/apply step. ComfyUI-only beard/smile presets remain disabled without a checked connection; injected-output UI tests verify routing and saved provenance only.
- Recipe integration covers editable colors/styles, semantic hair PNG storage/reopening, manual eye-point persistence, original source, cancellation, stale-source rejection, selection preservation and Undo. Existing PSD/PSB, ICC, Smart Object, cutout, collaboration and source-download regressions remain in the full suite.

## Current limits

Local beard addition is procedural strand simulation. Hair/iris recoloring and studio retouch preserve source information; they cannot recreate invisible strands, pores, teeth or skin. Large local beard fills can be blurry or anatomically wrong. Profiles, occlusion, difficult lighting, varied skin tones and crowded groups need broader quality testing and sometimes brush refinement. No clinical disease accuracy, Photoshop parity, native Canva editing or physical GPU/ComfyUI image-quality pass is claimed for this release. User review remains necessary for generative predictions.

## Previous verification history

# Luma Studio 6.2 — current verification

- Full JavaScript suite: **164 passed, 0 failed, 0 skipped**. A subsequent focused cutout inference/math/UI regression also passed after distributed semantic prompts and cleanup/viewport fixes.
- Python local companion suite: **10 passed**; the cutout tools do not depend on this companion.
- Actual ONNX Runtime Web CPU/WASM inference (not mocked): U²-Net saliency, MODNet portrait alpha, MediaPipe hair × MODNet, DeepLab semantic regions and SlimSAM encoder/decoder with cached embeddings and foreground/background prompts ran on the bundled public-domain portrait. Masks were finite and nontrivial; all distributed person prompts were retained, preventing the centre prompt from collapsing to a tie-only region in that fixture. This is functional evidence, not a broad accuracy benchmark.
- New mask tests cover SAM crop/padding orientation, disconnected same-class region suggestions, fractional-alpha preservation, grow/erode, rotated/flipped mask coordinates, existing-mask intersection, stale input rejection, locked parents/layers, layer limits, multi-object copies, portable .luma state and Undo.
- Actual cutout masks round-trip through PSD and PSB with fractional native mask alpha, hidden source layer and visible output retained (1-byte rounding tolerance).
- UI tests use clearly marked injected outputs only for preview/apply/state behavior; real-model evidence comes from the separate inference test and browser run.
- Chrome preview ran actual portrait matting and point inference. Exported PNG was independently decoded at 820×1024: 398,592 fully transparent pixels, 30,977 partial-alpha pixels and 410,111 opaque pixels. Source layer was retained when a separate mask layer was applied. Viewport and semantic-prompt ambiguity were revised from observed browser issues.
- Complete source ZIP is reconstructed in a worker from a compact code ZIP plus SHA-256-verified model/runtime assets already hosted by the editor. Tests check standalone code/model contents and reject traversal, duplicates and altered assets. This removes duplicate weights from the deployment while retaining a full self-hostable download.
- New ONNX source bytes total 44,249,476; full and part hashes are recorded. Each hosted model/source part is bounded at 16 MiB. Full source download now supports up to 16 parts / 256 MiB; the Windows installer uses the same bounds.

## Current limits

This release does not complete Photoshop parity or native Canva editing. Semantic suggestions cover Pascal VOC categories and connected components, not guaranteed object instances. SlimSAM is prompt-based segmentation without arbitrary category naming. Portrait/hair inference has no diverse labeled quality evaluation; fine hair, difficult light, transparent/reflected objects and touching subjects may need manual correction. Source pixels are preserved; low-resolution mask inference does not recreate invisible hair detail. GPU quality and clinical validation remain unverified as documented in 6.1.

## Previous verification history

# Luma Studio 6.1 — current verification

- JavaScript suite: **151 passed, 0 failed, 0 skipped** (`npm test`).
- Python companion suite: **10 passed**. Includes real HTTP loopback authentication/origin checks, static path traversal rejection, cancellation ownership, unknown route rejection, quality abstention without model load, CPU refusal, similarity/abstention contract and three-case benchmark HTTP + pixel composition integration with clearly labeled test doubles.
- Three PowerShell files parsed successfully using official Microsoft PowerShell 7.6.9. This is syntax validation on Linux, not execution on Windows.
- Pinned transformers 4.57.1, Pillow 12.0.0 and NumPy 2.3.4 Windows CPython 3.13 wheels were retrieved successfully from PyPI for compatibility preparation; the Windows install has not been run here.
- Build, Python compile and source whitespace checks passed.
- Browser preview confirms the research tool is marked as research and remains disabled without a valid selection/local session. No local GPU endpoint is probed from the public web page.

## Material limits for this release

There is no physical CUDA GPU or installed PyTorch in this execution environment. No Windows GPU installation, MedSigLIP weights inference or real ComfyUI GPU quality run was completed. Do not report a hardware/model/quality pass from these tests. The owner has a Windows/NVIDIA machine; the delivered kit must run there and produce cuda-proof.json plus benchmark report/images before actual results can be reviewed.

Medical labels are semantic ranking using a local user-supplied model, not a clinically validated classifier. Thresholds, skin tone performance, OOD detection, sensitivity/specificity and clinical use are unvalidated. No model weights are bundled or downloaded automatically. Source weight identity is not independently certified; local hashes are retained for reproducibility.

Canva native is not implemented or enabled. The owner reports no Developer app/agreement; the source includes a technical scope brief for seeking an appropriate approved integration. File interchange remains as in v6.

## Previous verification history

# Luma Studio 6.0 — verification

## Current release checks

- `npm run build`: passed.
- `npm test`: **149 passed, 0 failed, 0 skipped**, including real CPU/WASM LaMa and ECCV16 inference inherited from v5.
- New tests exercise PPTX slide relationship order, real editable text rendering, SVG vector paths/text, rejection of executable XML and external image URLs, ZIP expansion limits, affine recovery against known pixels, transparent source holes, inward feather, guided Lab luminance/alpha/exterior preservation, appearance candidates and abstention, portable provenance, mask selection UI, source retention and Undo.
- ComfyUI adapter HTTP upload/queue/history/image exchange passes against a local fixture server. Hardware inspection tests distinguish CPU/GPU self-report and remove secret-bearing system fields. These tests do not constitute a live GPU image-quality result.
- Existing Smart Objects, ICC, PSD/PSB, retouch, source download and encrypted relay regressions continue passing.

- Browser preview: real skin segmentation completed on the bundled public-domain portrait; four candidate categories were shown and selection was enabled.

- Browser preview: the bundled SVG example imported through the visible UI as 3 text and 4 vector layers, 0 skipped, with a separate PNG comparison available. This sample is constructed by Luma, not an actual Canva export.

## Verification boundaries

PPTX/SVG import is partial, with explicit fidelity reports and a separate PNG-rendered SVG fallback where supported. Technical fixtures are not a broad corpus of real Canva exports. No native Canva API app has been approved or tested. No clinical disease classifier or diagnostic performance is claimed. Skin surface maps use segmentation plus local residual heuristics; their recall/precision has not been measured on a labeled diverse skin dataset. No real ComfyUI GPU endpoint or checkpoint was provided, so live GPU output quality is still unverified. The new UI can collect hardware/job/metric/manual-review evidence when an owner connects one.

Reference restoration is affine reference-pixel copying, not generative proof of historical truth. Guided color retains source L* within gamut constraints and uses an explicit chosen color. Neither guarantees unavailable original details.

## Prior release verification history

# Luma Studio 5.0.1 — verification

## 5.0.1 current verification

- `npm run build`: passed. Complete automated suite: **136 passed, 0 failed, 0 skipped**. The source was rebuilt after the collaboration collision fix.
- New tests use actual CPU/WASM neural inference for ECCV16 colorization and LaMa inpainting, on the bundled public-domain portrait. Results were finite; colorization retained luminance/alpha; masked neural fill preserved every exterior source byte. These are functional fixtures, not restoration accuracy benchmarks.
- Native Smart Object source resolution and affine placement remain unchanged at conversion. Shared updates and independent copies are tested. A full DOM/content-tab workflow edits a nested document, saves it into its parent and verifies parent Undo. Native PSD and PSB shared embedded content/affine geometry round trips are tested through ag-psd, including a flipped instance.
- LittleCMS actually opens the CMYK profile, separates RGB with its black-generation tables and converts back for the preview. Invalid/truncated ICC is rejected. TIFF tags, all four channels and exact embedded ICC bytes are checked. Pillow independently opens a generated CMYK TIFF with the exact ICC hash and 300 DPI.
- Collaboration tests cover concurrent different-property merges, deterministic same-field resolution, deletion vs stale edits, atomic rejection of unsafe image sources, large Unicode chunk transfer and signaling validation. A real local WebSocket server exchanges an encrypted multi-chunk document between two clients; the relay only sees ciphertext envelopes.
- ComfyUI adapter tests run a local HTTP fixture server and complete multipart upload, core inpaint graph submission, history polling and output download. **No GPU checkpoint or live ComfyUI machine was available**, so generated smiles/neutral expressions and generative skin editing are not quality-verified. The UI requires a checked connection and checkpoint before enabling these operations.

## 5.0.1 collaboration identity fix

When a guest already has an open document with the incoming shared ID (for example another tab restoring the same browser project), the original is retained under a new local identity and the received shared document opens separately. All existing Undo snapshots and open Smart Object content links are rebased to that retained local copy. Two integration regressions verify both behavior paths and prevent silently activating stale local content.

The public 5.0 deployment was verified in Chrome over HTTPS: the Production workspace loaded, text was converted to a Smart Object, its editable content opened in a separate tab, text changed and saved into the parent. The cloud browser still exposed no ICE candidates even over HTTPS; cross-network WebRTC remains unverified here. The encrypted relay has real two-client protocol coverage in the automated suite, but no hosted WSS relay or live GPU ComfyUI instance is bundled with the public static site.

## 5.0 browser verification

Chrome, approximately 1363×936, through the managed preview:

- Opened and visually inspected the new six-card Production workspace and its responsive two-column tools.
- Actual LittleCMS loaded in browser; CMYK profile preview completed with an explicit sRGB → CMYK → sRGB status.
- Opened the simulated old-photo fixture, ran neural colorization through the real module worker and inspected before/after. Applied a separate result layer; original remained as a hidden source layer.
- Toggled to repair, painted over a simulated scratch and ran actual LaMa in the browser. Preview completed and the selected scratch segment was filled. This is a deliberately simulated old-photo example, not evidence for faithful recovery of historical/water-damaged imagery.
- Tested the separate Generative skin tab, real local skin detection and honest disabled state until ComfyUI is connected.
- WebRTC signaling UI produced offers, but this cloud/HTTP preview provided no ICE candidates. The encrypted-relay browser flow correctly requires HTTPS/localhost because `crypto.subtle` is unavailable on the preview's HTTP origin. **Cross-network two-browser collaboration remains unverified in this preview**; actual encrypted relay protocol and merge/transport tests pass outside browser UI. Public/static hosting does not run the optional relay server.

## 5.0 explicit limits

No native Canva document editing, clinical skin disease classifier, native CMYK paint canvas, HDR, perspective Smart Object warp/Photoshop Smart Filters, identity-preservation guarantee, historically correct color guarantee, exact reconstruction of destroyed detail, hosted GPU or persistent collaborative cloud storage. Generative editing via ComfyUI is an actual client integration requiring the user's configured machine. Local LaMa has no text conditioning. Neural crops/models have lower sampling resolution than the final composite; upscaling is not new recovered detail. AI output is limited to 8 MP and keeps underlying source layers.

## Historical 4.0 verification record

The following sections describe the previous version's scope at that time. For current new capabilities, use the 5.0 sections above and PRODUCTION.vi.md.

## 4.0 checks

- `npm run build`: passed with the PSD/PSB adapter and shared CPU ONNX runtime.
- Full automated suite: **114 passed, 0 failed, 0 skipped**. After the final Retouch Lab UI change, all 5 photo-workflow integration tests and the real CPU inference test were checked again: **6/6 passed**.
- `git diff --check`: passed before packaging.
- The 18 photo-engine tests cover stable skin softmax; no-op/zero-strength identity; face/body/manual masks; additive/subtractive strokes; eye/lip protection; isolated-spot improvement; keeping dark spots; inpainting without source mutation; synthetic scratch error reduction; monochrome auto-level contrast; local eye deformation; preserving the open-mouth interior for lip-thickness-only edits; preset isolation; NMS; rotated landmark projection; recipe validation and resource limits.
- Five photo-workflow tests cover preview/Cancel without document/history changes; result/source visibility and opacity; Undo; reopening the same recipe layer; zero-strength return to original pixels; a saved local selection after deselecting; and stale-source rejection.
- A repeatable real ONNX CPU inference test runs all three face/skin models on the public-domain portrait fixture. It verifies one accepted face, 478 landmarks with sensible eye/mouth positions and nontrivial skin probabilities. A separate native CPU smoke check on Google's public segmentation fixture produced two accepted faces with 478 landmarks each. These are functional checks, not a general accuracy study.

## 4.0 browser QA

Chrome at approximately 1363×936, using the built static editor and real module workers:

- Opened the portrait sample through Filter. The CPU worker completed segmentation and landmark inference. The UI showed one face and about 7% processing-mask coverage on this image.
- Inspected the skin mask: face and exposed hands were included; landmark regions protected eye, lip and brow interiors. This observation is specific to the fixture.
- Switched to Face mode, focused the face and selected Thinner Lips. Preview showed the landmark overlay and lip parameter -38.
- Applied the result. The editor showed two layers, with the source hidden and result selected, plus an Edit Retouch action.
- Reopened the recipe. Face mode and lip parameter -38 were retained without rerunning detection.
- Cancelled and used Undo. The editor returned to one original, visible, locked image layer.
- Opened the simulated faded/scratched sample through Filter. Restoration presets and controls rendered, and preview completed without requiring neural inference.
- Visually checked the dialog and face-focused preview. A small full-image face view prompted focus/zoom/pan controls. Restoration hides unrelated face-detection status.

## 4.0 scope and unverified areas

- Neural models segment skin and locate facial geometry. The app does not diagnose/classify acne, freckles, psoriasis, age spots or other medical conditions. Defect reduction is heuristic pixel editing on a processing mask; results vary and must be inspected.
- Facial edits are local 2D inverse warps and brow-tone adjustment. They do not synthesize teeth, eyebrow hairs, missing lips or fully replace expressions. Extreme pose, occlusion and low resolution can fail. No demographic/clinical accuracy evaluation or comprehensive multi-face UI study was performed.
- Restoration is classical tone/noise/shading/scratch correction and neighboring-pixel fill. The old-photo demo is simulated; no validated real-world wartime/water-damage restoration corpus is claimed. Large destroyed areas and historically correct color recovery remain unsupported. Automatic neural colorization and generative reconstruction are absent.
- Recipe serialization and selection retention have automated coverage. Native browser download/reopen of a complete .luma recipe, every slider combination, long sessions, 8 MP memory stress, mobile/touch and every zoomed brush/pan edge case were not exhaustively tested.
- Processing stays local. First uncached face/skin use requires about 21.6 MB of models plus the shared ~14 MB WASM runtime. No comparative speed/RAM benchmark against Photoshop or PhotoCraft is asserted.

## Source packaging

The first publication attempt hit the host's 25 MB per-file cap because the complete source ZIP is about 32 MB. The full ZIP now lives under releases/. Public source-download parts are each at most 16 MiB and are reassembled into one ZIP by the browser. Part lengths and SHA-256 checksums (where WebCrypto is available) are checked. Three additional tests verify byte-exact reassembly, truncation rejection and integrity/path validation. Model assets remain complete; no inference service or model is removed.

## Retained 3.0 verification record


## Automated checks

- `npm run build`: **passed**. Browser PSD/PSB adapter and CPU-only ONNX runtime are prepared.
- `npm test`: **87 passed, 0 failed, 0 skipped** across model, native Canvas, PSD fixtures and DOM/canvas integration.
- `git diff --check`: run before packaging.

Coverage includes document validation, history branching/memory, curves/channel math, levels, masks, alpha/blends, crop, text/shapes, six editable templates, AI confidence-to-alpha, nested grouping, ID remapping/cycle prevention, locking, group opacity, pass-through adjustments, clipping, multi-alignment/distribution, snapping and precision transforms.

Advanced integration checks exercise group/duplicate/ungroup/Undo; live-filter preview/cancel/apply/Undo; actual Clone pixels on a separate paint layer while source layers remain unchanged; cubic Pen output; selection Add/Subtract; guide validation; all 16 adjustment controls; masked-group flips and valid selection after flatten; independent Undo entries for selection inversion and deselection.

Export regressions compare generated PSD/PSB round trips for hierarchy, clipping, masks, opacity and rendered pixels. Both pixel and editable modes retain group-mask output. Group effects are explicitly rendered and reopen with matching output. Other checks cover simple native text, supported native adjustments, complex-PSD fallback, SVG vectors/XML escaping, wrapped SVG text, clipped embedded-raster alpha, ZIP headers/CRC, bounded filter alpha and selection morphology against a neighborhood reference.

## Browser QA

### This 3.0 update

Real Chrome at approximately 1363×936:

- Loaded the built 3.0 workspace with saved Botanical Stories artwork.
- Shift-selected six actual shape layers and grouped them. The layer tree showed a real group with six children; the document changed from 13 to 14 nodes.
- Opened Live filters for that group, added Sepia, edited its amount and applied it. Properties showed `Live filters 1` and the group gained a filter indicator.
- Undo returned to `Live filters 0`; Redo restored the live filter.
- Visually checked workspace and filter dialog. Fixed a discovered horizontal-overflow defect; the final dialog displays preview, stack and numeric controls within its bounds. Short property panels now shrink to their content to leave more space for the layer tree.
- Confirmed the public deployment renders the 3.0 editor during final handoff.

### Retained 2.0 checks

The unchanged AI inference path was previously exercised in real Chrome:

- Opened a local image through the file picker and confirmed its document/layer.
- Real neural portrait inference produced a 256×256 mask spanning 0–1, with nontrivial foreground coverage (~44.3%) on Google's public MediaPipe fixture.
- Real neural object inference produced a 513×513 semantic person mask, with nontrivial foreground coverage (~31.1%) on the same fixture.
- AI Preview → Apply editable mask added a bitmap layer mask; Undo restored the original locked image without a mask.
- Design showed six previews and inserted the 13-layer Botanical Stories template with editable text and shapes.
- Temporary diagnostic pages and public test photographs were removed before publication.

These prior AI checks were not rerun for 3.0. They do not guarantee accuracy on other images or devices.

## Verification limits

- PSD tests use generated ag-psd fixtures. They do not establish compatibility with every real PSD/PSB or independently confirm Photoshop's own text/adjustment renderer. No large third-party PSD corpus was tested.
- Browser file downloads, imported-font round trips, clipboard gestures, touch/stylus input and every UI combination were not exhaustively exercised. SVG/ZIP structure and pixel operations have automated coverage; this is not an exhaustive export-app compatibility matrix.
- Retouch and Pen have DOM/native-canvas integration tests; detailed manual browser QA of every new retouch tool and Pen gesture is outstanding.
- CSS has responsive breakpoints. Mobile visual QA, accessibility audits, device benchmarks and memory profiling are outstanding.
- There is no benchmark establishing that Luma is faster or uses less memory than Photoshop or PhotoCraft. Canvas 2D and per-layer full-canvas surfaces have material limits.
- No universal lossless PSD claim, complete Photoshop parity, generative fill, CMYK/HDR/ICC, smart-object engine or collaborative backend is implied. README.md and FEATURES.vi.md list actual capabilities and resource caps.
