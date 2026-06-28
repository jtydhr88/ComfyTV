> Paint a mask to remove objects—AI infills from surroundings, no prompt, ▶ Run.

## What this node does

**Erase** shares the **mask painter** with Inpaint, but removes painted regions and **infills** from context—**no main_prompt**.

**Generative** stage (**▶ Run**). Workflows: [`workflows/erase/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/erase).

## When to use it

- Remove watermarks, pedestrians, wires, clutter
- Faster than Inpaint when you only want “gone”

## How it works

- Same `mask_data` as Inpaint; LaMa workflow uses a built-in fill prompt.
- **LaMa Erase** needs [comfyui-inpaint-nodes](https://github.com/Acly/comfyui-inpaint-nodes) + `big-lama.pt`.

## Types

`COMFYTV_IMAGE` — [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## Mask painter

| Tool | Use |
|---|---|
| **✏️ Brush** | Paint **to remove** (slightly larger than object helps) |
| **🧽 Eraser** | Fix mask |
| **Clear** | Reset |

No prompt needed.

## Parameters

### workflow

[README](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/erase/README.md) — **LaMa Erase**

### image / mask_data

Source image + hidden painter JSON.

## Outputs

| Output | Type |
|---|---|
| **image** | `COMFYTV_IMAGE` |

## Step by step

1. Install inpaint-nodes + `big-lama.pt`.
2. Add **Erase**; wire image.
3. Brush object to remove.
4. **▶ Run** (no prompt).
5. Expand mask and re-Run if needed.

## Full guides (recommended reading)

> This page covers **one node only**. For end-to-end workflows, multi-stage pipelines, type conversion, and design rationale, see the [ComfyTV user guides](https://github.com/jtydhr88/ComfyTV/tree/main/docs) on GitHub:

| Guide | Contents |
| --- | --- |
| [Getting started](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.md) | Install, canvas basics, per-stage Run, snapshots, Project, Image Picker |
| [Image tools](https://github.com/jtydhr88/ComfyTV/blob/main/docs/image-tools.md) | Crop, inpaint, outpaint, upscale, multi-angle, variation presets |
| [Model files](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md) | Checkpoints, LoRAs, and folder paths per workflow |

## Repository and workflows

| Resource | Link |
| --- | --- |
| **GitHub repository** | https://github.com/jtydhr88/ComfyTV |
| **User guides index** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **Built-in workflows** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **Model checklist** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md |
| **This node's workflow folder** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/erase |
| **Workflow README** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/erase/README.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |
## FAQ

**Q: INPAINT_ node missing?**  
A: Install comfyui-inpaint-nodes; restart.

**Q: Blurry patch?**  
A: Widen mask; or **Inpaint** with prompt for complex textures.

**Q: vs Inpaint?**  
A: Erase = remove; Inpaint = replace with described content.

## Related nodes

- **Inpaint**, **Image Edit**, **Cutout**
