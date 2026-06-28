> AI background removal—transparent PNG output, no prompt, ▶ Run `workflows/cutout/`.

## What this node does

**Cutout** segments the subject, removes the background, and outputs `COMFYTV_IMAGE` with **alpha transparency**. No mask, no prompt—wire image and Run.

**Generative** (**▶ Run**). Whole-image matting vs **Erase** (painted local removal).

## When to use it

- Product/person isolation before compositing
- Image Picker cutout preset
- Then **Relight** or **Upscale**

## How it works

- Segmentation model (BiRefNet) inside workflow; snapshot on Run.

## Types

`COMFYTV_IMAGE` with alpha — [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## Parameters

### workflow

[README](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/cutout/README.md) — **BiRefNet Cutout**

Model: `birefnet.safetensors` in `background_removal/` — [models.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md)

### image / custom_params

Source image; optional sidebar model override.

## Outputs

| Output | Type |
|---|---|
| **image** | Transparent PNG snapshot |

## Step by step

1. Download BiRefNet model.
2. Add **Cutout**; wire image.
3. **▶ Run**.
4. Fix edges with **Inpaint** if needed.

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
| **This node's workflow folder** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/cutout |
| **Workflow README** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/cutout/README.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |
## FAQ

**Q: Halos on edges?**  
A: Upscale first; or Inpaint edges.

**Q: vs Erase?**  
A: Cutout = auto full-image matting; Erase = painted local removal.

## Related nodes

- **Erase**, **Inpaint**, **Relight**, **Upscale**, **Bridge**
