# 360 Stabilize

> Smooth out camera shake in 360°/equirectangular footage by damping rotation across the whole sphere.

## What this node does

This node stabilizes a 360 `COMFYTV_VIDEO` clip. It estimates the camera's rotation over time and smooths it, so the horizon and framing hold steady across the full spherical panorama instead of jittering. It requires a video input and raises an error if none is wired.

It has a ▶ Run (stabilization is computed on the backend). Input and output are both `COMFYTV_VIDEO`. To hand the result to native ComfyUI nodes, insert a **Bridge** — see the [bridge note](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## When to use it

- Steady handheld or drone 360 footage before reprojecting it to a flat shot.
- Lock the horizon in an equirectangular clip so VR playback isn't nauseating.
- Clean up jitter ahead of a **360 Projection** pass.

## Parameters

### smoothing
How many frames of motion to average over, integer 1 to 120 (default 15). Higher = smoother, more locked-down result that ignores fast intentional moves; lower = follows the camera more closely and removes only quick shake.

### strength
How much of the estimated correction to apply, 0.0 to 1.0 (default 1.0). 1.0 is full stabilization; lower values keep some of the original movement for a more natural feel.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | The stabilized 360 clip |

## Tips

- Stabilize first, then reproject with **360 Projection** — a steady sphere gives a cleaner flat extraction.
- Raise `smoothing` for a locked-off look; lower it if the footage has deliberate camera moves you want to keep.
- Back off `strength` below 1.0 if full stabilization feels unnaturally static.

## Related nodes

- **360 Projection** — reproject the stabilized 360 clip into flat, fisheye, tiny-planet, etc.
