# Timeline Render

> Encode a **Director Timeline** sequence into a finished video—the **export** step of a multi-shot timeline workflow.

## What this node does

**Timeline Render** reads upstream `COMFYTV_TIMELINE` JSON, invokes the selected **timeline workflow** backend, and **stitches/encodes** segment images (plus optional audio) into one `COMFYTV_VIDEO`.

vs Director Timeline: that node is the **edit list**; this one is the **master clip**. There is no text prompt—timing, order, and asset URLs come entirely from timeline JSON.

## When to use it

- Final step of Storyboard → Shot Images → Director Timeline to export a shareable MP4.
- Re-**Run this node only** after timeline tweaks without re-rendering all shots.
- Validate BGM vs picture length before sharing (preview in Director Timeline first).

## How it works (why ComfyTV is designed this way)

- **Stage + ▶ Run**: Executes the timeline workflow only—won't re-run upstream Shot Images / Storyboard; per-segment progress callbacks (`shot 2/5`, etc.).
- **Snapshots**: Uses the timeline snapshot Director Timeline saved; if you edited the timeline but didn't Re-Run Render, you still get the old clip—Run here again.
- **workflow dropdown**: Maps to timeline runners. Built-in **Multishot (placeholder)** is a demo stub (returns a sample video URL); production encoders are tracked on the [roadmap](https://github.com/jtydhr88/ComfyTV/blob/main/docs/roadmap.md).

## Types (COMFYTV_* vs native ComfyUI)

| ComfyTV type | What it is | vs ComfyUI native |
|---|---|---|
| `COMFYTV_TIMELINE` | Timeline JSON | **timeline** input from Director Timeline |
| `COMFYTV_VIDEO` | Video snapshot | **video** output; not native `VIDEO` tensor |
| `COMFYTV_IMAGE` | Single image | Embedded in timeline segments, not wired here |

Details: [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## UI and parameters

### workflow

- **What**: Timeline render backend; options from runners with `kind='timeline'`.
- **Built-in today**: **Multishot (placeholder)**—development stub, not a final encoder.
- **Source**: [runners/](https://github.com/jtydhr88/ComfyTV/tree/main/runners) registry + future `workflows/timeline/` files.
- **Models**: Placeholder needs none; future workflows per README/models list.
- **Effect**: Encoding/stitching behavior per backend.

### timeline

- **What**: Upstream `COMFYTV_TIMELINE` wire.
- **Wire**: **Director Timeline → timeline**.
- **Mistake**: Empty timeline/segments → invalid or placeholder output.

### custom_params (hidden)

- Sidebar-bound extra workflow parameters as timeline backends evolve.

## Outputs

| Output | Type | Meaning | Typical downstream |
|---|---|---|---|
| **video** | `COMFYTV_VIDEO` | Rendered video snapshot | Video Clip, Upscale, Demux, Compare (after Extract Frame) |

## Step by step for beginners

1. Complete **Storyboard → Shot Images → Director Timeline** (or equivalent asset chain).
2. Add **Timeline Render**; wire **timeline** from Director Timeline.
3. Pick an available **workflow** (e.g. Multishot placeholder).
4. **▶ Run**; watch per-segment progress.
5. Preview the clip; wire **Video Upscale** or branch via asset loader.
6. After timeline edits: Re-Run **this node only** (not Shot Images).

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
| **This node's workflow folder** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/timeline |
| **Workflow README** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/timeline/README.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |

## FAQ

**Q: Output is a sample video, not my frames?**  
A: **Multishot (placeholder)** intentionally returns a demo clip until real timeline workflows land.

**Q: Run does nothing?**  
A: Confirm **timeline** wired and Director Timeline has non-empty segments; check console.

**Q: vs Video Stage?**  
A: Video Stage **generates** AI video (text/image-to-video). Timeline Render **encodes arranged frames**. Generate vs stitch/export.

**Q: Gray workflow list?**  
A: Restart ComfyUI to rescan; timeline runners register at startup.

**Q: Load vs generate?**  
A: **Load Video** imports files; this node **encodes** a new master from timeline JSON. Loaders don't replace Render.

## Related nodes

- **Director Timeline** — required upstream layout.
- **Shot Images** — common segment image source.
- **Video Stage** — single-shot AI video, different use case.
- **Video Clip** / **Video Upscale** — post on the master clip.
- **Load Video from Asset** — reuse Render output from the library.
