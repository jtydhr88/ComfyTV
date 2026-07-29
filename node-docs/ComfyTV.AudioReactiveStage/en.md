# Audio Reactive

> Turn a frequency band's loudness over time into animation keyframes — so a parameter follows the music's energy.

## What this node does

**Audio Reactive** tracks the loudness envelope of a chosen frequency band (bass, mid, high, full, or a custom range) across the whole track and converts it into a stream of animation **keyframes**. As the bass thumps, the mapped field rises and falls with it. Unlike **Audio Beats & Notes** (which fires on discrete events), this produces a smooth, continuous curve you can attack/release-shape and remap to any range.

It accepts a `COMFYTV_AUDIO` snapshot or a `COMFYTV_VIDEO` (its audio track is used; audio takes priority). It outputs `COMFYTV_TEXT` keyframes and has a ▶ **Run**.

To feed native ComfyUI `AUDIO` in or out, insert a **Bridge** — see [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## When to use it

- Make an object's scale breathe with the bass of a music track.
- Drive opacity, position, or rotation from the overall energy of a mix.
- Create continuous audio-driven motion rather than beat-by-beat pulses.

## Parameters

### band
Which frequency range to follow: `bass` (default, 20–160 Hz), `mid` (160–2000 Hz), `high` (2000–8000 Hz), `full` (20–16000 Hz), or `custom` (use **freq_lo**/**freq_hi**).

### freq_lo / freq_hi
Custom band edges in Hz, used only when **band** is `custom`. **freq_lo** range **10 to 16000**, default **40**; **freq_hi** range **20 to 16000**, default **200**.

### attack
How quickly the envelope rises when energy increases, in seconds. Range **0.001 to 1.0**, default **0.02**. Short = snappy response to transients.

### release
How quickly the envelope falls when energy drops, in seconds. Range **0.01 to 2.0**, default **0.25**. Longer = smoother, more sustained motion.

### rate
Keyframes generated per second (temporal resolution of the curve). Range **1 to 60**, default **10**. Match it to your output frame rate for smooth motion.

### min_value / max_value
The output range the envelope is remapped into: quietest maps to **min_value**, loudest to **max_value**. Both range **-1000 to 1000**; defaults **0** and **1**. Swap them to invert the response.

### gain
Multiplier applied to the envelope before remapping. Range **0.1 to 8**, default **1.0**. Raise it to make a quiet track drive the full range.

### field
Which animation field the keyframes drive: `v` (default), `scale`, `opacity`, `x`, `y`, or `rotation`.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **keyframes** | `COMFYTV_TEXT` | The chosen **field** keyed to follow the band's loudness envelope |

## Tips

- Lower **attack** for punchy, transient-following motion; raise **release** to avoid jittery flicker.
- If a quiet mix barely moves the field, raise **gain** or narrow **min/max** — or pick a busier band.
- Set **rate** to your project's fps so keyframes land on frames.

## Related nodes

- **Audio Beats & Notes** — discrete beat/onset events instead of a continuous envelope.
- **Audio Meter Overlay** — burn a live level meter onto a video for reference.
