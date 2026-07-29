# Audio Modulation

> Classic time-modulation effects — phaser, flanger, chorus, vibrato, tremolo, and pulsator — in one node.

## What this node does

**Audio Modulation** applies one of six LFO-driven modulation effects to a track, using the matching FFmpeg filters (`aphaser`, `flanger`, `chorus`, `vibrato`, `tremolo`, `apulsator`). You pick a **mode** and adjust only the parameters that belong to that mode; the rest are ignored.

It takes a `COMFYTV_AUDIO` snapshot (or a `COMFYTV_VIDEO`, whose audio track is used) and outputs processed `COMFYTV_AUDIO` plus an `fx_spec`. It has a ▶ **Run** (FFmpeg does the work). If no source is wired, it emits just the `fx_spec` for chaining.

To feed native ComfyUI `AUDIO` in or out, insert a **Bridge** — see [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## When to use it

- Add movement and width to a synth or guitar with chorus or flanger.
- Sweep a psychedelic phaser across a pad or drum loop.
- Add pitch wobble (vibrato) or volume pulsing (tremolo/pulsator) for rhythmic texture.

## Parameters

### mode
Which effect to apply. Options: `phaser` (default), `flanger`, `chorus`, `vibrato`, `tremolo`, `pulsator`. The parameter groups below apply per mode.

### Phaser (`ph_*`)
- **ph_delay** — sweep delay, **0.0–5.0** (default **3.0**).
- **ph_decay** — feedback decay, **0.0–0.99** (default **0.4**).
- **ph_speed** — LFO speed in Hz, **0.1–2.0** (default **0.5**).
- **ph_type** — LFO shape, `triangular` (default) or `sinusoidal`.

### Flanger (`fl_*`)
- **fl_delay** — base delay in ms, **0.0–30.0** (default **0.0**).
- **fl_depth** — sweep depth in ms, **0.0–10.0** (default **2.0**).
- **fl_regen** — regeneration/feedback %, **-95 to 95** (default **0**).
- **fl_width** — modulated delay width %, **0–100** (default **71**).
- **fl_speed** — LFO speed in Hz, **0.1–10.0** (default **0.5**).
- **fl_shape** — LFO shape, `sinusoidal` (default) or `triangular`.
- **fl_phase** — L/R phase offset %, **0–100** (default **25**).

### Chorus (`chorus_preset`)
A built-in voicing preset: `single` (default), `double`, or `triple` — one, two, or three delayed voices.

### Vibrato / Tremolo (`lfo_*`)
Shared by both modes:
- **lfo_f** — modulation frequency in Hz, **0.1–20000** (default **5.0**).
- **lfo_d** — modulation depth, **0.0–1.0** (default **0.5**). Vibrato modulates pitch; tremolo modulates volume.

### Pulsator (`pu_*`)
- **pu_hz** — pulse rate in Hz, **0.01–100** (default **2.0**).
- **pu_amount** — effect amount, **0.0–1.0** (default **1.0**).
- **pu_width** — pulse width, **0.0–2.0** (default **1.0**).
- **pu_mode** — LFO waveform: `sine` (default), `triangle`, `square`, `sawup`, `sawdown`.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **audio** | `COMFYTV_AUDIO` | The modulated audio snapshot |
| **fx_spec** | `COMFYTV_FXSPEC` | The effect as a spec, for chaining into an FX Chain |

## Tips

- Only the parameters for the selected **mode** matter — the rest are harmless but inert.
- Phaser fixes its gains internally (`in_gain=0.4`, `out_gain=0.74`); you control it via delay/decay/speed.
- For a subtle widening effect, chorus `single` is the gentlest; `triple` is the lushest.

## Related nodes

- **Audio Echo** — discrete delay/echo, a different way to add space.
- **Audio Stereo** — widen or narrow the stereo field.
- **FX Chain** — renders multiple `fx_spec` steps (including this one) in a single pass.
