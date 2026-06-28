# ← ComfyTV Mask

> **Out-bridge**: extract **MASK** tensor from **COMFYTV_IMAGE** (often PNG with alpha). **No ▶ Run** — loads on Queue.

## What this node does

ComfyTV **Cutout** and alpha PNGs output **`COMFYTV_IMAGE`**. ComfyUI inpaint / ControlNet need **`MASK`**. This node inverts **alpha** to mask (same as `_load_image_tensor` logic), matching ComfyUI conventions.

Shares URL input with **← ComfyTV Image**: one branch RGB, one branch mask.

## When to use it

- ComfyTV **Cutout** → native **Inpaint**
- ComfyTV edit → ControlNet Inpaint
- Split one COMFYTV_IMAGE: ← Image + ← Mask

## How it works

- Normal node, no Run.
- With alpha: `mask = 1.0 - alpha`; without: zeros.
- Output `[1,H,W]` float.

## Types

| Input | Output |
|---|---|
| `COMFYTV_IMAGE` | ComfyUI `MASK` |

[bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## Parameters

### image
**COMFYTV_IMAGE** with alpha preferred.

## Outputs

| Output | Type | Downstream |
|---|---|---|
| **MASK** | ComfyUI MASK | Inpaint, ControlNet |

## Step by step

1. **Cutout** or transparent PNG from ComfyTV.
2. Wire **← ComfyTV Mask** **image**.
3. MASK → Inpaint; RGB → **← ComfyTV Image**.

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

**Q: Wrong mask after Cutout?**  
A: Ensure PNG has alpha channel.

**Q: vs Inpaint Stage brush?**  
A: Inpaint Stage masks inside ComfyTV; this **exports** mask to native inpaint.

## Related nodes

- **← ComfyTV Image**
- **Cutout** / **Inpaint**
