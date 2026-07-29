# Ken Burns

> Turns a single still image into a video with a slow pan-and-zoom move, in one ▶ Run.

## What this node does

**Ken Burns** animates one still image (`COMFYTV_IMAGE`) into a `COMFYTV_VIDEO` by smoothly interpolating a crop window from a start framing to an end framing — the classic documentary pan-and-zoom. You set the output size, frame rate, duration, the start/end zoom and center, and an easing curve; it renders on **▶ Run**. An image must be wired into the **image** input or Run errors.

Output is `COMFYTV_VIDEO`. To feed native ComfyUI nodes, insert a **Bridge** — see the [bridge guide](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## When to use it

- Bring a photo, still frame, or generated image to life for a slideshow or intro.
- Add subtle motion behind a title, quote, or interview cutaway.
- Push in on a detail (zoom toward a face or object) over a few seconds.

## Parameters

### width / height
Output resolution in pixels, each `16`–`4096`, defaults `1280` × `720`.

### fps
Output frame rate, `1`–`120`, default `24`.

### duration
Clip length in seconds, `0.5`–`120.0` (step `0.5`), default `5.0`.

### start_zoom / end_zoom
Zoom factor at the start and end of the move, each `1.0`–`6.0`, defaults `1.0` (start) and `1.3` (end). `1.0` frames the whole image; higher crops in tighter. Different start/end values create the push-in or pull-out.

### start_x / start_y and end_x / end_y
The crop center at the start and end, as normalized coordinates `0.0`–`1.0`. Defaults are all `0.5` (image center). Change start vs. end to pan across the image.

### interp
Easing of the move. Options: `linear` (constant speed), `smooth` (ease in and out), `ease_in`, `ease_out`. Default `smooth`.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | The animated pan-and-zoom clip |

## Tips

- For a pure zoom, keep the centers equal and vary only **start_zoom**/**end_zoom**; for a pure pan, keep the zooms equal and move the centers.
- Keep **end_zoom** at or above `start_zoom` (both ≥ `1.0`) so the crop stays inside the image.
- `smooth` easing reads most naturally for slideshows; `linear` feels more mechanical.

## Related nodes

- **Pattern** — generate a procedural clip instead of animating a still.
- **Image Stage / loaders** — produce or bring in the still you feed here.
