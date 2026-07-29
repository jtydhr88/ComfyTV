# God Rays

> Volumetric light shafts (crepuscular rays) that radiate out from a point — like sunbeams through clouds or a window.

## What this node does

**God Rays** creates streaks of light that fan out from a source position by repeatedly scaling and fading a bright version of the frame toward that point. It produces the classic "shafts of light" look — sunbeams, divine light, a bright doorway.

This is a rendered stage — it needs a **▶ Run**. It uses a torch (GPU) backend. In goes `COMFYTV_VIDEO`, out comes `COMFYTV_VIDEO`.

To hand the result to a native ComfyUI node, insert a **Bridge**. See [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## When to use it

- Add sunbeams through trees, clouds, or a window.
- Give a bright light source a dramatic, volumetric glow.
- Sell an atmospheric, hazy, or heavenly mood.

## Parameters

### translate_x / translate_y
Each `-2000.0`–`2000.0` (step `1.0`), default `0.0`. Position of the light source that the rays radiate from, offset in pixels from center. Move these to place the "sun".

### scale
`0.2`–`4.0`, default `1.4`. How far each ray step reaches — larger values give longer, more spread-out shafts.

### rotate_deg
`-180.0`–`180.0` (step `0.5`), default `0.0`. Rotation of the ray direction, in degrees (positive is counter-clockwise).

### steps
`1`–`7`, default `5`. Number of radial sampling steps used to build the shafts. More steps = smoother, longer rays (and more compute).

### decay
`0.001`–`1.0`, default `0.3`. How quickly the rays fade with distance from the source. Lower = shorter rays; higher = longer, brighter rays.

### max_mode
Boolean, default `false`. When on, the rays are combined using a max (lighten) operation rather than the default additive blend — useful to keep highlights from clipping.

### mix
`0.0`–`1.0`, default `1.0`. Blend of the rays over the original frame. Lower to make the effect subtler.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | The clip with light shafts added |

## Tips

- Set `translate_x`/`translate_y` so the source sits on your actual light (a window, the sun) for a believable result.
- Combine with **Glow** for a bloom around the source plus radiating shafts.

## Related nodes

- **Glow** — soft bloom around bright areas (no directional shafts).
- **Old Film** — for a hazy, aged mood.
