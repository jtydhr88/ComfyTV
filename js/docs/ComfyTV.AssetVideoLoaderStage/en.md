# Load Video from Asset

> Pick a video from the ComfyTV **project asset library** for clip, demux, upscale, or other downstream steps—reuse in-project media, not raw `input/` files.

## What this node does

**Load Video from Asset** offers the same **browsing UX** as the image asset loader: categories, search, thumbnails/previews. A click immediately outputs a `COMFYTV_VIDEO` snapshot.

Library videos come from **Video Stage** runs, timeline renders, sidebar imports, etc.—scoped to the current **Project**, separate from ComfyUI's global `input/` folder.

For MP4 on disk that never entered ComfyTV, use **Load Video** (`input/`) instead.

## When to use it

- After **Timeline Render** or **Video Stage**, branch for Upscale / Clip.
- Pick a historical version from the library (Compare after Extract Frame if needed).
- **Load as asset node** from hover menus for a pre-filled node.
- Multi-shot projects: reuse clips without re-running upstream generators.

## How it works (why ComfyTV is designed this way)

- **No ▶ Run**: Click asset → output; instant Input stage.
- **Snapshots**: Downstream reads URL; won't re-run the stage that created the video.
- **Library vs input/**: Same as **Load Image from Asset**—project-scoped vs global disk folder.
- **No workflow**: Does not invoke `workflows/video/` generators.

## Types (COMFYTV_* vs native ComfyUI)

| ComfyTV type | What it is | vs ComfyUI native |
|---|---|---|
| `COMFYTV_VIDEO` | Video URL snapshot | Not `VIDEO` tensor |
| `COMFYTV_IMAGE` | Single frame | After Extract Frame, use Compare |
| Native `VIDEO` | Tensor | **→ ComfyTV Video** Bridge |

Details: [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## UI and parameters

### Asset picker

- Category tabs, search, clickable entries/thumbnails.
- Empty library → run **Video Stage** or sidebar import first.

### asset_url / asset_id / category (hidden)

- UI-maintained; `asset_url` is the output payload.
- `category` persists last filter.

### project_id / parent_output_id

- Hidden; bound to Project.

## Outputs

| Output | Type | Meaning | Typical downstream |
|---|---|---|---|
| **video** | `COMFYTV_VIDEO` | Selected video snapshot | Video Clip, Crop, Upscale, Demux, Extract Frame |

## Step by step for beginners

1. Set up a **Project** node.
2. Run **Video Stage** or import video into the library.
3. Add **Load Video from Asset**.
4. Browse and **click** the target video.
5. Wire to **Video Clip** or other Video stages.
6. **▶ Run** downstream.

## Full guides (recommended reading)

> This page covers **one node only**. For end-to-end workflows, multi-stage pipelines, type conversion, and design rationale, see the [ComfyTV user guides](https://github.com/jtydhr88/ComfyTV/tree/main/docs) on GitHub:

| Guide | Contents |
| --- | --- |
| [Getting started](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.md) | Install, canvas basics, per-stage Run, snapshots, Project, Image Picker |
| [Video and audio](https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.md) | Clip, crop, resize, extract frame, demux vs Generate video |
| [Compose](https://github.com/jtydhr88/ComfyTV/blob/main/docs/compose.md) | Image Picker, Compare, Storyboard→Shot Images, timeline |

## Repository and workflows

| Resource | Link |
| --- | --- |
| **GitHub repository** | https://github.com/jtydhr88/ComfyTV |
| **User guides index** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **Built-in workflows** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **Model checklist** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |

## FAQ

**Q: vs Load Video (input/)?**  
A: **input/** = external raw files. **Library** = project generated/imported. Generate with Video Stage; reuse with this node.

**Q: Missing a video I just ran?**  
A: Same **Project**? Refresh the node after Run completes.

**Q: Type errors?**  
A: Downstream needs `COMFYTV_VIDEO`; native tensors need Bridge.

**Q: Replace Video Stage?**  
A: No—this **selects** only; it does not **generate** video.

## Related nodes

- **Load Video** — `input/` files.
- **Video Stage** — writes new videos to the library.
- **Timeline Render** — timeline export into library.
- **Load Image from Asset** / **Load Audio from Asset** — sibling Input nodes.
