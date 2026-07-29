# Paint Strokes

> Paint clone, blur, or color strokes directly on the video to retouch or reveal, over a time window.

## What this node does

**Paint Strokes** lets you draw brush strokes on the node's video preview; on ▶ Run it applies them to the clip over a chosen time window. Each stroke has a brush **mode** — clone (paint in offset pixels to cover something), blur (soften an area), or color (paint a flat color) — plus radius and hardness. An optional second video can be used as the reveal source that clone/reveal strokes paint from.

Video in/out is `COMFYTV_VIDEO`. A second optional `COMFYTV_VIDEO`, **reveal_video**, supplies pixels for reveal-style painting. Bridge to native ComfyUI nodes via `ComfyTV/Bridge` — see https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md.

## The on-node editor

The card overlays a paint canvas on the video:

- Pick a brush **mode** (clone / blur / color) and set **radius**, **hardness**.
- Clone mode uses an offset (**dx**, **dy**); blur uses **sigma**; color uses a **color** swatch.
- **Press and drag** to paint a stroke; pen **pressure** is captured per point when available.
- **Undo** removes the last stroke; **Clear** wipes them all.

You must draw at least one stroke before running, or the node raises "draw a stroke on the node first."

## Parameters

### strokes
The painted strokes, stored as JSON — each entry has `mode`, `points:[{x,y,p}]`, `radius`, `hardness`, and mode-specific fields (`dx,dy` for clone, `sigma` for blur, `color` for color), plus optional `life_start`/`life_end`. Written by the on-node editor as you paint. Default empty.

### t_start / t_end
The time window (seconds) the strokes apply over. `t_start` `0`–`3600` default `0`; `t_end` default `-1` (end of clip), range `-1`–`3600`, step `0.05`.

### video (input)
The clip to paint on.

### reveal_video (input, optional)
A second clip used as the source for reveal/clone painting. Leave empty for in-clip clone.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | The clip with the painted strokes baked in |

## Tips

- Strokes are drawn at fixed positions; they do not track motion. For a moving fix, keep the window short or split the shot.
- Clone with a small **dx/dy** offset to cover a spot with nearby clean pixels; use **reveal_video** when the clean pixels come from a separate plate.
- Higher **hardness** gives a crisper brush edge; lower blends more with the surroundings.

## Related nodes

- **Spot Remover** — box-based removal of a static spot/wire
- **Face Blur** — auto-detects and obscures faces
- **Roto Mask** — draw a matte instead of painting pixels
