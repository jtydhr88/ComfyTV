# Audio Dynamics

> Tame or shape the level of a track with a compressor, gate, limiter, or de-esser — the same dynamics tools you'd reach for in a DAW.

## What this node does

**Audio Dynamics** applies one dynamics processor to an audio track, chosen by **mode**: a **compressor** (evens out loud/quiet parts), a **gate** (mutes anything below a threshold, e.g. room hiss between words), a **limiter** (a hard ceiling that stops peaks from clipping), or a **de-esser** (tames harsh "sss" sibilance).

It takes a `COMFYTV_AUDIO` snapshot (or a `COMFYTV_VIDEO`, whose audio track is used) and outputs processed `COMFYTV_AUDIO` plus an `fx_spec`. It has a ▶ **Run**: the actual processing is done by FFmpeg (`acompressor` / `agate` / `alimiter` / `deesser`). If no source is wired, the node still emits just the `fx_spec` so it can be chained into an FX Chain and rendered later.

To feed native ComfyUI `AUDIO` in or out, insert a **Bridge** — see [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## When to use it

- Even out a voiceover where some phrases are loud and others fade away (compressor).
- Silence background hiss or breaths between spoken lines (gate).
- Guarantee a track never clips above a safe ceiling before export (limiter).
- Soften piercing "s" and "t" sounds on a vocal recording (de-esser).

## Parameters

### mode
Which processor to run: `compressor` (default), `gate`, `limiter`, or `deesser`. The parameters below apply differently per mode, as noted.

### threshold_db
The level (in dB) at which the effect kicks in. Range **-60 to 0 dB**, default **-20**. For the compressor and gate, signal crossing this threshold gets acted on; for the limiter it becomes the output ceiling. Not used by the de-esser. Lower (more negative) = the effect engages on quieter material.

### ratio
How hard the compressor or gate acts once the threshold is crossed. Range **1 to 20**, default **4**. Higher = stronger gain reduction (e.g. 4:1 compression). Not used by the limiter or de-esser.

### attack_ms
How fast (in milliseconds) the processor reacts to a signal crossing the threshold. Range **0.01 to 2000**, default **20**. Shorter = clamps transients faster; longer = lets initial punch through. Applies to compressor, gate, and limiter (the limiter internally clamps this to 0.1–80 ms).

### release_ms
How fast the processor lets go after the signal drops back. Range **0.01 to 9000**, default **250**. Applies to compressor, gate, and limiter (the limiter clamps this to 1–8000 ms).

### makeup_db
Extra output gain (in dB) added after compression to bring the level back up. Range **0 to 24**, default **0**. Compressor only.

### knee
How gradually the compressor/gate transitions around the threshold. Range **1 to 8**, default **2.83**. Higher = a softer, smoother onset. Used by compressor and gate.

### intensity
De-esser strength. Range **0 to 1**, default **0.5**. Higher removes more sibilance. Only used when **mode** is `deesser`.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **audio** | `COMFYTV_AUDIO` | The processed audio snapshot |
| **fx_spec** | `COMFYTV_FXSPEC` | The dynamics step as a spec, for chaining into an FX Chain |

## Tips

- **Limiter needs `alimiter`.** Some FFmpeg builds are compiled without it; the node raises a clear error if that filter is missing.
- The mode you pick decides which knobs matter — e.g. `ratio`, `makeup_db`, and `knee` do nothing in limiter or de-esser mode.
- For a "safe export" pass, run a limiter last in the chain with `threshold_db` near -1 to -3.

## Related nodes

- **Audio Loudness** — for target-level normalization (EBU R128 / peak / RMS) rather than moment-to-moment dynamics.
- **Audio EQ** — tone shaping; often paired before compression.
- **FX Chain** — renders multiple `fx_spec` steps (including this one) in a single pass.
