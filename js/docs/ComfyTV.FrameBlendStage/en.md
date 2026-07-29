# Frame Blend

> Blend neighboring frames together for motion trails, echo, or motion-blur — like frame-blending / motion blur in a compositor.

## What this node does

**Frame Blend** combines each output frame with its temporal neighbors. It has two modes:

- **window** — averages (or min/max/sum/product) a window of frames around the current one, optionally with a decay weighting. Good for motion trails, ghosting, and long-exposure looks.
- **shutter** — simulates a virtual shutter by sampling and averaging within a time window, producing smooth synthetic motion blur.

This is a rendered stage — it needs a **▶ Run** (torch/GPU backend) and requires a connected `video`. In goes `COMFYTV_VIDEO`, out comes `COMFYTV_VIDEO`.

To hand the result to a native ComfyUI node, insert a **Bridge**. See [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## When to use it

- Add motion trails or echo to moving subjects.
- Fake a long-exposure / light-trail look.
- Add smooth motion blur to a clip that was rendered without it.

## Parameters

### mode
`window` or `shutter`, default `window`. Selects which set of controls below is used. The `window`/`shutter` mode ignores the other mode's parameters.

### Window-mode parameters
Used when `mode` is `window`.

- **frame_min** `-60`–`0`, default `-5` — first frame of the blend window, relative to the current frame (negative = earlier frames).
- **frame_max** `0`–`60`, default `0` — last frame of the window, relative to the current frame (positive = later frames).
- **interval** `1`–`10`, default `1` — step between sampled frames in the window; `2` uses every other frame, etc.
- **operation** one of `average`, `min`, `max`, `sum`, `product`, default `average` — how the sampled frames are combined.
- **decay** `0.0`–`1.0`, default `0.0` — weighting falloff so more distant frames contribute less (`0.0` = equal weight, i.e. no decay).

### Shutter-mode parameters
Used when `mode` is `shutter`.

- **shutter** `0.0`–`8.0` (step `0.05`), default `0.5` — shutter angle / open time; larger = more motion blur.
- **shutter_type** one of `centered`, `start`, `end`, `custom`, default `centered` — where the shutter window sits relative to the frame.
- **shutter_offset** `-8.0`–`8.0` (step `0.05`), default `0.0` — shifts the shutter window in time (used with `custom`).
- **divisions** `1`–`64`, default `10` — number of sub-samples taken across the shutter window; more = smoother blur, slower render.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | The frame-blended clip |

## Tips

- For classic motion trails, use `window` with `frame_min` negative and `frame_max` `0` so it looks back in time only.
- For smooth motion blur, use `shutter` and raise `divisions` if you see stepping in the blur.
- `interval` above `1` skips frames — handy for a stroboscopic trail.

## Related nodes

- **Glow** — for a bloom, not a temporal trail.
- **Old Film** — for temporal flicker rather than motion blending.
