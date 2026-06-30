> Edit the whole image with imperative text instructions—▶ Run a `workflows/image-edit/` workflow.

## What this node does

**Image Edit** takes a source image + **instruction main_prompt** and regenerates with edits while roughly preserving layout. No mask painter—unlike **Inpaint** (local mask) or **Outpaint** (canvas extend).

**Generative** (**▶ Run**). Built-in **Flux Canny Edit** (Canny structure guide).

## When to use it

- “Remove the bicycle”, “change dress to red”, “replace background with mountains”
- Image Picker +3s/+5s presets route here
- Before **Upscale**

## How it works

- Workflow uses upstream edges/structure; prompt = edit command.
- Re-Run after prompt changes (snapshots).

Use **imperative** language—describe the **change**, not a full scene essay.

## Types

`COMFYTV_IMAGE` — [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## Parameters

### workflow

[README](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/image-edit/README.md) — **Flux Canny Edit**

[models.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md)

### main_prompt

Examples: *remove the bicycle*, *change the dress to red*.

### image / custom_params

Source image; sidebar seed/denoise if bound.

## Outputs

| Output | Type |
|---|---|
| **image** | `COMFYTV_IMAGE` |

## Step by step

1. Wire upstream **image**.
2. Pick **Flux Canny Edit**; download models.
3. One clear **main_prompt** command.
4. **▶ Run**; iterate seed/prompt.

## Full guides (recommended reading)

> This page covers **one node only**. For end-to-end workflows, multi-stage pipelines, type conversion, and design rationale, see the [ComfyTV user guides](https://github.com/jtydhr88/ComfyTV/tree/main/docs) on GitHub:

| Guide | Contents |
| --- | --- |
| [Getting started](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.md) | Install, canvas basics, per-stage Run, snapshots, Project, Image Picker |
| [Image tools](https://github.com/jtydhr88/ComfyTV/blob/main/docs/image-tools.md) | Crop, inpaint, outpaint, upscale, multi-angle, variation presets |
| [Model files](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md) | Checkpoints, LoRAs, and folder paths per workflow |
| [Custom workflows](https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md) | Import your ComfyUI workflow JSON without Python changes |

## Repository and workflows

| Resource | Link |
| --- | --- |
| **GitHub repository** | https://github.com/jtydhr88/ComfyTV |
| **User guides index** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **Built-in workflows** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **Model checklist** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md |
| **This node's workflow folder** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/image-edit |
| **Workflow README** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/image-edit/README.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |
## FAQ

**Q: vs Inpaint?**  
A: Local mask + content → Inpaint; whole-image command → Image Edit.

**Q: Layout drift?**  
A: Narrower commands; lower denoise; new seed.

## Related nodes

- **Inpaint**, **Erase**, **Relight**, **Image Variations**, **Upscale**
