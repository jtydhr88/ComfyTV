# Color Suppress

> Knock down any of six primary/secondary colors independently — a targeted spill and tint remover.

## What this node does

Color Suppress reduces the presence of specific hues in your footage. You get a slider for each of six colors — red, green, blue, cyan, magenta, yellow — and each one dials how much of that color is suppressed. It's a more general cousin of Despill: instead of only cleaning a green/blue screen, you can pull down any color cast, and optionally keep overall brightness intact while doing it.

Input and output are `COMFYTV_VIDEO`. It runs as a live fx-preview filter (emits an fx spec and passes through), so results preview without a full render. If all six sliders are 0, it passes the clip through unchanged.

## When to use it

- A color cast (e.g. a magenta light leak, a too-blue sky) needs to come down.
- You want to suppress green/blue spill but also clean a second unwanted hue.
- You need a subtle grade correction targeted at one or two colors.

## Parameters

### red / green / blue / cyan / magenta / yellow
One suppression amount per color. Each ranges `0.0`–`1.0`, default `0.0` (no change). Raise a slider to remove more of that color. Any combination works; leaving all at 0 is a pass-through.

### preserve_luma
When on, keeps each pixel's brightness constant while suppressing color, so the image doesn't darken where color is removed. Default off.

### output
`image` (default) returns the color-corrected footage; `matte` returns a grayscale matte derived from the suppression.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | The suppressed image, or a matte when `output` is `matte`. |

## Tips

- Turn on `preserve_luma` when suppressing a strong color so shapes and detail don't go muddy.
- For dedicated green/blue screen fringe, **Despill** is purpose-built; use Color Suppress when the unwanted color isn't the screen.
- To interoperate with native ComfyUI nodes, insert a **Bridge**. See [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## Related nodes

- **Despill** — dedicated green/blue screen spill removal.
- **Keyer** / **Select0r** — produce mattes from color that Color Suppress can complement.
