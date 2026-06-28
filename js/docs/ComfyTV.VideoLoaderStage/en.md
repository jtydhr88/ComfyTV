# Load Video

> Pick or upload a local video from ComfyUI's `input/` folder as the **starting point** for ComfyTV video pipelines—clip, extract frames, demux, and more.

## What this node does

**Load Video** is a ComfyTV **Input** stage. It does not run AI models—it registers a video file from `input/` (or uploaded into that folder) as a project **snapshot** of type `COMFYTV_VIDEO`.

The node body previews the selected clip. Downstream stages such as **Video Clip**, **Extract Frame**, and **Demux** read that snapshot.

Unlike **Load Video from Asset**, this targets **raw files on disk**; the asset loader browses the current project's library from stage runs and sidebar imports.

## When to use it

- You have MP4/WebM/MOV footage and want step-by-step ComfyTV editing inside ComfyUI.
- You exported a clip from another editor into `input/` and select it here.
- You need source footage before native ComfyTV video tools (most pipelines start from images instead).
- You bridge native ComfyUI `VIDEO` tensors into ComfyTV (see Types).

## How it works (why ComfyTV is designed this way)

- **Stage vs Run**: **No ▶ Run**. Dropdown selection or upload updates output instantly without queuing the full graph.
- **Snapshots**: The chosen URL is stored in the project; downstream Runs use it. Re-select here if you change the source file.
- **No workflow**: File registration only—no `workflows/video/` generator backend.

## Types (COMFYTV_* vs native ComfyUI)

| ComfyTV type | What it is | vs ComfyUI native |
|---|---|---|
| `COMFYTV_VIDEO` | Video file URL snapshot | Not an in-memory `VIDEO` object |
| `COMFYTV_AUDIO` | Audio snapshot | Bridge from native `AUDIO` |
| `COMFYTV_IMAGE` | Single-image snapshot | After extract-frame, use edit stages or Bridge |

**Conversion:**

- Native → ComfyTV: `→ ComfyTV Video` (Run to snapshot)
- ComfyTV → native: `← ComfyTV Video`

Details: [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## UI and parameters

### video

- **What**: Dropdown of video files in **`input/`** plus **upload**.
- **What to set**: Pick an existing file or upload (writes to `input/`).
- **Effect**: Defines the source for the whole downstream chain; use common containers (MP4, etc.).
- **Common mistake**: Looking here for **Video Stage** outputs—use **Load Video from Asset** instead.

### project_id / parent_output_id (internal)

- Hidden; maintained by Project and graph wiring.

## Outputs

| Output | Type | Meaning | Typical downstream |
|---|---|---|---|
| **video** | `COMFYTV_VIDEO` | Selected video snapshot | Video Clip, Video Crop, Extract Frame, Demux, Video Upscale |

## Step by step for beginners

1. **Add Node → ComfyTV → Input → Load Video**.
2. Add a **Project** node (recommended).
3. Place files in **`input/`** or upload on this node.
4. Select in the dropdown; confirm preview—**no Run needed**.
5. Wire **video** to e.g. **Video Clip** and set in/out points.
6. **▶ Run** the downstream stage.

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

**Q: Load Video vs Load Video from Asset?**  
A: This node = raw **`input/`** files. Asset loader = **project library** after generation/import.

**Q: Type mismatch downstream?**  
A: Sockets must expect `COMFYTV_VIDEO`. Native `VIDEO` needs **→ ComfyTV Video** Bridge.

**Q: vs Video Stage (AI generation)?**  
A: This only **loads existing files**—no text/image-to-video. Use **Generate → Video Stage** to create clips.

**Q: Upload not appearing in dropdown?**  
A: Refresh the page; confirm the extension is recognized as video.

## Related nodes

- **Load Video from Asset** — project library picker.
- **Load Audio** — audio Input counterpart.
- **Video Clip** / **Extract Frame** — common first downstream steps.
- **→ ComfyTV Video** (Bridge) — import native tensors.
