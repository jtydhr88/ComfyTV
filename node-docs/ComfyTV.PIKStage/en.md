# PIK Keyer

> An IBK-style image-based primatte keyer for hard shots — feed it a clean plate and garbage masks for edges even a simple chroma key can't hold.

## What this node does

PIK Keyer is a professional green/blue-screen keyer modeled on the classic IBK (image-based keyer) / Primatte approach. Instead of judging each pixel only by a single screen color, it can compare your footage against a **clean plate** (the empty screen) and use **garbage masks** to force areas fully in or fully out. It also has built-in despill and a "replace" stage to fill the removed spill with a chosen color or the background.

Input and output are `COMFYTV_VIDEO`. It has a ▶ Run.

There are two working modes, chosen automatically: if you wire any of the side inputs (clean plate, in/out mask, or a background video) it runs the full clean-plate keyer; if you leave them all empty it falls back to a fast, live-previewable single-image key using just the screen settings.

## When to use it

- The screen is unevenly lit or has shadows/wrinkles a simple key can't handle — a clean plate fixes it.
- You need to hand-hold problem areas (a green prop to keep, a hole to punch) with garbage masks.
- You want to composite straight onto a background clip in one node.

## Parameters

### screen
Which backdrop to key: `green` (default), `blue`, or `pick` to use your own `pick_color`.

### pick_color
The custom screen color when `screen` is `pick`. Hex, default `#00FF00`.

### red_weight / blue_green_weight
Balance controls for how the screen channel is separated from the rest of the image. Both range `-1.0`–`2.0`, default `0.5`. Adjust to firm up the matte without eating the subject.

### alpha_bias / despill_bias
Neutral-color references (hex, default `#808080` gray) that bias how alpha is generated and how despill is applied. Set these toward your subject's neutral tone to reduce spill artifacts.

### use_alpha_bias
When on (default), the alpha bias also drives despill. Turn off to decouple the two.

### screen_subtraction
When on (default), subtracts the screen contribution from the image for a cleaner core matte.

### clip_black / clip_white
The matte's black and white clip points. `clip_black` (default `0.0`) forces near-transparent values fully transparent; `clip_white` (default `1.0`) forces near-opaque values fully opaque. Both range `0.0`–`1.0`. Pull them in slightly to crush noise in the matte.

### replace_mode / replace_color
How to fill where spill was removed. `replace_mode` is `none`, `source`, `hard`, or `soft` (default `soft`). `replace_color` (hex, default `#808080`) is the fill color used by the hard/soft modes.

### output
`alpha` (default) for real transparency, `matte` for a grayscale mask, `premult` for premultiplied RGB, or `composite` to render straight over the background. (`alpha` needs the VP9 encoder — use `matte` if it errors.)

### Side inputs (optional)
- **video** — the plate to key.
- **clean_plate_video** / **clean_plate** — the empty screen as a video or a still image; enables the full IBK key.
- **in_mask** — a garbage mask marking areas to force fully opaque (keep).
- **out_mask** — a garbage mask marking areas to force fully transparent (remove).
- **bg_video** — a background clip used when `output` is `composite`.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | Keyed result in the chosen output form. |

## Tips

- Wiring any side input switches this node into full-render mode (a ▶ Run pass). With no side inputs it stays a fast, previewable single-image key.
- A clean plate is the single biggest quality win for uneven screens — shoot one whenever you can.
- Use **in_mask** to protect green props and **out_mask** to knock out reflections or rig holes.
- To interoperate with native ComfyUI nodes, insert a **Bridge**. See [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## Related nodes

- **Chroma Key** — simpler, single-color key when you don't need clean plates or masks.
- **Keyer** — luma/chroma keyer with two-sided tolerance/softness.
- **Despill** — standalone spill cleanup.
- **Key Mix** — composite a foreground over a background with a matte.
