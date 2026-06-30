# Panorama · Multi-View

> Capture multiple evenly spaced viewport shots from one 360° panorama in a single Run — outputs a `COMFYTV_IMAGES` batch for storyboards and multi-camera setups.

## What this node does

**Multi-View** sits downstream of **Panorama** and places **evenly spaced cameras** around the sphere. One Run produces **a set of flat images**. With **View count = 4**, labels are Front / Right / Back / Left — as if you stood in the center and shot in four directions.

Two outputs: **images** (full batch JSON) and **image** (the item at **selected_index**). Wire the batch to **Image Picker** to browse or edit individually.

## When to use it

- Multi-camera storyboard frames from one HDRI / generated panorama
- Orbit showcases for characters or products (3-view, 4-view)
- Consistent-environment frames for Image Variations or Video FLF2V

## How ComfyTV designed this

- **Stage** + **▶ Run**: one Run captures all viewports; this node only.
- **Snapshot**: reads upstream Panorama; re-run Panorama after changes.
- **Browser-side**: multi-viewport projection, no GPU.
- **view_count** (1–64) from in-node slider (hidden on sockets); **aspect_ratio** / **resolution** apply per viewport.

## Types (COMFYTV_* vs native ComfyUI)

| ComfyTV type | What it is | vs ComfyUI |
|---|---|---|
| `COMFYTV_PANORAMA` | Upstream panorama | Input |
| `COMFYTV_IMAGES` | Multi-image batch JSON | Not an `IMAGE` batch |
| `COMFYTV_IMAGE` | Selected item from batch | **selected_index** |

**Conversion:** into native → **← ComfyTV Image** per frame; plugin batch in → **→ ComfyTV Images**. See [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## Parameters

### panorama (input)
Upstream `COMFYTV_PANORAMA`.

### view_count (hidden, slider 1–64)
Number of shots around the horizon. 4 = cardinals; 8 = every 45°.

### aspect_ratio / resolution
Per-viewport aspect and short-side tier (1K / 2K / 4K).

### selected_index
Which batch item **image** outputs (1-based). Switch in **Image Picker** or node UI.

## Outputs

| Output | Type | Meaning | Downstream |
|---|---|---|---|
| **images** | `COMFYTV_IMAGES` | All viewports | Image Picker, Compare |
| **image** | `COMFYTV_IMAGE` | Selected frame | Single-edit stages |

## Step by step

1. Run **Panorama** (or upload).
2. Add **Multi-View**, wire **panorama**.
3. Set **View count** (e.g. 4).
4. Pick **Aspect / Resolution**.
5. **▶ Run** → **Image Picker** or per-frame editing.

## Full guides (recommended reading)

> This page covers **one node only**. For end-to-end workflows, multi-stage pipelines, type conversion, and design rationale, see the [ComfyTV user guides](https://github.com/jtydhr88/ComfyTV/tree/main/docs) on GitHub:

| Guide | Contents |
| --- | --- |
| [Getting started](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.md) | Install, canvas basics, per-stage Run, snapshots, Project, Image Picker |
| [Panorama 360°](https://github.com/jtydhr88/ComfyTV/blob/main/docs/panorama.md) | Upload/generate equirectangular, Current View, Multi-View |
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

**Q: Current View vs Multi-View?**  
A: One chosen angle → **Current View**; orbit set → **Multi-View**.

**Q: Native ComfyUI batch?**  
A: **← ComfyTV Image** per frame, or **Image Picker** then single out-bridge.

**Q: Large view_count slow?**  
A: Browser-side capture is usually fast; 4K increases file size.

## Related nodes

- **Panorama** / **Current View**
- **Image Picker**
- **Image Variations**
