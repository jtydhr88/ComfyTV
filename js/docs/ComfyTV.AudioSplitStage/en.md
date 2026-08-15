# Audio Split

> Cut an audio source into two parts at one point on the waveform. Emits both halves as separate outputs.

## What this node does

**Audio Split** places a single cut point (**split_s**) on a waveform timeline and produces two audio snapshots: **audio_a** (before the cut) and **audio_b** (after it). Like Audio Trim it accepts either an audio input or a video input (whose audio track is split).

Both parts persist to the project history, so either half can feed a different branch of your graph.

## When to use it

- Split a long music generation into intro and body, using each separately
- Cut narration at a scene boundary and route the halves to different videos
- Keep both sides of a cut instead of discarding one (which Audio Trim would)

## How ComfyTV designed this

- **One cut, two outputs**: the split point is dragged on the same waveform timeline used by Audio Trim; both resulting files are written and stored.
- **Stage** + **▶ Run**: re-splits the upstream snapshot; downstream nodes read whichever half they're wired to.
- **No GPU**: PyAV on disk.

## Types (COMFYTV_* vs native ComfyUI)

| ComfyTV type | What it is | vs ComfyUI |
|---|---|---|
| `COMFYTV_AUDIO` | Audio URL snapshot | Bridge to/from `AUDIO` |
| `COMFYTV_VIDEO` | Video URL snapshot (audio track used) | Bridge to/from `VIDEO` |

## Parameters

### audio (input, optional)
Source `COMFYTV_AUDIO`. Wire this or **video**.

### video (input, optional)
Source `COMFYTV_VIDEO`; its audio track is split.

### split_s
The cut position in seconds, dragged on the waveform.

## Outputs

| Output | Type | Meaning | Downstream |
|---|---|---|---|
| **audio_a** | `COMFYTV_AUDIO` | Part before the cut | Any audio consumer |
| **audio_b** | `COMFYTV_AUDIO` | Part after the cut | Any audio consumer |

## Step by step

1. Wire an audio (or video) source.
2. Drag the cut point on the waveform; preview both sides.
3. **▶ Run**; wire **audio_a** and **audio_b** to their destinations.

## Full guides (recommended reading)

| Guide | Contents |
| --- | --- |
| [Video and audio](https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.md) | Clip, demux, mux, audio tooling |

## Repository and workflows

| Resource | Link |
| --- | --- |
| **GitHub repository** | https://github.com/jtydhr88/ComfyTV |
| **User guides index** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |

## FAQ

**Q: I only need one half.**  
A: Use **Audio Trim** instead — one range in, one output out.

**Q: split_s at 0 or beyond the end?**  
A: One side ends up empty; place the cut inside the source duration.

## Related nodes

- **Audio Trim** — keep one range
- **Audio Crossfade** — join parts back with a blend
- **Mux · Audio** — attach a part to video
