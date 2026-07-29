# Video Scopes

> Render a broadcast scope — waveform, RGB parade, vectorscope, histogram or CIE — for one frame of your video, to check exposure and color.

## What this node does

**Video Scopes** samples one frame of a `COMFYTV_VIDEO` and renders the chosen scope as a `COMFYTV_IMAGE`. You pick a **scope** and the frame time, then press **▶ Run** (an ffmpeg pass on the server) to get the scope image. These are the same measurement scopes colorists use to judge exposure, contrast and hue.

## When to use it

- Check whether highlights are clipping or shadows are crushed (waveform).
- Verify white balance and channel balance (RGB parade).
- Judge saturation and hue distribution (vectorscope).
- Inspect overall tonal distribution (histogram) or gamut coverage (CIE).

## Parameters

### scope
Which scope to render:
- `waveform` — luma waveform with a green graticule and numbers.
- `waveform_parade` — RGB parade waveform (channels side by side).
- `vectorscope` — color vectorscope (color3 mode) with named targets.
- `histogram` — tonal histogram.
- `cie` — CIE chromaticity scope (HDTV system/gamut, white point shown).

Default `waveform`.

### at_seconds
Which frame to measure, in seconds. Range −1 to 3600, default `-1`, where `-1` means the middle of the clip.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **image** | `COMFYTV_IMAGE` | The rendered scope for the sampled frame |

## Tips

- Leave `at_seconds` at `-1` to scope the middle frame; set a specific time to check a known tricky moment (a blown window, a skin tone).
- `waveform_parade` is best for spotting a color cast; `vectorscope` for skin-tone alignment along the I-line.
- This scopes a single still frame, not the whole clip — sample several times if the shot changes exposure.

## Types and bridges

`COMFYTV_VIDEO` / `COMFYTV_IMAGE` are ComfyTV project snapshots, not native ComfyUI types. Use a **Bridge** (`ComfyTV/Bridge`) to interoperate with native nodes. See [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## Related nodes

- **Contact Sheet** — a grid of sampled frames instead of one scope.
- **Scene Detect** — find cuts, then scope a representative frame per shot.
