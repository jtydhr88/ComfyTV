# Video Crop

> Crop the same rectangle on every frame. **PyAV** processing, frame rate unchanged → `COMFYTV_VIDEO`. This is a **PyAV media-processing** stage—not AI video generation via **Video Stage**.

## What this node does

**Video Crop** applies **x, y, w, h** (pixels) identically on each frame — like Image Crop but for the full clip. Removes letterbox bars, fixed overlays, or dead zones. It does not run text/image-to-video workflows.

**PyAV** re-encodes the cropped region on disk; no GPU.

## When to use it

- Remove letterbox padding
- Fixed ROI before Resize to standard resolution
- Cut bottom subtitle band (proper erase: Subtitle Erase — pending)

## How it works

- **Stage** + **▶ Run**; upstream video snapshot.
- **PyAV** `crop_video`; preserves fps and timeline.
- Rectangle must fit source frames; even **w/h** preferred for encoders.

## Types

| Type | Notes |
|---|---|
| `COMFYTV_VIDEO` in/out | URL snapshot, not `VIDEO` tensor |

[bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## Parameters

### video
Source `COMFYTV_VIDEO`.

### x / y
Top-left of crop rect in pixels.

### w / h
Crop size in pixels, default 512×512.

## Outputs

| Output | Type | Downstream |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | Resize, Demux, Extract Frame |

## Step by step

1. Run upstream video, wire **video**.
2. Set **x, y, w, h**.
3. **▶ Run**, verify crop.
4. Optional **Video Resize**.

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

**Q: Crop outside frame?**  
A: Error or clamp; keep x+w ≤ width, y+h ≤ height.

**Q: vs Subtitle Erase (Region)?**  
A: Crop is geometric; Region erase (⏳ pending) inpaints subtitles with box UI.

**Q: Frame rate changed?**  
A: No.

## Related nodes

- **Video Resize** / **Video Clip**
- **Video Subtitle Select Erase** (roadmap)
