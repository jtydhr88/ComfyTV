# Video Curves

> Photoshop-style tone curves for a clip — master and per-channel, plus ready-made film-look presets.

## What this node does

**Video Curves** reshapes tones with editable curves, exactly like the Curves tool in a photo editor. You can bend the master (luminance) curve to add contrast or lift shadows, and adjust the red, green, and blue channels independently for color grading.

It takes `COMFYTV_VIDEO` in and out and renders through ffmpeg's `curves` filter. Because it re-encodes, it has a **▶ Run**, with a live preview on the card. Control points are stored as JSON lists of `[x, y]` pairs (both 0…1); points are clamped, de-duplicated, and sorted before rendering, and a channel needs at least two valid points to take effect.

To interoperate with native ComfyUI nodes, add a **Bridge** (see the [Bridge guide](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)).

## When to use it

- Add filmic contrast with a gentle S-curve
- Lift crushed blacks or roll off blown highlights
- Neutralize a color cast by shaping R/G/B separately
- Reach for a preset "look" (vintage, cross-process, negative) as a fast starting point

## Parameters

### preset
Dropdown of built-in curve looks, default `none`. Options: `none`, `color_negative`, `cross_process`, `darker`, `increase_contrast`, `lighter`, `linear_contrast`, `medium_contrast`, `negative`, `strong_contrast`, `vintage`. These map to ffmpeg's built-in curve presets and can be combined with your own points.

### master_pts
JSON list of `[x, y]` control points (0…1) for the master/luminance curve, e.g. `[[0,0],[0.5,0.55],[1,1]]`. Shapes overall brightness and contrast across all channels.

### red_pts / green_pts / blue_pts
JSON `[x, y]` point lists for the red, green, and blue channels respectively. Use these to push a color cast in or out of specific tonal ranges — for example a warm-shadow / cool-highlight split.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | The curve-graded clip snapshot |

## Tips

- A channel with fewer than two valid points is ignored — a single point does nothing.
- Points are clamped to 0…1 and duplicates on the same x collapse, so overlapping points won't stack.
- If you set both a `preset` and your own points, both are applied by the `curves` filter.

## Related nodes

- **Video Color** — sliders for exposure, temperature, and levels when you don't need full curves
- **CDL Grade** — slope/offset/power grade in the ASC-CDL convention
- **Video LUT** — bake a finished look as a `.cube` lookup table
