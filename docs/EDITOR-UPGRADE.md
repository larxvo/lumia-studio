# Editor tools upgrade (development branch)

Luma Studio is created by **Larx Vo · [vovinhlac.com](https://vovinhlac.com)** and is free to use.

This branch improves daily editing controls and introduces SVG tracing. It does not change the currently published Windows release.

## Layer controls

Every layer row has a lock/unlock button with an accessible state. A child locked by a group cannot override that parent lock. Position, pixel and transparency locks remain available in the Layers panel.

## Installed fonts

The Windows app reads font family metadata from Windows' installed font collection through a restricted native bridge. Font files are not uploaded. Both Character and Type Studio use this catalog, including Unicode family names.

Search the font field in Character. **Load / refresh system fonts** reloads the list after installing a font. In a supporting secure browser, this button requests Local Font Access. Browser permission and availability vary; imported fonts remain available.

## Language

**Edit → Language** offers Follow system, Vietnamese and English. Native menus use Windows' preferred languages. Other system languages fall back to English. Manual preference persists.

Document text, font names, layer names and project names remain user content. UI localization is being migrated into a shared catalog; complete translation coverage of all advanced panels is still pending.

## Tool behavior

| Tool | Interaction |
| --- | --- |
| Lasso | Hold and drag; release to close and commit. Choosing the tool does not create a selection. Ctrl+D clears a completed selection. |
| Crop | Choose Free, Original, a common ratio or A4; drag a separate crop draft. Enter applies, Escape cancels. W/H use source pixels. Drag inside to move; drag a corner to resize. |
| Brush / Eraser | Adjust size, hardness and opacity. Paint with pressure when available. One completed stroke is one Undo entry. Selection alpha clips both painting and erasing. |
| Clone | Alt-click a donor, release Alt and paint. Aligned controls whether subsequent strokes keep their source offset. Donors outside the image are skipped. |
| Healing | Alt-click clean texture and paint over the mark. Illumination correction samples a surrounding ring rather than the blemish center. |
| Dodge / Burn | Paint on a separate retouch layer; adjust size, strength, hardness and All/Shadows/Midtones/Highlights range. |
| Pen | Click corners, drag handles, click the first point to close or Enter to finish. Draft anchor Undo/Redo is separate from committed document history. |
| Text | Click to add text; double-click existing text to edit. The cursor is the text insertion cursor. |
| Other tools | Native tool artwork identifies the active canvas tool. The status bar gives its interaction hint. Space temporarily enables Hand. |

Canvas tool cursors use native CSS cursor images with aligned hotspots. They do not use a frame-following pointer overlay. The interface arrow preferences remain separate.

## Transparent image → editable SVG

1. Open a PNG/WebP and select its image layer.
2. Choose **Layer → Trace image → SVG paths**, or find the action with Ctrl+K.
3. Use Transparent silhouette for alpha outlines, or Color regions for opaque multicolor artwork.
4. Adjust threshold, detail, simplification and speckle removal.
5. Download SVG, copy its markup or add the paths as editable native layers.

The output contains real geometry, separate stable path IDs, compound holes and an original-size viewBox. It contains no embedded raster image. Outline mode and optional draw animation support further CSS/JavaScript animation; reduced-motion preferences are respected.

Tracing runs in a worker in the desktop app. New analysis settings invalidate previous results immediately. Adding native paths is atomic and supports Undo. Original raster pixels remain available, optionally hidden. Very detailed artwork may exceed the native layer/command limits; download SVG or increase simplification.

## Responsiveness

Brush painting reuses a small stroke scratch buffer, builds a selection mask once per stroke and serializes the finished stroke once. Hover overlays are batched by animation frame. Interactive previews use a bounded display resolution; final exports use the normal rendering path.

Only unchanged lower preview layers are cached. Cache tests cover clipping, groups, adjustments, image mutation, font changes and pixel equality against uncached rendering.

## Validation and limits

The automated suite includes native Canvas integration tests and a real Windows installed-font check. A small CPU preview benchmark reports its scene dimensions and frame count; it is not a universal speed guarantee.

Full GUI checks of the reconstructed implementation on Windows and large-photo stress testing remain required before release. The interactive test environment was unavailable during recovery. This branch is intentionally a draft until those checks and the remaining localization migration are complete.
