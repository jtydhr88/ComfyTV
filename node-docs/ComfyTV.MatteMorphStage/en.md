# Matte Morphology

> Grow, shrink, or clean a matte's edges with erode/dilate/open/close — the standard fix for chattery or leaky keys.

## What this node does

Matte Morphology reshapes a matte using morphological operations. Erode pulls the matte edge inward (shrink), dilate pushes it outward (grow), and open/close are the combined operations that clean up noise: open (erode then dilate) removes small stray specks, close (dilate then erode) fills small holes. You control the amount separately in the horizontal and vertical directions.

Input and output are `COMFYTV_VIDEO`. It runs as a live fx-preview filter (emits an fx spec and passes through), so you can preview the reshaped matte without a full render.

## When to use it

- A key leaves a fringe of background around the subject — erode a pixel or two to trim it.
- The matte has holes or speckles — use close/open to clean them.
- You need to choke or spread the matte before compositing with **Key Mix**.

## Parameters

### op
The morphological operation: `erode` (default, shrink), `dilate` (grow), `open` (remove small specks), or `close` (fill small holes).

### size_x
Horizontal size of the operation, in pixels. Range `0`–`64`, default `1`. 0 means no effect on that axis.

### size_y
Vertical size of the operation, in pixels. Range `0`–`64`, default `1`. 0 means no effect on that axis.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | The reshaped matte. |

## Tips

- Start with `erode` at size 1–2 to trim a thin background halo; more than a few pixels starts eating real edges.
- Use `close` to seal pinholes in a subject, `open` to drop isolated noise dots.
- Set `size_x` and `size_y` independently when the matte problem is directional (e.g. horizontal motion blur).
- To interoperate with native ComfyUI nodes, insert a **Bridge**. See [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## Related nodes

- **Matte Monitor** — see the matte defects before and after morphing.
- **Key Mix** — composite with the cleaned matte.
- **Keyer** / **PIK Keyer** / **Select0r** — produce the matte.
