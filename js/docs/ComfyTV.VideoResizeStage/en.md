# Video Resize

> Change output width/height (-1 keeps aspect). Frame rate unchanged. **PyAV** resample → `COMFYTV_VIDEO`. This is a **PyAV media-processing** stage—not AI video generation via **Video Stage**.

## What this node does

**Video Resize** scales the full clip to **width × height**. Set **width** or **height** to **-1** to derive from the other dimension and source aspect ratio (ffmpeg-style). Use it to normalize resolution or shrink file size. It does not run text/image-to-video workflows.

**PyAV** backend; no GPU.

## When to use it

- Scale generations to 720p / 1080p for delivery
- Standardize size after Crop
- Smaller files before Demux / separation (Demucs pending)

## How it works

- **Stage** + **▶ Run**; upstream snapshot.
- **PyAV** `resize_video`; fps preserved.
- At least one dimension must be positive; both -1 is invalid.

## Types

| Type | Notes |
|---|---|
| `COMFYTV_VIDEO` | URL snapshot |

[bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## Parameters

### video
Source `COMFYTV_VIDEO`.

### width / height
Target pixels, default 1280×720. Either may be **-1**.

## Outputs

| Output | Type | Downstream |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | Any video stage |

## Step by step

1. Wire upstream **video**, Run upstream.
2. Set **width/height** (e.g. 1280, 720).
3. **▶ Run**.
4. If both dimensions are fixed and ratio differs from source, image stretches — use -1 on one axis to preserve aspect.

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

**Q: Stretched picture?**  
A: Fixed width+height with wrong ratio stretches; try **width=1280, height=-1**.

**Q: vs Video Upscale?**  
A: Resize is geometric; Upscale (⏳ pending) is AI per-frame enlargement.

**Q: mesh2motion first?**  
A: **→ ComfyTV Video**, then Resize.

## Related nodes

- **Video Crop** / **Video Clip**
- **Video Upscale** (roadmap)
