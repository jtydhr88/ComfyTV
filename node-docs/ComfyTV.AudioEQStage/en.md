# Audio EQ

> A parametric equalizer driven by a graphical EQ curve — boost, cut, and filter frequency bands to shape the tone of a track.

## What this node does

**Audio EQ** applies a stack of frequency-band filters to an audio track. Bands are defined through the node's **EQ graph UI**, which writes them into a single hidden **bands** field as JSON. Each band is one of five types — **peak** (bell boost/cut), **highpass**, **lowpass**, **lowshelf**, or **highshelf** — and the node converts each into the matching FFmpeg filter (`equalizer`, `highpass`, `lowpass`, `bass`, `treble`).

It takes a `COMFYTV_AUDIO` snapshot (or a `COMFYTV_VIDEO`, whose audio track is used) and outputs processed `COMFYTV_AUDIO` plus an `fx_spec`. It has a ▶ **Run** (FFmpeg does the filtering). If no source is wired, it emits just the `fx_spec` for chaining. If there are no active bands, it raises an error asking you to add a band or set a gain.

To feed native ComfyUI `AUDIO` in or out, insert a **Bridge** — see [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## When to use it

- Add "air" or presence to a vocal with a high-shelf boost.
- Roll off rumble and low-end noise with a highpass filter.
- Notch out a resonant frequency that sounds boxy or harsh (peak cut).
- Warm up a thin recording with a low-shelf boost.

## Parameters

### bands
A hidden JSON field, driven by the EQ graph UI — you normally never edit it by hand. It holds a list of band objects, each with:

- **type** — `peak`, `highpass`, `lowpass`, `lowshelf`, or `highshelf`.
- **f** — center/corner frequency in Hz. Clamped to **20–20000**.
- **g** — gain in dB. Clamped to **-24 to +24**. (For peak/lowshelf/highshelf, a band with **g = 0** is skipped, since it would do nothing.)
- **q** — bandwidth / resonance. Clamped to **0.1–20**. Wider Q affects a broader frequency range.

Highpass and lowpass bands are 2-pole filters and ignore `g`. Lowshelf and highshelf require the FFmpeg `bass` / `treble` filters to be present.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **audio** | `COMFYTV_AUDIO` | The equalized audio snapshot |
| **fx_spec** | `COMFYTV_FXSPEC` | The EQ band stack as a spec, for chaining into an FX Chain |

## Tips

- **No active bands = error.** A peak/shelf band with zero gain is treated as inactive, so at least one band must actually change something.
- Use highpass to clean low-frequency rumble before compression, rather than fighting it later.
- Lowshelf/highshelf depend on `bass`/`treble` being compiled into your FFmpeg build; if they're missing those band types are silently dropped.

## Related nodes

- **Audio Dynamics** — compression/gating; usually applied together with EQ.
- **Audio Repair** — has a **hum** mode that notches out mains-frequency buzz, which is more surgical than an EQ cut.
- **FX Chain** — renders multiple `fx_spec` steps (including this one) in a single pass.
