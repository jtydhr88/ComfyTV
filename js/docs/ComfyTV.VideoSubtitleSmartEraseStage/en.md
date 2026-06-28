# Subtitle Erase · Smart

> **Roadmap / pending** — auto-detect and remove burned-in subtitles. Run raises `StageNotImplemented`.

## Intended purpose

**Subtitle Erase (Smart)** targets **hard-coded subtitles** burned into pixels: detect + inpaint each frame → clean `COMFYTV_VIDEO`. No manual box — good when subtitle placement is consistent (anime clips, interviews).

> ⚠️ **Current status**: placeholder only. Run → `StageNotImplemented`. Region variant + box UI also pending. See [roadmap.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/roadmap.md).

## When to use it (once shipped)

- Remove subs before re-edit or I2V
- Batch stock footage with fixed lower-third text
- Fallback to **Subtitle Erase (Region)** when Smart fails

## Planned design

- **Stage** + snapshot; `COMFYTV_VIDEO` in/out.
- OCR/detection + video inpaint workflow (TBD).
- **Workaround**: **Video Crop** bottom band; or external tool → **→ ComfyTV Video**.

## Types

| Type | Notes |
|---|---|
| `COMFYTV_VIDEO` | URL snapshot in/out |

## Parameters

### video
Source clip (required when implemented). Wire only for layout today.

## Outputs (when implemented)

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | Subtitle-free clip |

## Step by step (today)

1. Node **not available**.
2. Bottom-only subs: try **Video Crop**.
3. Watch roadmap.

## Full guides (recommended reading)

> This page covers **one node only**. For end-to-end workflows, multi-stage pipelines, type conversion, and design rationale, see the [ComfyTV user guides](https://github.com/jtydhr88/ComfyTV/tree/main/docs) on GitHub:

| Guide | Contents |
| --- | --- |
| [Getting started](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.md) | Install, canvas basics, per-stage Run, snapshots, Project, Image Picker |
| [Video and audio](https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.md) | Clip, crop, resize, extract frame, demux vs Generate video |
| [Roadmap](https://github.com/jtydhr88/ComfyTV/blob/main/docs/roadmap.md) | Supported vs planned backends (video upscale, Demucs, etc.) |

## Repository and workflows

| Resource | Link |
| --- | --- |
| **GitHub repository** | https://github.com/jtydhr88/ComfyTV |
| **User guides index** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **Built-in workflows** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **Model checklist** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |
## FAQ

**Q: vs Region?**  
A: Smart auto-detects; Region manual rectangle (per-frame UI pending).

**Q: Soft subs in mkv?**  
A: Container tracks — strip with **Demux** / ffmpeg, not this node.

**Q: Run error expected?**  
A: Yes — not implemented.

## Related nodes

- **Subtitle Erase (Region)** (pending)
- **Video Crop** (✅)
- **→ ComfyTV Video**
