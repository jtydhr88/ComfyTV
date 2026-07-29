# Spot Remover

> Cover a fixed rectangular spot — a logo, wire, or blemish — by blending or inpainting it away.

## What this node does

**Spot Remover** removes whatever sits inside a rectangular region you define, across the whole clip. You set the box (position and size as fractions of the frame) and a removal method; on ▶ Run it fills the region — either by blending in the surrounding edges or by inpainting — and outputs a new video.

Video in/out is `COMFYTV_VIDEO`. Bridge to native ComfyUI nodes via `ComfyTV/Bridge` — see https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md.

## When to use it

- Remove a static watermark, logo, or timecode burn-in
- Erase a stationary wire, rig, or dead pixel
- Clean up a fixed blemish that stays in the same spot

## Parameters

### method
How the region is filled. Options: `edge_blend`, `inpaint`. Default `edge_blend`. `edge_blend` smears the surrounding edges inward — fast, best over flat backgrounds; `inpaint` reconstructs plausible content — better over texture, slower.

### rect_x / rect_y
Top-left of the removal box, as a fraction of frame size. `0`–`1`, default `0.42`.

### rect_w / rect_h
Width and height of the box, as a fraction of frame size. `0.01`–`1`, default `0.16`.

### feather
Softness of the box edge, `0`–`1`, default `0.15`. Higher blends the patched region more gently into the surroundings.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | The clip with the boxed region removed |

## Tips

- The box is fixed across the clip — it targets things that don't move. For a moving object, use **Paint Strokes** over a short window or split the shot.
- Keep the box just big enough to cover the target; oversized boxes erase good pixels.
- Over flat/gradient backgrounds `edge_blend` is usually cleanest; over busy texture try `inpaint`.

## Related nodes

- **Face Blur** — auto-detects and obscures faces instead of a fixed box
- **Paint Strokes** — freehand clone/blur for moving or irregular fixes
- **Erase** — mask-driven object removal
