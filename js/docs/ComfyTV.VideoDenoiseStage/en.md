# Video Denoise

> Cleans up grain, sensor noise, and banding across a whole clip with a choice of denoise algorithms.

## What this node does

**Video Denoise** runs one of five ffmpeg denoise/cleanup filters over a `COMFYTV_VIDEO` clip. A single **strength** dial is mapped internally to sensible per-filter settings, so you pick a method and push one slider. It processes on **▶ Run** and writes a new video snapshot; the source is left alone.

In and out are both `COMFYTV_VIDEO`. To interoperate with native ComfyUI nodes, insert a **Bridge** — see the [bridge guide](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## When to use it

- Clean up ISO/sensor grain from low-light or high-gain footage.
- Kill gradient banding in skies or soft backgrounds (use `deband` or `gradfun`).
- Pre-clean footage before sharpening, upscaling, or heavy grading so you don't amplify noise.

## Parameters

### method
Which denoiser to use. Options: `atadenoise` (adaptive temporal, default), `nlmeans` (non-local means, strong but slow), `fftdnoiz` (frequency-domain), `deband` (removes banding), `gradfun` (smooths gradient banding). Default `atadenoise`.

### strength
Normalized amount, `0.0`–`1.0`, default `0.3`. Must be above 0. This one value is remapped per method to the underlying filter parameters (temporal thresholds, non-local sigma, FFT sigma, deband thresholds, or gradfun strength). Start low (~`0.3`) and raise until noise is gone without smearing detail.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | The denoised clip as a new project snapshot |

## Tips

- `nlmeans` gives the cleanest result but is the slowest; `atadenoise` is a good, fast default.
- For banding specifically (skies, gradients) reach for `deband` or `gradfun` rather than a general denoiser.
- Push **strength** too high and fine detail smears — denoise before you sharpen, not after.

## Related nodes

- **Blur / Sharpen** — soften or re-sharpen after cleanup.
- **Frame Interpolate** — retime after cleaning, so noise isn't smeared into interpolated frames.
