# Posterize

> Reduce the clip to a small palette of flat colors — a poster / screen-print / cel-shaded look via color quantization.

## What this node does

**Posterize** quantizes each frame down to a limited number of colors using ffmpeg's `elbg` (enhanced LBG vector quantization). Instead of smooth gradients you get bands of flat color, like a silkscreen poster or a comic. A tight palette gives a bold graphic look; a larger one keeps more detail.

This is a rendered stage — it needs a **▶ Run** and uses the ffmpeg `elbg` filter. In goes `COMFYTV_VIDEO`, out comes `COMFYTV_VIDEO`.

To hand the result to a native ComfyUI node, insert a **Bridge**. See [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## When to use it

- Poster / screen-print / pop-art styling.
- Flatten a render into a cel-shaded, cartoon-like look.
- Reduce a busy clip to a few graphic colors.

## Parameters

### elbg_colors
`1`–`50`, default `9`. Size of the color palette (codebook length) — the number of distinct colors the frame is reduced to. Fewer colors = bolder, flatter posterization; more colors = subtler, closer to the original.

### elbg_steps
`1`–`10`, default `1`. Number of optimization iterations the quantizer runs to fit the palette. Higher values refine the color choices (cleaner banding) at the cost of more compute.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | The color-quantized clip |

## Tips

- Start with `elbg_colors` around `6`–`12`; drop to `3`–`5` for a bold graphic poster.
- Raise `elbg_steps` if the reduced colors look noisy or unstable between frames.

## Related nodes

- **Pseudocolor** — remap brightness to a palette (false color).
- **Video Stylize** — other one-click stylized looks (edge, monochrome…).
