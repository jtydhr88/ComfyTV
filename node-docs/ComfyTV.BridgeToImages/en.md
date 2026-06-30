# → ComfyTV Images

> **Into-bridge**: save each frame of a ComfyUI **IMAGE batch** as PNG → **COMFYTV_IMAGES** JSON + selected **COMFYTV_IMAGE**. Requires **▶ Run**.

## What this node does

When upstream outputs **multiple IMAGE** frames (IPAdapter multi-ref, grids, frame sequences not yet VIDEO), **→ ComfyTV Image** keeps only index 0. **→ ComfyTV Images** saves **every frame** under `output/ComfyTV/bridge/`, builds ComfyTV batch JSON (index, label, image_url), and exposes **image** for **selected_index**.

Typical: plugin IMAGE batch → **→ ComfyTV Images** → **Image Picker** → edit one.

Alternative for frame sequences: IMAGE batch → **Create Video (fps)** → **→ ComfyTV Video**.

## When to use it

- Multi-ref IPAdapter / multi-view render batches
- Native batch into ComfyTV **Compare**
- Preview frames into ComfyTV picker

## How it works

- **Stage** + **▶ Run**: per-frame PNG via `_save_images_to_disk`.
- JSON: `{"images":[{"index":"1","label":"#1","image_url":"/view?…"}, …]}`.
- **selected_index** (1-based) drives **image** output; works with **Image Picker**.

## Types

| Native | ComfyTV |
|---|---|
| `IMAGE` batch | `COMFYTV_IMAGES` + selected `COMFYTV_IMAGE` |

[bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## Parameters

### images
Upstream IMAGE tensor, any batch size.

### selected_index
Which item **image** outputs, default 1.

## Outputs

| Output | Type |
|---|---|
| **images** | `COMFYTV_IMAGES` |
| **image** | `COMFYTV_IMAGE` (selected) |

## Step by step

1. Native node outputs IMAGE batch.
2. **→ ComfyTV Images**, wire, **▶ Run**.
3. **Image Picker** or **image** single output.
4. Re-run bridge after batch changes.

## Full guides (recommended reading)

> This page covers **one node only**. For end-to-end workflows, multi-stage pipelines, type conversion, and design rationale, see the [ComfyTV user guides](https://github.com/jtydhr88/ComfyTV/tree/main/docs) on GitHub:

| Guide | Contents |
| --- | --- |
| [Getting started](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.md) | Install, canvas basics, per-stage Run, snapshots, Project, Image Picker |
| [Bridge nodes](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md) | COMFYTV_* vs native types, into/out bridges, plugin examples |
| [Custom workflows](https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md) | Import your ComfyUI workflow JSON without Python changes |

## Repository and workflows

| Resource | Link |
| --- | --- |
| **GitHub repository** | https://github.com/jtydhr88/ComfyTV |
| **User guides index** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **Built-in workflows** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **Model checklist** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md |
| **Bridge source code** | https://github.com/jtydhr88/ComfyTV/blob/main/nodes/bridges.py |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |

## FAQ

**Q: Queue vs Run?**  
A: **Run** = ComfyTV stage / into-bridge snapshot (required for this node); **Queue** = execute full ComfyUI graph. Into-bridges cannot substitute Run with Queue.

**Q: Single image OK?**  
A: Yes — like **→ ComfyTV Image** plus **images** JSON.

**Q: VIDEO vs IMAGES?**  
A: VIDEO object → **→ ComfyTV Video**; IMAGE frames only → **Images** or **Create Video**.

**Q: Files?**  
A: Each under `output/ComfyTV/bridge/`.

## Related nodes

- **→ ComfyTV Image**
- **Image Picker**
- **← ComfyTV Image**
