# Audio Denoise

> Strip steady background noise from a track — fan hum, tape hiss, air-con drone — or trim out silent gaps.

## What this node does

**Audio Denoise** reduces broadband background noise in an audio track, chosen by **method**:

- **afftdn** — FFT-based denoiser (FFmpeg `afftdn`), good for steady hiss and hum. Its noise-reduction amount scales with **strength**.
- **anlmdn** — non-local means denoiser (FFmpeg `anlmdn`), a gentler, detail-preserving approach; also scaled by **strength**.
- **silenceremove** — not a denoiser but a silence trimmer (FFmpeg `silenceremove`): it cuts sections quieter than a threshold, useful for removing dead air.

It takes a `COMFYTV_AUDIO` snapshot (or a `COMFYTV_VIDEO`, whose audio track is used) and outputs processed `COMFYTV_AUDIO` plus an `fx_spec`. It has a ▶ **Run** (FFmpeg does the work). If no source is wired, it emits just the `fx_spec` for chaining.

To feed native ComfyUI `AUDIO` in or out, insert a **Bridge** — see [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## When to use it

- Clean up constant fan or air-conditioner drone under a voice recording (**afftdn**).
- Reduce tape/mic hiss while keeping the recording sounding natural (**anlmdn**).
- Auto-trim long silences from a raw take before editing (**silenceremove**).

## Parameters

### method
Which processor to run: `afftdn` (default), `anlmdn`, or `silenceremove`.

### strength
Denoise amount, range **0 to 1**, default **0.3**. For `afftdn` this maps to a noise-reduction figure (roughly 0–40); for `anlmdn` it maps to the filter's smoothing strength. Higher removes more noise but risks a "watery" or hollow sound. Not used by `silenceremove`.

### silence_db
Threshold below which audio counts as silence, in dB. Range **-80 to -20**, default **-50**. Lower = only very quiet passages are cut. `silenceremove` only.

### min_silence_s
Minimum duration (seconds) a quiet stretch must last before it is trimmed. Range **0.1 to 5**, default **0.5**. `silenceremove` only.

### keep_silence_s
How much silence (seconds) to leave in place around kept audio, so cuts don't sound abrupt. Range **0 to 5**, default **0.5**. `silenceremove` only.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **audio** | `COMFYTV_AUDIO` | The denoised (or silence-trimmed) audio snapshot |
| **fx_spec** | `COMFYTV_FXSPEC` | The step as a spec, for chaining into an FX Chain |

## Tips

- Start **strength** low (0.2–0.3) and raise gradually; over-denoising leaves obvious artifacts.
- `silenceremove` changes the track's **length** — downstream nodes that assume the original duration (e.g. lip-sync or fixed-length video) should account for that.
- For narrow, tonal buzz (like 50/60 Hz mains hum) the **hum** mode of **Audio Repair** is more surgical than broadband denoise.

## Related nodes

- **Audio Repair** — de-click, de-clip, wavelet denoise, and mains-hum removal for specific defects.
- **Audio EQ** — a highpass band can remove low-frequency rumble without a full denoiser.
- **FX Chain** — renders multiple `fx_spec` steps (including this one) in a single pass.
