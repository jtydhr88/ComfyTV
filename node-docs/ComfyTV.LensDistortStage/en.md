# Lens Distort

> Add or remove barrel/pincushion lens distortion using real camera-lens models — the same math VFX tools like Nuke and 3DEqualizer use.

## What this node does

This node warps a `COMFYTV_VIDEO` clip according to a chosen lens-distortion model, either **undistorting** (straightening curved lines from a wide/fisheye lens) or **distorting** (adding the curve to match plates). It runs on a Torch backend as an fx-spec pass. If the model is the default `nuke_k1k2` with all coefficients at their neutral values (no k1/k2, no squeeze, no scale, no recentering), it passes the clip through untouched.

It has a ▶ Run. Input and output are both `COMFYTV_VIDEO`. To hand the result to native ComfyUI nodes, insert a **Bridge** — see the [bridge note](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## When to use it

- Remove barrel distortion from GoPro/wide-angle footage so lines go straight.
- Re-apply the exact lens distortion of a plate onto CG or a clean composite so they match.
- Match a specific lens profile from a solver (3DEqualizer / PanoTools style models).

## Parameters

### model
The distortion math. Options: `nuke_k1k2`, `pf_barrel`, `3de_classic`, `3de_radial`, `panotools`, `fisheye_equidistant`, `fisheye_orthographic`, `fisheye_equisolid`, `fisheye_stereographic`. Default `nuke_k1k2` (Nuke's classic radial k1/k2 model). Pick the model that matches how your distortion was measured; the `fisheye_*` models are projection-based rather than polynomial.

### direction
`undistort` (straighten — remove lens curvature) or `distort` (add curvature). Default `undistort`.

### k1 / k2
Radial distortion coefficients, each -1.0 to 1.0 (default 0, step 0.005). k1 is the primary barrel/pincushion term; k2 is the higher-order correction. Positive/negative flips between barrel and pincushion depending on model. These are the main knobs for the polynomial models.

### fov
Field of view in degrees, 20 to 180 (default 140). Used by the fisheye projection models to know the lens's coverage.

### center_x / center_y
Optical-center offset, each -0.5 to 0.5 (default 0), as a fraction of the frame. Shift these if the lens's true center isn't the exact middle of the image.

### squeeze
Anamorphic squeeze factor, 0.5 to 2.0 (default 1.0). Accounts for anamorphic lenses that stretch one axis.

### lens_scale
Overall scale of the warped image, 0.25 to 4.0 (default 1.0). Zoom the result in or out to control how much valid image fills the frame after undistorting.

### cx_curv / cy_curv / tang_u / tang_v / pt_c
Advanced per-model terms for the 3DE and PanoTools models. `cx_curv` / `cy_curv` are asymmetric curvature terms (-0.5 to 0.5); `tang_u` / `tang_v` are tangential (decentering) terms (-0.5 to 0.5); `pt_c` is the PanoTools cubic term (-1.0 to 1.0). All default 0. Leave at 0 unless your solver produced these values.

### edge
How to fill areas pulled in from outside the frame: `blank` (black), `clamp` (stretch edge pixels), `mirror` (reflect). Default `clamp`.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | The warped clip |

## Tips

- Match the `model` to your source of coefficients — using Nuke k1/k2 values in a 3DE model (or vice versa) will not line up.
- After `undistort`, use `lens_scale` to trade off between keeping all the pixels (scale down, black corners) and filling the frame (scale up, crop).
- For a distort/undistort round trip that stays exactly aligned, use **STMap Generate** to bake the same model into an STMap instead.

## Related nodes

- **STMap Generate** — bake this exact distortion model into a reusable STMap image.
- **360 Projection** — for spherical/equirectangular reprojection rather than lens distortion.
