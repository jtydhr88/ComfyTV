# Audio Trim

> Cut audio to a [start_s, end_s] range on a waveform timeline. Accepts audio or video input; emits a single trimmed audio snapshot.

## What this node does

**Audio Trim** cuts **[start_s, end_s]** out of an audio source and drops the rest. The card shows a waveform with draggable in/out handles and a preview player, so you set the range by ear and eye rather than typing numbers. If **end_s** is 0 or ≤ **start_s**, the range extends to the source end.

It accepts either a `COMFYTV_AUDIO` input or a `COMFYTV_VIDEO` input — wire a video and it trims that video's audio track directly, no demux step needed.

## When to use it

- Cut a generated music track down to your film's length
- Isolate the usable take from a long speech/vocal generation
- Pull a section of a video's soundtrack without demuxing first

## How ComfyTV designed this

- **Stage** + **▶ Run**: re-trims the upstream snapshot only; downstream reads the trimmed output.
- **Waveform editing**: the in/out handles live on a shared media-trim timeline (the same interaction as video trim), with click-to-seek preview.
- **No GPU**: PyAV stream copy/re-encode on disk; output lands as a `/view?` URL snapshot.

## Types (COMFYTV_* vs native ComfyUI)

| ComfyTV type | What it is | vs ComfyUI |
|---|---|---|
| `COMFYTV_AUDIO` | Audio URL snapshot | Bridge to/from `AUDIO` |
| `COMFYTV_VIDEO` | Video URL snapshot (audio track used) | Bridge to/from `VIDEO` |

## Parameters

### audio (input, optional)
Source `COMFYTV_AUDIO`. Wire this or **video**.

### video (input, optional)
Source `COMFYTV_VIDEO`; its audio track is trimmed.

### start_s / end_s
The kept range in seconds, set by dragging the waveform handles. `end_s` 0 → source end; must otherwise be > `start_s`.

## Outputs

| Output | Type | Meaning | Downstream |
|---|---|---|---|
| **audio** | `COMFYTV_AUDIO` | Trimmed audio | Mux · Audio, Audio Mix, any Audio FX |

## Step by step

1. Run an upstream **Audio Stage** (or wire a video).
2. Add **Audio Trim**, wire the source.
3. Drag the in/out handles on the waveform; preview.
4. **▶ Run**; wire **audio** downstream (e.g. **Mux · Audio**).

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

**Q: Both audio and video wired?**  
A: The audio input wins; wire exactly one for clarity.

**Q: Does it re-encode?**  
A: Output is written as a clean audio file; sample rate follows the source.

## Related nodes

- **Audio Split** — cut one source into two parts at a point
- **Demux · Audio Track** — extract audio without trimming
- **Mux · Audio** — put trimmed audio onto a video
