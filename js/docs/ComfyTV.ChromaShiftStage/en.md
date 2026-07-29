# Chroma Shift

> Offset the red and blue channels independently for a chromatic-aberration / RGB-split / glitch look.

## What this node does

**Chroma Shift** moves the red and blue color channels away from the green channel, horizontally and vertically. Small offsets read as lens chromatic aberration; large offsets give a bold RGB-split glitch effect. If all four offsets are zero, the clip passes through unchanged.

This is a rendered stage — it needs a **▶ Run** and uses an ffmpeg `chromashift` filter. In goes `COMFYTV_VIDEO`, out comes `COMFYTV_VIDEO`.

To hand the result to a native ComfyUI node, insert a **Bridge**. See [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## When to use it

- Fake lens chromatic aberration at the frame edges.
- Create an RGB-split glitch / retro-VHS look.
- Add a subtle color fringe for a stylized grade.

## Parameters

### shift_rh / shift_rv
Each `-255.0`–`255.0` (step `1.0`), default `0.0`. Horizontal (`rh`) and vertical (`rv`) shift of the **red** channel, in pixels.

### shift_bh / shift_bv
Each `-255.0`–`255.0` (step `1.0`), default `0.0`. Horizontal (`bh`) and vertical (`bv`) shift of the **blue** channel, in pixels.

### shift_edge
`smear` or `wrap`, default `smear`. How the exposed edge (revealed when a channel is shifted) is filled — `smear` stretches the edge pixels, `wrap` wraps the channel around from the opposite side.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | The channel-shifted clip |

## Tips

- Nudge red one way and blue the opposite way for a symmetric, believable aberration.
- Leave all four at `0` and the node is a no-op (identity pass-through).
- Only red and blue can be shifted — green stays fixed as the reference channel.

## Related nodes

- **Pseudocolor** — remap luminance to a color palette (false color).
- **Video Stylize** — other one-click stylized looks.
