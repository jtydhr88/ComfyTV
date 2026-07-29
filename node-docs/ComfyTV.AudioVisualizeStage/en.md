# Audio Visualize

> Render a track as a picture — waveform or spectrogram, in a quick FFmpeg style or a higher-detail "pro" render.

## What this node does

**Audio Visualize** turns an audio track into a still image. Two fast modes use FFmpeg (`showwavespic`, `showspectrumpic`); two **pro** modes use ComfyTV's own higher-detail waveform and spectrogram renderers with metering overlays. It does not change the audio.

It takes a `COMFYTV_AUDIO` snapshot (or a `COMFYTV_VIDEO`, whose audio track is used) and outputs a `COMFYTV_IMAGE`. It has a ▶ **Run**. A source is required.

To feed native ComfyUI `AUDIO` in, insert a **Bridge** — see [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## When to use it

- Generate a waveform thumbnail for a clip in a storyboard or export.
- Inspect the spectral content of a track (find hiss, hum, or tonal balance).
- Produce a labeled "pro" spectrogram or metered waveform for analysis.

## Parameters

### mode
Which render. Options: `waveform` (default), `spectrum`, `waveform_pro`, `spectrum_pro`.

### width / height
Output image size in pixels. **width** **240–4096** (default **1200**), **height** **120–2048** (default **480**).

### Waveform (fast) — `split_channels`
Boolean, default **off**. When on, draws each channel in its own lane instead of overlaid. Used by `waveform` mode.

### Spectrum (fast) — `color`, `legend`
- **color** — the spectrogram color map: `intensity` (default), `channel`, `rainbow`, `moreland`, `nebulae`, `fire`, `fiery`, `fruit`, `cool`, `magma`, `green`, `viridis`, `plasma`, `cividis`, `terrain`.
- **legend** — Boolean, default **on**; draws frequency/time axis labels. Used by `spectrum` mode.

### Pro spectrogram — `pro_scale`, `pro_colormap`, `range_db`, `gain_db`, `freq_gain`
- **pro_scale** — frequency scale: `log` (default), `linear`, `mel`.
- **pro_colormap** — `roseus` (default) or `gray`.
- **range_db** — dynamic range shown, **20–120 dB** (default **80**).
- **gain_db** — brightness/gain, **0–60 dB** (default **20**).
- **freq_gain** — frequency-tilt gain, **-10 to +10 dB/oct** (default **0**). Used by `spectrum_pro` mode.

### Pro waveform — `show_rms`, `show_clipping`, `db_axis`
- **show_rms** — Boolean, default **on**; overlay RMS envelope.
- **show_clipping** — Boolean, default **on**; highlight clipped samples.
- **db_axis** — Boolean, default **off**; label the amplitude axis in dB. Used by `waveform_pro` mode.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **image** | `COMFYTV_IMAGE` | The rendered waveform/spectrogram picture |

## Tips

- Use the fast modes for quick thumbnails; the **pro** modes for readable, metered analysis images.
- Only the parameter group for the selected **mode** applies — the rest are inert.
- Raise **gain_db** on the pro spectrogram to reveal quiet detail; lower **range_db** to increase contrast.

## Related nodes

- **Audio Analyze** — numeric measurements instead of a picture.
- **Audio Sweep (ESS)** — generate a test signal to visualize a system's response.
