# Video Transform

> Pan, scale, rotate and skew a clip in 2D, with optional keyframe animation and motion blur.

## What this node does

Video Transform applies a 2D geometric transform to a single `COMFYTV_VIDEO`: translate, uniform scale, rotation, and horizontal skew. It can animate that transform with keyframes and add shutter-based motion blur so fast moves smear naturally.

This node is part of the FX chain. If the transform is the identity (no move, scale 1, no rotation/skew, no keyframes) it passes the clip straight through untouched. Otherwise, when it feeds a chain it emits an FX spec that renders with the rest of the chain in one pass; when a **track** input is connected it bakes and renders on its own via **▶ Run**. Output is `COMFYTV_VIDEO`.

To hand the result to a native ComfyUI node, insert a **Bridge** (`ComfyTV/Bridge`). See <https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md>.

## When to use it

- Reframe, resize, or straighten a shot.
- Push in / pull out or do a whip-pan with keyframes.
- Apply a tracked transform (via the `track` input) to stick a layer onto motion.

## Parameters

### pos_x / pos_y
Translation in pixels. Range `-8192`–`8192`, step `1`, default `0`. Positive `pos_x` right, positive `pos_y` down.

### scale
Uniform scale, `0.01`–`10.0`, default `1.0` (100%).

### rotation
Rotation in degrees, `-360`–`360`, step `0.5`, default `0`.

### skew_x
Horizontal skew (shear), `-2.0`–`2.0`, default `0.0`.

### motion_blur
Motion-blur strength, `0.0`–`4.0`, default `0.0`. `0` = off; higher values take more shutter samples across the move for smoother smear.

### shutter
Shutter angle / open duration for motion blur, `0.0`–`4.0`, step `0.05`, default `0.5`. Wider = longer smear.

### shutter_type
Where the shutter opens relative to each frame: `centered`, `start`, `end`, or `custom`. Default `centered`.

### shutter_offset
Extra shutter phase offset (used with `shutter_type` = `custom`), `-4.0`–`4.0`, step `0.05`, default `0.0`.

### keyframes
Advanced: JSON array `[{t, x, y, scale, rotation, interp}]` animating the transform. Normally set via the node's keyframe UI.

### video (input, optional)
The `COMFYTV_VIDEO` to transform.

### track (input, optional)
A `COMFYTV_TEXT` motion track. When connected, its keyframes drive the transform and the node renders directly (bakes the clip) instead of passing an FX spec down the chain.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | The transformed clip. |

## Tips

- With no transform and no keyframes, the node is a pass-through — it does nothing, which is expected.
- Motion blur only matters when the transform is actually moving (keyframes or a track); on a static transform it has nothing to smear.

## Related nodes

- **Video Composite** — the same transform, but merging a foreground onto a background.
- **Corner Pin** — free-form four-corner warp instead of pan/scale/rotate.
- **UV Remap** — arbitrary per-pixel warp driven by a UV map.
