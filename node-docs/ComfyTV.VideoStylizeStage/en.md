# Video Stylize

> A grab-bag of one-click stylization looks — vignette, film grain, pixelize, edge detect, sepia, monochrome, or a combined old-film treatment.

## What this node does

**Video Stylize** applies a single preset stylization effect to a `COMFYTV_VIDEO` clip. You pick one effect from a dropdown and set its strength; the node renders the look with an ffmpeg filter under the hood.

This is a rendered stage — it needs a **▶ Run** to produce the output. In goes `COMFYTV_VIDEO`, out comes `COMFYTV_VIDEO`.

To hand the result to a native ComfyUI node, insert a **Bridge**. See [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## When to use it

- Quickly age or texturize a clip without wiring up several separate FX nodes.
- Add a vignette or film grain as a finishing touch.
- Get a pixelize / edge / sepia / monochrome look for a stylized sequence.

## Parameters

### effect
The look to apply. One of: `vignette`, `grain`, `pixelize`, `edge`, `sepia`, `monochrome`, `old_film`. Default `vignette`.

- **vignette** — darkens the frame corners; `strength` sets the falloff angle.
- **grain** — adds animated luma/chroma noise; `strength` sets the amount.
- **pixelize** — mosaics the frame into blocks; uses the `block` size (see below).
- **edge** — colored edge-detection look; `strength` scales the detection thresholds.
- **sepia** — fixed warm sepia color mix (ignores strength).
- **monochrome** — desaturates to black and white (ignores strength).
- **old_film** — a combined treatment: vintage curves + grain + vignette, all scaled by `strength`.

### strength
`0.0`–`1.0`, default `0.5`. Overall intensity for the effects that use it (vignette, grain, edge, old_film). Has no effect on sepia, monochrome, or pixelize. Start around `0.5`.

### block
`2`–`64`, default `8`. Pixelize block size in pixels — only used when `effect` is `pixelize`. Larger blocks give a coarser mosaic.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | The stylized clip |

## Tips

- `strength` is ignored for `sepia`, `monochrome`, and `pixelize` — for those, use `block` (pixelize) or just the fixed look.
- For a full aged-film treatment with damage lines and flicker, use the dedicated **Old Film** node; `old_film` here is the lighter, faster preset combo.

## Related nodes

- **Old Film** — full film-damage simulation (dust lines, brightness flicker, weave).
- **Regrain** — physically-modeled film grain with per-tonal-range control.
- **Posterize** — reduces the clip to a limited color palette.
