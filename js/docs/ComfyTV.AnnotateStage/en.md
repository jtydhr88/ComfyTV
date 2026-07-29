# Annotate

> Draw on-screen boxes and grids, fill or mirror the borders, or scroll the frame — burned into the video.

## What this node does

**Annotate** overlays a chosen graphic onto the clip using ffmpeg draw/border/scroll filters. Pick a **mode** and its parameters; on ▶ Run it burns the result into a new video. It is a single-filter pass, not a drawing surface — you set numeric position/size rather than click on the frame.

Video in/out is `COMFYTV_VIDEO`. Bridge to native ComfyUI nodes via `ComfyTV/Bridge` — see https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md.

## When to use it

- Highlight a region with a colored box for a tutorial or review
- Overlay a reference grid (rule-of-thirds, safe areas)
- Fill or mirror black borders after a crop, or scroll the frame content

## Parameters

### mode
Which overlay to draw. Options: `box`, `grid`, `fillborders`, `scroll`. Default `box`. The other parameters shown depend on the mode.

### x / y (box mode)
Top-left of the box as a fraction of frame size, `0`–`1`, default `0.25`. Only used in `box` mode.

### w / h (box and grid)
Box size (box mode) or cell spacing (grid mode) as a fraction of frame size, `0`–`1`, default `0.5`.

### color (box and grid)
The line color. A hex string, default `#4ADE80`. Set with the color swatch on the card.

### thickness (box and grid)
Line thickness in pixels, `1`–`40`, default `3`.

### opacity (box and grid)
Line opacity, `0`–`1`, default `1`.

### border_mode (fillborders mode)
How the border pixels are filled. Options: `smear`, `mirror`, `fixed`, `reflect`, `wrap`, `fade`. Default `mirror`. Only used in `fillborders` mode.

### border_px (fillborders mode)
Border width in pixels to fill on all four sides, `0`–`512`, default `32`. Clamped to at most half the frame. Zero raises an error.

### scroll_h / scroll_v (scroll mode)
Horizontal and vertical scroll speed, `-1`–`1`, default `0`. Only used in `scroll` mode; both zero raises an error.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | The clip with the annotation burned in |

## Tips

- `box`/`grid` share color, thickness and opacity; `fillborders` uses border_mode + border_px; `scroll` uses scroll_h/scroll_v — the card only shows the controls for the active mode.
- The overlay is burned in permanently; keep an un-annotated version if you may need the clean plate later.
- `fillborders` is the natural follow-up to a crop that left black bars.

## Related nodes

- **Crop** — remove edges (fillborders can then fill what's left)
- **Paint Strokes** — freehand marks instead of a fixed box/grid
