# Old Film

> Full aged-film simulation — dust, scratches, brightness flicker, uneven development, and frame weave, like footage run through a worn projector.

## What this node does

**Old Film** layers several classic film-damage artifacts onto a clip: random dust and vertical scratch lines, brightness flicker, uneven "development" density, and physical frame weave (shake). Each artifact type has its own controls, so you can dial from a subtle vintage feel to heavily distressed archive footage.

This is a rendered stage — it needs a **▶ Run**. It uses a torch (GPU) backend. In goes `COMFYTV_VIDEO`, out comes `COMFYTV_VIDEO`.

To hand the result to a native ComfyUI node, insert a **Bridge**. See [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## When to use it

- Turn a clean render into vintage / archive-style footage.
- Add flicker and scratches to a "found footage" or flashback sequence.
- Sell an old-projector or Super-8 aesthetic.

## Parameters

Values are integers unless noted. Higher generally means more/stronger of that artifact.

### Dust and scratches
- **delta** `0`–`400`, default `14` — intensity/amount of dust and speckle damage.
- **every** `0`–`100`, default `20` — how often dust appears over time (frame interval / frequency).

### Brightness flicker
- **brightness_up** `0`–`100`, default `20` — how far brightness can rise on a flicker.
- **brightness_down** `0`–`100`, default `30` — how far brightness can drop on a flicker.
- **brightness_every** `0`–`100`, default `70` — how frequently the flicker occurs.

### Development (density unevenness)
- **develop_up** `0`–`100`, default `60` — upper range of the development density variation.
- **develop_down** `0`–`100`, default `20` — lower range of the development density variation.
- **develop_duration** `0`–`10000`, default `70` — how long each development variation lasts.

### Scratch lines
- **lines_num** `0`–`100`, default `5` — number of vertical scratch lines.
- **line_width** `0`–`100`, default `2` — thickness of each scratch line.
- **lines_darker** `0`–`100`, default `40` — how dark the darkening scratches get.
- **lines_lighter** `0`–`100`, default `40` — how bright the lightening scratches get.

### Frame weave (shake)
- **weave_x** `0.0`–`32.0` (step `0.5`), default `0.0` — horizontal frame jitter amount.
- **weave_y** `0.0`–`32.0` (step `0.5`), default `0.0` — vertical frame jitter amount.
- **weave_interval** `0.05`–`5.0` (step `0.05`), default `0.6` — how often the weave shifts.

### seed
`0`–`99999`, default `7`. Random seed for the damage pattern. Change it to get a different distribution of dust/scratches/flicker; keep it fixed for a repeatable look.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | The distressed clip |

## Tips

- Start with `weave_x`/`weave_y` at `0` and add just a little (1–3) for a realistic gate weave — large values look like a shaky handheld shot.
- Set the `0` values to disable a whole artifact group (e.g. `lines_num=0` removes scratch lines).
- For grain alone with tonal control, use **Regrain** instead; for a lighter, faster vintage combo, the `old_film` preset in **Video Stylize** is enough.

## Related nodes

- **Regrain** — physically-modeled film grain with per-tonal-range control.
- **Video Stylize** — lighter `old_film` preset plus other one-click looks.
