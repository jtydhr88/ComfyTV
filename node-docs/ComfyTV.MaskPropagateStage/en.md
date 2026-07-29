# Mask Propagate

> Take a mask drawn on one frame and carry it across the whole moving clip.

## What this node does

**Mask Propagate** solves the motion between frames of your video and warps a single reference mask to follow it. You give it a first-frame mask image; on ▶ Run it tracks feature points frame to frame, fits a motion model, and re-projects the mask so it sticks to the moving subject or region — outputting a mask video for the full clip.

It needs two inputs: the source **video** (`COMFYTV_VIDEO`) and a **mask** image (`COMFYTV_IMAGE`) that matches the frame at `t_ref`. If no mask is wired in, it raises "Mask Propagate needs a first-frame mask image." The output is a `COMFYTV_VIDEO` mask. Bridge to native ComfyUI nodes via `ComfyTV/Bridge` — see https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md.

## When to use it

- You have a clean mask for one frame (from **Split Part**'s SAM output, Roto Mask, etc.) and want it across the whole shot
- Following a rigid or near-rigid subject that translates, scales, rotates, or skews
- Turning a still cutout into a moving matte without rotoscoping every frame

## Parameters

### model
The motion model fitted between frames. Options: `translation`, `similarity`, `perspective`. Default `similarity`. `translation` handles pure sliding; `similarity` adds rotation and scale; `perspective` adds skew/tilt for planar surfaces. Use the simplest model that matches the motion.

### t_ref
The timestamp (seconds) of the frame your reference mask corresponds to. Range `0`–`3600`, step `0.05`, default `0`. Set this to the time of the frame you masked.

### max_points
Maximum number of feature points used to solve the motion. Range `4`–`64`, default `24`. More points can be more robust but slower.

### invert
Invert the propagated mask. Boolean, default off.

## Inputs and outputs

| Slot | Type | Meaning |
|---|---|---|
| **video** (in) | `COMFYTV_VIDEO` | The clip to propagate across |
| **mask** (in) | `COMFYTV_IMAGE` | First-frame mask, matching the frame at `t_ref` |
| **mask** (out) | `COMFYTV_VIDEO` | The mask warped to follow motion across the clip |

## Tips

- The reference mask must line up with the frame at `t_ref` — a mismatch makes the propagation drift from the start.
- **Split Part**'s SAM mask output is a natural source for the first-frame mask.
- Propagation assumes a mostly consistent transform; heavy deformation, occlusion, or motion blur can cause slippage.

## Related nodes

- **Split Part** — produces a per-frame SAM mask to seed this node
- **Roto Mask** — draw the first-frame mask by hand
- **Motion Track** — solve motion as transform data (for pinning/compositing)
