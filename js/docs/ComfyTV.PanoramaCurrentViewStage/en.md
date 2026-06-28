# Panorama · Current View

> Aim anywhere inside the 360° panorama viewer and capture the current viewport as a flat image (`COMFYTV_IMAGE`).

## What this node does

**Current View** sits downstream of **Panorama** and includes its own interactive viewer. Drag inside the sphere to aim, then release or click **▶ Run** — ComfyTV captures that viewport as a **perspective slice** from the equirectangular panorama. The output is a normal flat image for Image Edit, Video Stage, etc.

Panorama owns the full 360° sphere; Current View owns **one window** looking out from the center.

## When to use it

- Pick a camera angle from an HDRI or generated panorama
- Turn a 360° environment into a storyboard frame or I2V start image
- Preview **Aspect / Resolution** before downstream editing

## How ComfyTV designed this

- **Stage** with **▶ Run** — executes this capture only, not the full graph queue.
- **Snapshot**: **panorama** input is the upstream Panorama snapshot; re-run Panorama after changing it, then Run Current View.
- **Browser-side**: viewport projection runs instantly in the browser (no GPU), same 3D engine as Panorama.
- **yaw / pitch / fov / aspect_ratio / resolution** are driven by the in-node Vue panel (hidden on the node socket list). Preview frame locks to aspect ratio — WYSIWYG.

## Types (COMFYTV_* vs native ComfyUI)

| ComfyTV type | What it is | vs ComfyUI |
|---|---|---|
| `COMFYTV_PANORAMA` | Upstream panorama URL | Input |
| `COMFYTV_IMAGE` | Captured flat image URL | Not an `IMAGE` tensor |

**Conversion:** for IPAdapter / ControlNet → **← ComfyTV Image**; plugin output into ComfyTV → **→ ComfyTV Image**. See [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## Parameters

### panorama (input)
Upstream **Panorama** `COMFYTV_PANORAMA`.

### yaw / pitch / fov (hidden, panel-driven)
- **yaw** (-180…180°): horizontal turn, 0 = forward
- **pitch** (-89…89°): elevation, 0 = horizon
- **fov** (10…120°): vertical field of view, default 75°

### aspect_ratio
Capture aspect ratio (16:9, 1:1, …). Preview locks to this.

### resolution
Short-side tier: **1K**=1024, **2K**=2048, **4K**=4096.

## Outputs

| Output | Type | Meaning | Downstream |
|---|---|---|---|
| **image** | `COMFYTV_IMAGE` | Viewport screenshot | Image Edit, Upscale, Video Stage (I2V), Image Picker |

## Step by step

1. Have **Panorama** on canvas with a Run snapshot (or upload).
2. Add **Panorama · Current View**, wire **panorama**.
3. Drag in the viewer to the desired angle.
4. Set **Aspect** and **Resolution**.
5. **▶ Run**, check thumbnail, wire downstream.

## Full guides (recommended reading)

> This page covers **one node only**. For end-to-end workflows, multi-stage pipelines, type conversion, and design rationale, see the [ComfyTV user guides](https://github.com/jtydhr88/ComfyTV/tree/main/docs) on GitHub:

| Guide | Contents |
| --- | --- |
| [Getting started](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.md) | Install, canvas basics, per-stage Run, snapshots, Project, Image Picker |
| [Panorama 360°](https://github.com/jtydhr88/ComfyTV/blob/main/docs/panorama.md) | Upload/generate equirectangular, Current View, Multi-View |

## Repository and workflows

| Resource | Link |
| --- | --- |
| **GitHub repository** | https://github.com/jtydhr88/ComfyTV |
| **User guides index** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **Built-in workflows** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **Model checklist** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |

## FAQ

**Q: Capture doesn't match preview?**  
A: Set the angle before Run; change angle → Run again.

**Q: Native IMAGE output?**  
A: Add **← ComfyTV Image** after this node.

**Q: Stale image after Panorama changed?**  
A: Re-run Panorama, then Current View — downstream reads upstream snapshots.

## Related nodes

- **Panorama** — 360° source
- **Panorama · Multi-View** — many angles at once
- **Image Edit** / **Video Stage** — common downstream
