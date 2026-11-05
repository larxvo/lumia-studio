# Autumn leaf sprites

`autumn-leaves-atlas.png` was generated for Luma Studio with the built-in image-generation tool on 2026-11-01. It contains AI-generated photographic-style botanical textures, not photographs collected from a third-party image library. No user photograph was used.

The original generated PNG was copied without pixel edits. Size: **1254 × 1254 px**, RGBA with actual transparent pixels. Atlas cells are **627 × 627 px**:

| Cell | Source rectangle | Leaf |
| --- | --- | --- |
| 0 | 0, 0, 627, 627 | Amber-orange maple |
| 1 | 627, 0, 627, 627 | Golden-yellow ginkgo |
| 2 | 0, 627, 627, 627 | Russet oak |
| 3 | 627, 627, 627, 627 | Golden birch |

Canvas inspection found **1,030,481 fully transparent pixels**, **541,582 pixels with partial alpha**, and four separate leaf silhouettes contained inside their cells. Thresholded alpha bounds retain at least 9 px padding from every cell boundary. Use the existing PNG alpha; do not treat the black background shown by some viewers as image content.

## Generation prompt

Use case: photorealistic-natural. A transparent RGBA 2×2 leaf sprite atlas for a professional photo editor's realistic falling-autumn-leaves compositing effect. Exactly one leaf centered and fully contained in each quadrant with clear transparent margins: amber-orange maple at top left; golden-yellow ginkgo at top right; russet-brown oak at bottom left; golden birch at bottom right. Macro botanical photography with natural fine veins, mottling, curled edges, small imperfections and complete stems. Slightly varied tilt/rotation, mostly front-facing. Neutral soft studio light. Actual transparent alpha. No cast shadows, ground, ambient background, printed checkerboard, labels, text, grid, borders, logos or watermark.

Generated once using the built-in tool; no CLI/API fallback, external model download, or manual image editing was used. Falling motion, perspective, depth-of-field, scene color matching and motion blur belong to the consuming renderer rather than this static atlas.
