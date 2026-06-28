# Extract Frame

> Grab one still from a video (first, last, middle, or a custom timestamp) as `COMFYTV_IMAGE`. Uses **PyAV** on disk — no GPU.

## What this node does

**Extract Frame** freezes one frame from a `COMFYTV_VIDEO` clip. Pick **position** or **at_seconds**, get an image snapshot. Common for **↪ Extend** (last frame → new I2V), thumbnails, or Image Edit / Upscale.

Processing uses **PyAV** (FFmpeg bindings) on the file behind the `/view?` URL — fast, zero VRAM.

## When to use it

- Last frame from an AI clip for I2V continuation
- Inspect motion or composition at a specific time
- Video → still → edit / upscale → back to video

## How ComfyTV designed this

- **Stage** + **▶ Run**: extracts from upstream video snapshot only.
- **Snapshot**: reads upstream **video** URL; re-run upstream after changes.
- **PyAV backend**: decode one frame, write PNG. See [video-and-audio.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.md).

## Types (COMFYTV_* vs native ComfyUI)

| ComfyTV type | What it is | vs ComfyUI |
|---|---|---|
| `COMFYTV_VIDEO` | Video URL snapshot | Not a ComfyUI `VIDEO` object |
| `COMFYTV_IMAGE` | Extracted frame URL | Not an `IMAGE` tensor |

**Conversion:** plugin video → **→ ComfyTV Video**; frame to tensor → **← ComfyTV Image**. See [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## Parameters

### video (input)
Upstream `COMFYTV_VIDEO`. Unwired → Run error.

### position
- **last** — final frame (extend workflows)
- **first** — opening frame
- **middle** — midpoint
- **custom** — uses **at_seconds**

### at_seconds
Timestamp in seconds when **position=custom**. Range 0–3600.

## Outputs

| Output | Type | Meaning | Downstream |
|---|---|---|---|
| **image** | `COMFYTV_IMAGE` | Extracted frame | Upscale, Image Edit, Video Stage (I2V) |

## Step by step

1. Upstream node outputs `COMFYTV_VIDEO` (e.g. **Video Stage**), Run it.
2. Add **Extract Frame**, wire **video**.
3. Set **position** (e.g. **last**) or **custom** + seconds.
4. **▶ Run**, check thumbnail.
5. Wire **Upscale** or **Video Stage** (I2V).

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

**Q: "needs upstream video"?**  
A: Run upstream video stage; confirm **video** is wired.

**Q: vs Load Video + Save Image?**  
A: Extract Frame stays in ComfyTV snapshots (`COMFYTV_IMAGE` downstream) and runs this node only.

**Q: Custom time beyond duration?**  
A: PyAV clamps to valid range; may land near the last frame.

## Related nodes

- **Video Stage** / **Load Video**
- **Video Clip**
- **↪ Extend** (toolbar) — auto last frame + new Video Stage
