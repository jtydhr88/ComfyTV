# Select0r

> A color-region keyer that carves a matte out of a chosen color space with tunable shape and edge falloff.

## What this node does

Select0r pulls a matte by selecting a region of color around a key color inside a chosen color space. Rather than a single threshold, it defines a 3D selection volume — a box, ellipsoid, or octahedron — sized independently on each axis, with a controllable edge falloff. This makes it good for isolating a specific color range (a screen, a shirt, a sky) with a soft, shapeable boundary.

Input and output are `COMFYTV_VIDEO`. It runs as a live fx-preview filter (emits an fx spec and passes through), so results preview without a full render.

## When to use it

- You want to key on a color range, not just a flat screen, and need control over the region shape.
- A simple chroma key's spherical tolerance is too crude — you need per-axis sizing.
- You're isolating a color for a secondary grade or selective effect.

## Parameters

### key_color
The center color of the selection. Hex, default `#00FF00`.

### space
The color space the selection lives in: `rgb` (default), `abi`, or `hci`. Different spaces separate color and brightness differently — switch if the key is easier to isolate in one of them.

### shape
The geometry of the selection volume: `box`, `ellipsoid` (default), or `octahedron`. Ellipsoid gives smooth falloff; box is hard-cornered; octahedron is in between.

### edge
The edge falloff profile: `hard`, `fat`, `normal` (default), `skiny`, or `slope`. Controls how the matte transitions at the region boundary — from crisp to feathered.

### delta_1 / delta_2 / delta_3
The size of the selection region along each of the three axes of the chosen color space. Each ranges `0.001`–`2.0` (step `0.005`), default `0.2`. Larger deltas select a wider range of colors on that axis.

### slope
Softness of the edge transition. Range `0.001`–`1.0` (step `0.005`), default `0.2`. Higher values feather the matte boundary more.

### invert
When on, inverts the matte (select everything except the color region). Default off.

### output
`matte` (default) returns a grayscale matte; `image` returns the footage carrying the selection.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | The selection matte, or the image when `output` is `image`. |

## Tips

- Start with `ellipsoid` + `normal` edge, then grow `delta_1/2/3` until the color is fully covered without spilling into neighbors.
- Try `abi` or `hci` space when RGB can't cleanly separate your target color from similar ones.
- Turn on `invert` when it's easier to describe what you want to keep than what you want to remove.
- To interoperate with native ComfyUI nodes, insert a **Bridge**. See [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## Related nodes

- **Keyer** / **PIK Keyer** / **Chroma Key** — other keyers producing mattes.
- **Matte Morphology** — clean the Select0r matte.
- **Key Mix** — composite through the matte.
- **Matte Monitor** — inspect matte quality.
