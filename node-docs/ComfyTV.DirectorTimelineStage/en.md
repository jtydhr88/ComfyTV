# Director Timeline

> Arrange image clips and optional audio on a visual timeline, outputting structured `COMFYTV_TIMELINE`—the "edit decision list" for multi-shot short video.

## What this node does

**Director Timeline** is a **browser-side Compose** stage. The node body is a Vue timeline panel: set frame rate, drag clip lengths, place upstream images on segments, and optionally lay an **audio** track.

It does **not** export a final MP4—it outputs **`COMFYTV_TIMELINE` JSON** (`frameRate`, `durationFrames`, `segments[]`, `audioSegments[]`, etc.) for downstream **Timeline Render** to encode video.

Ideal after **Shot Images**, **Image Picker** picks, or **Load Image** assets arranged into a sequence.

## When to use it

- Lay out storyboard frames from **Shot Images** with per-shot timing.
- Add BGM to concept stills (**audio** from Speech/Music Stage or Load Audio).
- Tweak in/out frames before Render without re-running image generation.
- Multi-shot narrative: up to 24 **images** autogrow slots for segment binding.

## How it works (why ComfyTV is designed this way)

- **No ▶ Run**: Panel edits **live** into hidden `timeline_data`—instant Compose like Crop.
- **Snapshots**: Timeline JSON saves with the project; **Timeline Render** Run reads the current snapshot.
- **images socket**: Autogrow up to 24 `COMFYTV_IMAGE` slots—you drag them onto segments in the UI; wiring alone doesn't auto-fill the timeline.
- **COMFYTV_TIMELINE**: ComfyTV-specific; only **Timeline Render** and related stages consume it.

## Types (COMFYTV_* vs native ComfyUI)

| ComfyTV type | What it is | vs ComfyUI native |
|---|---|---|
| `COMFYTV_TIMELINE` | Timeline JSON snapshot | No native equivalent |
| `COMFYTV_IMAGE` | Single image | **images** slots → segments |
| `COMFYTV_AUDIO` | Audio | Optional **audio** socket |
| `COMFYTV_VIDEO` | Video | Output of Render, not this node |

Bridge for images/audio: [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## UI and parameters

### Timeline panel (node body)

- **What**: Track UI—**frame_rate** (default 24 fps), segment in/out, total duration.
- **How**: Drag from the **images** pool onto segments; reorder and resize.
- **Effect**: Defines edit structure for Render—no text prompt, timing + assets only.

### timeline_data / frame_rate (hidden)

- Serialized by the Vue panel; rarely edited on sockets.

### images (autogrow, up to 24)

- **What**: Upstream `COMFYTV_IMAGE` wires.
- **Wire**: Shot Images **images**, Picker outputs, Loaders, etc.
- **Effect**: Material pool only—unused slots don't appear on the timeline until dragged.

### audio (optional)

- **What**: Single `COMFYTV_AUDIO`.
- **Wire**: Music Stage, Load Audio, Asset Audio Loader, etc.
- **Effect**: Writes `audioSegments`; mixed on Render (workflow-dependent).

### workflow

- **None on this node**—encoding happens on **Timeline Render**.

## Outputs

| Output | Type | Meaning | Typical downstream |
|---|---|---|---|
| **timeline** | `COMFYTV_TIMELINE` | Full timeline JSON snapshot | **Timeline Render → timeline** |

## Step by step for beginners

1. Prepare assets: Run **Shot Images** or **Image Stage** + Picker.
2. Add **Director Timeline**; wire assets to **images** (autogrow).
3. (Optional) Wire BGM to **audio**.
4. Set **fps** in the panel; drag images onto segments; adjust lengths.
5. Add **Timeline Render**; wire **timeline**.
6. Pick workflow on Timeline Render; **▶ Run** for `COMFYTV_VIDEO`.

## Full guides (recommended reading)

> This page covers **one node only**. For end-to-end workflows, multi-stage pipelines, type conversion, and design rationale, see the [ComfyTV user guides](https://github.com/jtydhr88/ComfyTV/tree/main/docs) on GitHub:

| Guide | Contents |
| --- | --- |
| [Getting started](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.md) | Install, canvas basics, per-stage Run, snapshots, Project, Image Picker |
| [Compose](https://github.com/jtydhr88/ComfyTV/blob/main/docs/compose.md) | Image Picker, Compare, Storyboard→Shot Images, timeline |
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

**Q: Wired images but timeline empty?**  
A: **Drag onto segments** in the panel—wiring only fills the pool.

**Q: vs Timeline Render?**  
A: Director Timeline **edits** JSON; Timeline Render **encodes** video. Layout vs export.

**Q: No ▶ Run?**  
A: Normal—instant browser save of timeline_data.

**Q: Video Loader directly on timeline?**  
A: Segments expect **image sequences**—Extract Frame or use the video tool chain first.

**Q: Load vs generate?**  
A: Loaders supply assets; Timeline Render **generates** the final video file. This node **arranges** only.

## Related nodes

- **Timeline Render** — consumes timeline → video.
- **Shot Images** — common **images** source.
- **Image Picker** — pick frames for the timeline.
- **Load Audio** / **Music Stage** — **audio** sources.
- **Compare** — single-frame A/B, not a timeline tool.
