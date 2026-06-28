# Video Upscale

> **Roadmap / pending** — intended AI per-frame video enlargement (2x / 4x). Run currently raises `StageNotImplemented`; no real backend yet.

## What this node is meant to do

**Video Upscale** will upscale a `COMFYTV_VIDEO` **frame by frame** (like image **Upscale**, but for clips). **scale** reserves **2x** / **4x**. Output stays `COMFYTV_VIDEO` for Clip / Demux downstream.

> ⚠️ **Current status**: UI placeholder only. [`video_audio.py`](https://github.com/jtydhr88/ComfyTV/blob/main/nodes/stages/video_audio.py) raises `StageNotImplemented` on Run — no fake URLs. See [roadmap.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/roadmap.md).

## When to use it (once shipped)

- Enlarge low-res I2V / T2V to 1080p+
- Upscale plugin video (mesh2motion, etc.) inside ComfyTV
- Upscale before subtitle erase (also pending)

## Planned design

- Same **Stage** + **▶ Run** + **snapshot** model as other video stages.
- Likely a `workflows/` upscale graph or hybrid PyAV + model path (TBD).
- **Workaround now**: **Extract Frame** → image **Upscale** → **Create Video** (native) → **→ ComfyTV Video**.

## Types

| Type | Notes |
|---|---|
| `COMFYTV_VIDEO` in/out | URL snapshot |

[bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## Parameters

### video
Source `COMFYTV_VIDEO` (required when implemented).

### scale
**2x** or **4x** (when implemented).

## Outputs (when implemented)

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | Upscaled clip |

## Step by step (today)

1. Treat node as **not available**.
2. For enlargement: **Extract Frame** + image **Upscale** per frame; watch [roadmap.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/roadmap.md).
3. Do not expect Run to succeed.

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
| **This node's workflow folder** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/upscale |
| **Workflow README** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/upscale/README.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |
## FAQ

**Q: StageNotImplemented on Run?**  
A: Intentional placeholder — no fabricated outputs.

**Q: Upscale video today?**  
A: **Extract Frame** + **Upscale** per frame; or native upscale plugin + **→ ComfyTV Video**.

**Q: 4x slower when shipped?**  
A: Likely yes; params have no effect now.

## Related nodes

- **Upscale** (image, ✅)
- **Extract Frame** / **→ ComfyTV Video**
- **Video Resize** (geometric, ✅)
