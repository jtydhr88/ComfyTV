# Audio Stereo

> Reshape the stereo field — widen, narrow, cross-feed, Haas-delay, balance, collapse to mono, or swap channels.

## What this node does

**Audio Stereo** applies one of seven stereo-field operations to a track, using the matching FFmpeg filters (`stereowiden`, `extrastereo`, `crossfeed`, `haas`, `stereotools`, `pan`). You pick a **mode** and adjust only the parameters that belong to it.

It takes a `COMFYTV_AUDIO` snapshot (or a `COMFYTV_VIDEO`, whose audio track is used) and outputs processed `COMFYTV_AUDIO` plus an `fx_spec`. It has a ▶ **Run** (FFmpeg does the work). If no source is wired, it emits just the `fx_spec` for chaining.

To feed native ComfyUI `AUDIO` in or out, insert a **Bridge** — see [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## When to use it

- Widen a flat stereo mix so it fills the speakers.
- Tame overly-wide material with crossfeed for comfortable headphone listening.
- Collapse to mono to check phase, or swap L/R to fix a reversed recording.

## Parameters

### mode
Which operation to apply. Options: `widen` (default), `extrastereo`, `crossfeed`, `haas`, `balance`, `mono`, `swap`. `mono` and `swap` have no extra parameters.

### Widen (`sw_*`)
- **sw_delay** — delay in ms, **1–100** (default **20**).
- **sw_feedback** — feedback amount, **0.0–0.9** (default **0.3**).
- **sw_crossfeed** — cross-feed amount, **0.0–0.8** (default **0.3**).
- **sw_drymix** — dry mix, **0.0–1.0** (default **0.8**).

### Extra Stereo
- **es_m** — stereo expansion factor, **-10.0 to 10.0** (default **2.5**). Values above 1 widen; below 0 invert.

### Crossfeed
- **cf_strength** — crossfeed strength, **0.0–1.0** (default **0.2**).
- **cf_range** — soundstage range, **0.0–1.0** (default **0.5**).

### Haas
- **haas_side_gain** — side channel gain, **0.06–12.0** (default **1.0**).
- **haas_left_delay** — left delay in ms, **0.0–40.0** (default **2.05**).
- **haas_right_delay** — right delay in ms, **0.0–40.0** (default **2.12**).

### Balance
- **balance** — L/R balance, **-1.0 to 1.0** (default **0.0**), fed to `stereotools` `balance_out`.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **audio** | `COMFYTV_AUDIO` | The processed audio snapshot |
| **fx_spec** | `COMFYTV_FXSPEC` | The effect as a spec, for chaining into an FX Chain |

## Tips

- Only the parameters for the selected **mode** matter — the rest are inert.
- Very wide `extrastereo` values can cause mono-compatibility problems; check in `mono` mode before committing.
- `swap` and `mono` are pure channel-math with no tunable knobs — instant fixes.

## Related nodes

- **Audio Modulation** — chorus/flanger can also add perceived width.
- **Audio Analyze** — check loudness/levels after reshaping the field.
- **FX Chain** — renders multiple `fx_spec` steps (including this one) in a single pass.
