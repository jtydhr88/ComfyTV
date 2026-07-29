# Pseudocolor

> Map the picture's brightness onto a color palette — false-color / heatmap looks, or scientific colormaps like viridis and turbo.

## What this node does

**Pseudocolor** replaces the image's colors by mapping luminance through a chosen palette (colormap). Dark-to-bright becomes a smooth gradient of the palette's colors. Use it for thermal / heatmap styling, data-viz aesthetics, or bold stylized recolors.

This is a rendered stage — it needs a **▶ Run** and uses an ffmpeg `pseudocolor` filter. In goes `COMFYTV_VIDEO`, out comes `COMFYTV_VIDEO`.

To hand the result to a native ComfyUI node, insert a **Bridge**. See [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## When to use it

- Fake a thermal-camera / heatmap look.
- Apply a scientific colormap (viridis, magma, turbo…) for a data-viz feel.
- Bold stylized recolor of a shot.

## Parameters

### pseudo_preset
The palette to map onto. Default `viridis`. One of:

`magma`, `inferno`, `plasma`, `viridis`, `turbo`, `cividis`, `range1`, `range2`, `shadows`, `highlights`, `solar`, `nominal`, `preferred`, `total`, `spectral`, `cool`, `heat`, `fiery`, `blues`, `green`, `helix`.

These are ffmpeg's built-in pseudocolor presets — `magma`/`inferno`/`plasma`/`viridis`/`cividis`/`turbo` are the familiar perceptual colormaps; `heat`/`fiery`/`solar` read as thermal; `shadows`/`highlights` emphasize those tonal ranges.

### pseudo_opacity
`0.0`–`1.0`, default `1.0`. How strongly the recolor is applied over the original. `1.0` is full false-color; lower it to blend the palette with the original image.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | The recolored clip |

## Tips

- Lower `pseudo_opacity` for a tinted look that still keeps some of the original picture.
- `heat`, `fiery`, and `solar` give the most "thermal camera" feel; `viridis`/`turbo` look most like scientific plots.

## Related nodes

- **Chroma Shift** — RGB-split / aberration, not a palette remap.
- **Posterize** — reduce to a small number of flat colors.
