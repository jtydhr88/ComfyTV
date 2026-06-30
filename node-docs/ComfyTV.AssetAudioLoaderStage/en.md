# Load Audio from Asset

> Pick audio from the ComfyTV **project asset library**—reuse Speech/Music Stage output or imports for Video Stage, timelines, or reference audio.

## What this node does

**Load Audio from Asset** lets you browse audio assets for the current project inside the node: categories, search, entry list. A click outputs a `COMFYTV_AUDIO` snapshot—**no ▶ Run**.

Library audio typically comes from **Speech Stage**, **Music Stage**, **Demux**, or sidebar imports. Complements **Load Audio** (`input/` folder).

## When to use it

- Reuse the same voiceover without re-running Speech Stage.
- Wire generated BGM to **Video Stage → audio** (IA2V).
- Feed **Speech Stage → reference_audio** for cloning/style.
- Optional track on **Director Timeline → audio**.

## How it works (why ComfyTV is designed this way)

- **Instant stage**: Selection → snapshot; no workflow.
- **Snapshots**: Downstream Runs use the selected URL; picking another updates it.
- **Project scope**: Only artifacts under the same **Project** appear.
- **Load vs generate**: This node **loads** existing audio; **Speech/Music Stage** **creates** new audio (key FAQ distinction).

## Types (COMFYTV_* vs native ComfyUI)

| ComfyTV type | What it is | vs ComfyUI native |
|---|---|---|
| `COMFYTV_AUDIO` | Audio URL snapshot | Not `AUDIO` tensor |
| `COMFYTV_VIDEO` | Video with audio | Demux to library first |
| Native `AUDIO` | Tensor | **→ ComfyTV Audio** Bridge |

Details: [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## UI and parameters

### Asset picker

- Thumbnails/waveform (UI-dependent), categories, search.
- Empty library → run **Speech/Music Stage** or import first.

### asset_url / asset_id / category (hidden)

- UI-written; category filter persisted.

### project_id / parent_output_id

- Hidden internals.

## Outputs

| Output | Type | Meaning | Typical downstream |
|---|---|---|---|
| **audio** | `COMFYTV_AUDIO` | Selected audio snapshot | Video Stage (audio), Director Timeline (audio), Speech Stage (reference_audio) |

## Step by step for beginners

1. Add **Project** and name it.
2. Run **Speech Stage** or **Music Stage** (or import via sidebar).
3. **Add Node → Input → Load Audio from Asset**.
4. Click the target audio in the node body.
5. Wire to **Video Stage → audio** or other consumers.
6. **▶ Run** downstream if it's a generator stage.

## Full guides (recommended reading)

> This page covers **one node only**. For end-to-end workflows, multi-stage pipelines, type conversion, and design rationale, see the [ComfyTV user guides](https://github.com/jtydhr88/ComfyTV/tree/main/docs) on GitHub:

| Guide | Contents |
| --- | --- |
| [Getting started](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.md) | Install, canvas basics, per-stage Run, snapshots, Project, Image Picker |
| [Video and audio](https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.md) | Clip, crop, resize, extract frame, demux vs Generate video |
| [Generate](https://github.com/jtydhr88/ComfyTV/blob/main/docs/generate.md) | Text, Image, Video, Music, and Speech stages and workflow selection |
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

**Q: vs Load Audio (input/)?**  
A: External files → **Load Audio**. Project generated/imported → **this node**.

**Q: vs Speech Stage?**  
A: Speech **generates**; this **picks** from the library. No TTS here.

**Q: Type mismatch?**  
A: Expect `COMFYTV_AUDIO`; Bridge native `AUDIO` into the library first.

**Q: Empty after category filter?**  
A: Switch to `all`; confirm assets exist in that category.

## Related nodes

- **Load Audio** — raw `input/` files.
- **Speech Stage** / **Music Stage** — write new audio.
- **Video Stage** — consumes audio for IA2V.
- **Director Timeline** — timeline audio track.
- **Load Video from Asset** / **Load Image from Asset** — sibling nodes.
