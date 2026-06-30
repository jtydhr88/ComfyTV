# Video Clip

> Trim a video to a [start_s, end_s] range, keep original frame rate. **PyAV** on disk → new `COMFYTV_VIDEO` snapshot.

## What this node does

**Video Clip** cuts **[start_s, end_s]** from a full clip and drops the rest. Use it to pull the best part from a long generation, align lip-sync segments, or shorten before Crop / Resize. If **end_s** is 0 or ≤ **start_s**, duration extends to the source end.

No GPU — PyAV streams read/write; output lands in ComfyUI output as a `/view?` URL.

## When to use it

- Extract a usable segment from long T2V / I2V output
- Normalize clip length before timeline concat
- Trim then Demux or Extract Frame

## How ComfyTV designed this

- **Stage** + **▶ Run**: re-trims upstream snapshot only.
- **Snapshot**: downstream reads Clip output; change times → Run again.
- **PyAV**: `trim_video` in [`runners/media.py`](https://github.com/jtydhr88/ComfyTV/blob/main/runners/media.py).

## Types (COMFYTV_* vs native ComfyUI)

| ComfyTV type | What it is | vs ComfyUI |
|---|---|---|
| `COMFYTV_VIDEO` | Video URL snapshot | Bridge to/from `VIDEO` |

See [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## Parameters

### video (input)
Source `COMFYTV_VIDEO`. Required.

### start_s
Clip start in seconds, default 0.

### end_s
Clip end in seconds, default 5. 0 or empty → source **duration**. Must be **> start_s**.

## Outputs

| Output | Type | Meaning | Downstream |
|---|---|---|---|
| **video** | `COMFYTV_VIDEO` | Trimmed clip | Crop, Resize, Demux, Extract Frame |

## Step by step

1. Run upstream **Video Stage** or **Load Video**.
2. Add **Video Clip**, wire **video**.
3. Set **start_s** / **end_s**.
4. **▶ Run**, check preview duration.
5. Wire **Video Crop** or **Demux**.

## Full guides (recommended reading)

> This page covers **one node only**. For end-to-end workflows, multi-stage pipelines, type conversion, and design rationale, see the [ComfyTV user guides](https://github.com/jtydhr88/ComfyTV/tree/main/docs) on GitHub:

| Guide | Contents |
| --- | --- |
| [Getting started](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.md) | Install, canvas basics, per-stage Run, snapshots, Project, Image Picker |
| [Video and audio](https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.md) | Clip, crop, resize, extract frame, demux vs Generate video |

## Repository and workflows

| Resource | Link |
| --- | --- |
| **GitHub repository** | https://github.com/jtydhr88/ComfyTV |
| **User guides index** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **Built-in workflows** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **Model checklist** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |

## FAQ

**Q: end_s beyond duration?**  
A: Clamped; must still be **> start_s**.

**Q: Frame rate changed?**  
A: No — PyAV preserves source rate.

**Q: mesh2motion VIDEO?**  
A: **→ ComfyTV Video** first (Run snapshot), then Clip.

## Related nodes

- **Video Crop** / **Video Resize**
- **Demux · Audio Track** / **Silent Video**
- **→ ComfyTV Video**
