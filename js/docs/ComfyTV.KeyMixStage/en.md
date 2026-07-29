# Key Mix

> Composite one clip over another through a matte — the "put the keyed subject on the new background" step.

## What this node does

Key Mix blends two videos using a mask: video A goes over video B wherever the mask is white. It's the classic mix/merge stage of a keying pipeline — after you pull a matte with a keyer, Key Mix uses that matte to lay the foreground onto a background. You choose how the alpha is combined (compositing operation) and how strongly the whole mix is applied.

Inputs and output are `COMFYTV_VIDEO` (the mask can be a `COMFYTV_VIDEO` matte or a `COMFYTV_IMAGE` still). It has a ▶ Run. Both video A, video B, and a mask are **required** — the node errors if any is missing.

## When to use it

- You keyed a subject and now want it composited over a new background clip.
- You have a matte (from Keyer/PIK/Select0r or a mask image) and two layers to merge.
- You need a specific alpha operation (over/add/subtract/max/min) between the layers.

## Parameters

### mix
Overall strength of the mix. Range `0.0`–`1.0`, default `1.0`. At 1.0 the mask fully drives the blend; lower it to dissolve the effect back toward B.

### invert_mask
When on, flips the mask so white becomes the area that shows B instead of A. Default off. Use it when your matte is the wrong way round.

### alpha_op
How A's alpha combines with the composite: `over` (default), `add`, `subtract`, `max`, or `min`. `over` is standard compositing; the others are useful for combining mattes or additive effects.

### Inputs (all required except as noted)
- **video_a** — the foreground, placed where the mask is white.
- **video_b** — the background, shown where the mask is black.
- **mask_video** — a matte video, or…
- **mask** — a still mask image (used if no mask video is wired).

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | A composited over B through the mask. |

## Tips

- White mask = show A; if your foreground and background look swapped, toggle `invert_mask`.
- A keyer's `matte` output plugs straight into `mask_video`.
- To interoperate with native ComfyUI nodes, insert a **Bridge**. See [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## Related nodes

- **Chroma Key** / **Keyer** / **PIK Keyer** / **Select0r** — produce the matte Key Mix consumes.
- **Matte Morphology** — clean up the matte edges before mixing.
