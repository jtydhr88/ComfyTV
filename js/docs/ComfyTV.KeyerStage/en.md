# Keyer

> A flexible luma/chroma keyer with independent tolerance and softness on the low and high sides — pull mattes from brightness, a color, or a screen.

## What this node does

Keyer builds a matte from your footage using one of several strategies: key on **luminance** (brightness), on a specific **color**, on a green/blue **screen**, or pass through with **none**. Unlike a one-slider chroma key, it gives you a full keying curve — a center point plus separate tolerance and softness for the darker (lower) and brighter (upper) sides — so you can shape exactly which values are kept. It also has an angular despill for cleaning screen fringe.

Input and output are `COMFYTV_VIDEO`. It has a ▶ Run.

Like PIK Keyer, it picks its mode automatically: wire any of the side inputs (in/out mask or background) to run the full render; leave them empty and it runs a fast, previewable single-image key.

## When to use it

- You want to key on brightness (e.g. isolate highlights or shadows) rather than a color.
- A screen key needs asymmetric handling — tighter on one side of the threshold than the other.
- You need finer edge shaping than **Chroma Key** offers, but without a clean plate.

## Parameters

### mode
The keying strategy: `luminance` (default), `color`, `screen`, or `none`.

### key_color
The reference color for `color`/`screen` modes. Hex, default `#000000`.

### The keying curve (softness_lower, tolerance_lower, center, tolerance_upper, softness_upper)
These five shape which values become the matte, from dark to bright:
- **softness_lower** — feather below the lower tolerance. Range `-1.0`–`0.0`, default `-0.5`.
- **tolerance_lower** — how far below center is still fully kept. Range `-1.0`–`0.0`, default `0.0`.
- **center** — the value the key is centered on. Range `0.0`–`1.0`, default `1.0`.
- **tolerance_upper** — how far above center is still fully kept. Range `0.0`–`1.0`, default `0.0`.
- **softness_upper** — feather above the upper tolerance. Range `0.0`–`1.0`, default `0.5`.

Widen the tolerances to keep more; increase the softness values to feather the transition.

### despill / despill_angle
Spill suppression strength and its hue angle. `despill` ranges `0.0`–`2.0`, default `1.0` (0 = off). `despill_angle` ranges `0`–`180` degrees, default `120` (green). Set the angle toward your screen hue.

### output
`matte` (default) for a grayscale mask, `alpha` for real transparency, `premult` for premultiplied RGB, or `composite` to render over the background. (`alpha` needs the VP9 encoder — use `matte` if it errors.)

### Side inputs (optional)
- **video** — the plate to key.
- **in_mask** — force areas fully opaque (keep).
- **out_mask** — force areas fully transparent (remove).
- **bg_video** — background used when `output` is `composite`.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | Keyed result in the chosen output form. |

## Tips

- For a luma key, start with `mode=luminance`, set `center` where the split should be, and open the tolerances/softness until the matte looks right.
- Wiring a side input switches to full-render mode; with none it stays a live-previewable key.
- To interoperate with native ComfyUI nodes, insert a **Bridge**. See [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## Related nodes

- **Chroma Key** — simpler single-color key.
- **PIK Keyer** — clean-plate / IBK-style keyer for the hardest screens.
- **Select0r** — color-space region keyer (RGB/ABI/HCI) with shape and edge controls.
- **Matte Monitor** — visualize how clean the resulting matte is.
