# Audio Echo

> Add echo, slapback, or feedback repeats to a track — from a tight vocal double to canyon-sized reflections.

## What this node does

**Audio Echo** applies FFmpeg's `aecho` delay/echo filter (or a native feedback delay) to an audio track. You pick a **preset** or dial in your own delay time, feedback, and gain. Presets like `mountains` produce long, decaying reflections; `robot` and `doubled` are short slapback-style repeats.

It takes a `COMFYTV_AUDIO` snapshot (or a `COMFYTV_VIDEO`, whose audio track is used) and outputs processed `COMFYTV_AUDIO`. It has a ▶ **Run** (FFmpeg does the work). A source is required.

To feed native ComfyUI `AUDIO` in or out, insert a **Bridge** — see [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## When to use it

- Thicken a dry vocal with a short doubled slapback.
- Add spacious, decaying echoes for an ambient or cinematic feel.
- Create rhythmic feedback repeats that trail off over time.

## Parameters

### preset
Chooses the echo character. Options: `custom`, `feedback`, plus four built-in `aecho` recipes — `doubled`, `robot`, `mountains` (default), `mountains2` (two-tap). Pick `custom` to use the four manual sliders below; pick `feedback` to use a native feedback delay driven only by **delay_ms** and **decay**.

### in_gain
Input signal level fed into the echo, **0.0–1.0** (default **0.6**). Used only when `preset = custom`.

### out_gain
Level of the echoed (wet) signal in the output, **0.0–1.0** (default **0.3**). Used only when `preset = custom`.

### delay_ms
Delay time before the first repeat, in milliseconds, **1–90000** (default **1000**). Used by `custom` and `feedback`. Short values (a few ms) give slapback/robot tones; long values (hundreds of ms) give distinct echoes.

### decay
How much each repeat fades relative to the previous one, **0.01–1.0** (default **0.5**). Higher = longer, more sustained tails. Used by `custom` and `feedback`.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **audio** | `COMFYTV_AUDIO` | The echoed audio snapshot |

## Tips

- The built-in presets ignore the manual sliders — set **preset = custom** to hear your gain/delay/decay values.
- `feedback` mode only reads **delay_ms** and **decay**; the gains do nothing there.
- Very short delays (under ~10 ms) start to sound like comb-filtering/robotic coloration rather than distinct echoes.

## Related nodes

- **Muse Reverb (FDN)** — for dense, smeared reverberation rather than discrete repeats.
- **Audio Convolve (IR)** — real-space reverb from an impulse response.
- **Audio Modulation** — chorus/flanger for a different kind of "thickening."
