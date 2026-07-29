# Chromatic Aberration

> Split the red/green/blue channels outward from a center point for that "cheap lens" color fringing look — or dial it negative to pull fringing in.

## What this node does

This node offsets the color channels radially around a center point, mimicking the way real lenses fail to focus all wavelengths at the same spot. The effect grows toward the frame edges, so the center stays clean and the corners fringe. It runs on a Torch backend as an fx-spec pass and does nothing (passes through) when `amount` is 0.

It has a ▶ Run. Input and output are both `COMFYTV_VIDEO`. To hand the result to native ComfyUI nodes, insert a **Bridge** — see the [bridge note](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## When to use it

- Add believable lens character to overly-clean CG or AI-generated footage.
- Sell a vintage/lo-fi look alongside grain and vignette.
- Match a plate that already has visible color fringing.

## Parameters

### amount
Strength and direction of the channel split, -0.05 to 0.05 (default 0.01, step 0.001). Positive pushes channels apart (classic fringing); negative pulls them the other way. 0 means no effect.

### falloff
How quickly the effect ramps up from center to edge, 0.5 to 3.0 (default 1.0). Higher values keep the center cleaner and concentrate fringing at the very corners; lower spreads it more evenly.

### center_x / center_y
The center point the split radiates from, each -0.5 to 0.5 (default 0 = frame center), as a fraction of the frame. Offset if the "clean" spot should sit off-center.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | The clip with channel fringing applied |

## Tips

- Keep `amount` small — values near ±0.01 already read as noticeable; the full ±0.05 is extreme.
- Pair with a subtle vignette and grain for a convincing old-lens look.
- Move `center_x/center_y` to match where the sharpest point of your real or intended lens sits.

## Related nodes

- **Lens Distort** — the geometric side of lens character (barrel/pincushion).
- **Lens Flare** — another lens artifact for the same vintage/hero-shot toolkit.
