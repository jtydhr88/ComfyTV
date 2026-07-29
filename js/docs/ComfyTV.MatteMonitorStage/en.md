# Matte Monitor

> A QC view that exaggerates the gray zones of a matte so you can spot leaks and soft edges instantly.

## What this node does

Matte Monitor is a quality-control display for mattes. It takes a matte and remaps its values so the in-between grays — the areas that aren't cleanly black or white — pop out visually. This makes it easy to see where a key is leaking (background showing through your subject) or holding onto detail it shouldn't. Think of it as the "matte view" toggle in a professional compositor.

Input and output are `COMFYTV_VIDEO`. It has a ▶ Run. It's a diagnostic tool — feed it your matte, look, then remove or bypass it before final render.

## When to use it

- You pulled a key and want to check the matte for holes, halos, or soft spots.
- You're tuning a keyer and need to see small errors that are invisible at normal contrast.

## Parameters

### slope
Controls how aggressively the mid-gray values are stretched for display. Range `0.0`–`1.0`, default `0.5`. Higher values exaggerate small deviations from pure black/white more, making subtle matte problems easier to see.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | The matte remapped for visual inspection. |

## Tips

- This is a viewer, not a fix — use **Matte Morphology** or your keyer's controls to actually clean the matte.
- Raise `slope` to hunt for faint leaks; lower it for a gentler view.
- To interoperate with native ComfyUI nodes, insert a **Bridge**. See [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## Related nodes

- **Keyer** / **PIK Keyer** / **Select0r** — output the matte you inspect here.
- **Matte Morphology** — erode/dilate/blur to fix the problems Matte Monitor reveals.
