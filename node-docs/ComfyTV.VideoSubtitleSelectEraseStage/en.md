# Subtitle Erase · Region

> **Roadmap / pending** — erase subtitles inside a user-drawn rectangle per frame. Box UI incomplete; Run raises `StageNotImplemented`.

## Intended purpose

**Subtitle Erase (Region)** inpaints a **fixed rectangle** (**region_x/y/w/h**) to remove subs or logos. More control than Smart when placement varies slightly or you only target one corner.

**region_*** fields are set by in-node box UI (hidden on sockets). Roadmap also calls for per-frame region tweaks.

> ⚠️ **Current status**: no backend, incomplete UI. Run → `StageNotImplemented`. See [roadmap.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/roadmap.md).

## When to use it (once shipped)

- Subs in a band but Smart fails
- Remove corner bug without touching main frame
- Manual fallback from Smart false positives

## Planned design

- **Stage** + snapshot; `COMFYTV_VIDEO` in/out.
- Pixel coords like **Video Crop**, but inpaint instead of discard.
- **Workaround**: **Video Crop** the subtitle band away.

## Types

| Type | Notes |
|---|---|
| `COMFYTV_VIDEO` | URL snapshot |

## Parameters

### video
Source (when implemented).

### region_x / region_y / region_w / region_h (hidden)
Box from panel UI, default 0.

## Outputs (when implemented)

| Output | Type |
|---|---|
| **video** | `COMFYTV_VIDEO` |

## Step by step (today)

1. **Not available** — Run will fail.
2. Use **Video Crop** on subtitle band meanwhile.
3. Watch roadmap for region-selection UI.

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

**Q: Smart vs Region?**  
A: Auto bottom-bar → Smart (pending); known box → Region.

**Q: Same as Video Crop?**  
A: Crop deletes pixels; Region inpaints in place.

**Q: Where is the box UI?**  
A: Not finished; hidden params only.

## Related nodes

- **Subtitle Erase (Smart)** (pending)
- **Video Crop** (✅)
