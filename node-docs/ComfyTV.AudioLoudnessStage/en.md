# Audio Loudness

> Bring a track to a consistent, broadcast-safe loudness — EBU R128 normalization, adaptive levelling, or simple peak/RMS/LUFS matching.

## What this node does

**Audio Loudness** normalizes the overall level of a track to a target, using one of three **mode**s:

- **ebu_r128** — a two-pass EBU R128 loudness normalization (FFmpeg `loudnorm`): it first measures the track, then renders to your integrated-loudness, true-peak, and loudness-range targets. This is the standard for delivering to a fixed LUFS spec.
- **dynamic** — adaptive loudness levelling (FFmpeg `dynaudnorm`) that adjusts level continuously across the track, evening out sections that drift quiet or loud.
- **normalize** — measures peak/RMS/loudness and applies a single gain so the loudest chosen metric hits its target (a straightforward "raise/lower the whole track" pass).

It takes a `COMFYTV_AUDIO` snapshot (or a `COMFYTV_VIDEO`, whose audio track is used) and outputs processed `COMFYTV_AUDIO`. It has a ▶ **Run** — FFmpeg does the measuring and rendering. Unlike the other Audio FX nodes, **a source is required** (it can't run spec-only) and it emits **no** `fx_spec`.

To feed native ComfyUI `AUDIO` in or out, insert a **Bridge** — see [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## When to use it

- Deliver a track at a platform's loudness spec (e.g. -16 LUFS, -1.5 dBTP) with **ebu_r128**.
- Smooth out a recording whose loudness wanders (interview, lecture) with **dynamic**.
- Just bump the whole clip so its peak sits at -1 dB before export with **normalize**.

## Parameters

### mode
Which normalization to run: `ebu_r128` (default), `dynamic`, or `normalize`. The parameters below only apply to certain modes, as noted.

### target_i
Integrated loudness target in **LUFS**. Range **-30 to -10**, default **-16**. Used by `ebu_r128` (as the `I` target), and by `normalize` when **use_lufs** is on.

### target_tp
Maximum true peak in **dBTP**. Range **-3 to 0**, default **-1.5**. Used by `ebu_r128`.

### target_lra
Target loudness range. Range **1 to 20**, default **11**. Used by `ebu_r128`.

### dyn_frame_ms
Analysis frame length in milliseconds for adaptive levelling. Range **10 to 8000**, default **500**. Only used in `dynamic` mode.

### dyn_gauss
Gaussian smoothing window (in frames, must be odd). Range **3 to 301**, default **31**. Larger = smoother, less aggressive level changes. Only used in `dynamic` mode.

### peak_target_db
Target peak level in dB for the **normalize** mode. Range **-30 to 0**, default **-1**. The single applied gain aims the chosen peak metric here.

### peak_mode
`true_peak` (default) or `sample`, for **normalize** mode. `true_peak` measures via loudnorm's true-peak analysis; `sample` uses the raw sample peak from stats.

### use_rms / rms_target_db
In **normalize** mode, when **use_rms** is on (default off), an RMS target of **rms_target_db** dB (range **-30 to 0**, default **-9**) is also considered.

### use_lufs
In **normalize** mode, when on (default off), an integrated-loudness (LUFS) target of **target_i** is also considered.

> In **normalize** mode the node computes the required gain for each enabled metric (peak, and optionally RMS and LUFS) and applies the **smallest** of them, so no target is overshot.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **audio** | `COMFYTV_AUDIO` | The loudness-normalized audio snapshot |

## Tips

- **ebu_r128 runs two passes** (measure, then normalize), so it's slower than a single-pass filter — the progress bar shows "measure 1/2" then "normalize 2/2".
- If measurement fails, `normalize` mode raises a clear error rather than guessing.
- For dialogue that drifts in level, `dynamic` often sounds more natural than a hard `ebu_r128` pass; use R128 when you need to hit an exact delivery spec.

## Related nodes

- **Audio Dynamics** — compressor/limiter for moment-to-moment level control, complementary to loudness normalization.
- **Audio EQ** — tone shaping before the loudness pass.
