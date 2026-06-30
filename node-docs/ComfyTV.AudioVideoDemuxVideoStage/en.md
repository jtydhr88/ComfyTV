# Demux · Silent Video

> Strip the audio track, keep video → silent `COMFYTV_VIDEO`. **PyAV** — pairs with **Demux · Audio Track**.

## What this node does

**Demux · Silent Video** removes audio from the source and writes a **silent** video file. Pairs with **Demux · Audio Track** on the same source: one takes sound, one takes mute picture.

Toolbar 🔀 **Demux** creates **both** nodes wired together.

## When to use it

- Drop original audio, replace with **Audio Stage** output
- Picture-only path while IA2V audio comes elsewhere
- Edit video (Clip / Crop) without touching audio twice

## How it works

- **Stage** + **▶ Run**; PyAV `silence_video`.
- Video fps / resolution unchanged; audio track removed.
- Standard snapshot model.

## Types

| Type | Notes |
|---|---|
| `COMFYTV_VIDEO` in/out | URL snapshot |

[bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## Parameters

### video
Source `COMFYTV_VIDEO`. Required.

## Outputs

| Output | Type | Downstream |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | Clip, Crop, Resize, Video Stage |

## Step by step

1. Run upstream video.
2. Click 🔀 **Demux** or add **Silent Video** manually.
3. **▶ Run** for silent clip.
4. Handle audio separately; mux via external tools or future Timeline.

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

**Q: Chain with Clip?**  
A: Yes — order depends on whether you need source audio before demux.

**Q: IA2V with silent video?**  
A: Yes — wire **audio** from another `COMFYTV_AUDIO` to **Video Stage**.

**Q: Re-encode?**  
A: Usually remux/light re-encode to drop audio; quality largely preserved.

## Related nodes

- **Demux · Audio Track**
- **Video Clip** / **Video Stage**
