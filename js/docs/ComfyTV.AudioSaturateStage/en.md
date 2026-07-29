# Audio Saturate

> Add warmth, grit, or lo-fi character — soft-clipping, psychoacoustic clipping, bit-crushing, harmonic excitement, and crystalizer.

## What this node does

**Audio Saturate** applies one of five distortion/saturation effects to a track, using the matching FFmpeg filters (`asoftclip`, `apsyclip`, `acrusher`, `aexciter`, `crystalizer`). You pick a **mode** and adjust only the parameters that belong to it.

It takes a `COMFYTV_AUDIO` snapshot (or a `COMFYTV_VIDEO`, whose audio track is used) and outputs processed `COMFYTV_AUDIO` plus an `fx_spec`. It has a ▶ **Run** (FFmpeg does the work). If no source is wired, it emits just the `fx_spec` for chaining.

To feed native ComfyUI `AUDIO` in or out, insert a **Bridge** — see [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## When to use it

- Warm up a sterile digital source with soft-clip or exciter harmonics.
- Add aggressive grit or lo-fi crunch to drums or synths with bit-crush.
- Push loudness without hard digital clipping using psychoacoustic clipping.

## Parameters

### mode
Which effect to apply. Options: `softclip` (default), `psyclip`, `crush`, `exciter`, `crystalizer`.

### Soft Clip (`sc_*`)
- **sc_type** — clipping curve: `hard` (default), `tanh`, `atan`, `cubic`, `exp`, `alg`, `quintic`, `sin`, `erf`.
- **sc_threshold** — clip threshold, **0.01–1.0** (default **1.0**).

### Psy Clip (`py_*`)
- **py_clip** — clip level, **0.015625–1.0** (default **1.0**).
- **py_adaptive** — adaptive amount, **0.0–1.0** (default **0.5**).

### Crush (`cr_*`)
- **cr_bits** — bit depth to crush to, **1–64** (default **8**).
- **cr_mix** — wet/dry mix, **0.0–1.0** (default **0.5**).
- **cr_mode** — `lin` (default) or `log` reduction.

### Exciter (`ex_*`)
- **ex_amount** — effect amount, **0.0–64.0** (default **1.0**).
- **ex_drive** — harmonic drive, **0.1–10.0** (default **8.5**).
- **ex_blend** — harmonic blend, **-10.0 to 10.0** (default **0.0**).
- **ex_freq** — cutoff frequency in Hz, **2000–12000** (default **7500**).

### Crystalizer
- **cz_i** — intensity, **-10.0 to 10.0** (default **2.0**). Positive sharpens; negative softens.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **audio** | `COMFYTV_AUDIO` | The saturated audio snapshot |
| **fx_spec** | `COMFYTV_FXSPEC` | The effect as a spec, for chaining into an FX Chain |

## Tips

- Only the parameters for the selected **mode** matter — the rest are inert.
- Start soft-clip at `tanh`/`atan` for musical warmth; `hard` is the most aggressive.
- Bit-crush at high bit counts is subtle; drop toward 4–8 bits for obvious lo-fi character.

## Related nodes

- **Audio EQ** — tame or accentuate the extra harmonics saturation adds.
- **Audio Dynamics** — pair with compression to control the added energy.
- **FX Chain** — renders multiple `fx_spec` steps (including this one) in a single pass.
