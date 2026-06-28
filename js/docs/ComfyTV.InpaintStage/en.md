> Paint a mask, describe what should appear there, ▶ Run a `workflows/inpaint/` workflow.

## What this node does

**Inpaint** lets you **paint a mask** on the upstream image, then **main_prompt** describes what should appear in the masked region. Run regenerates only that area.

**Generative** stage (**▶ Run**). Contrast **Erase** (no prompt, remove objects). Workflows: [`workflows/inpaint/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/inpaint).

## When to use it

- Replace faces, change clothes, add/remove objects locally
- Fix AI artifacts in one spot
- Image Picker inpaint + mask painter

## How it works

- Mask painter → hidden `mask_data`; baked into workflow on Run.
- Runs only this stage’s sub-workflow; snapshots for downstream.

## Types

`COMFYTV_IMAGE` — [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## Mask Painter (beginners)

| Tool | Role |
|---|---|
| **✏️ Brush** | Paint region to regenerate |
| **🧽 Eraser** | Remove mask |
| **▭ Rect / ◯ Ellipse** | Shape helpers |
| **① Number** | Numbered markers |
| **Size / opacity / hardness** | Edge softness |
| **Clear** | Wipe mask |

Mask = **where**; **main_prompt** = **what** there.

## Parameters

### image

Source `COMFYTV_IMAGE`.

### workflow

[README](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/inpaint/README.md)

| Built-in | Notes |
|---|---|
| **Flux Fill Inpaint** | Recommended |
| **Fooocus SDXL Inpaint** | Needs comfyui-inpaint-nodes |

[models.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md)

### main_prompt

Content **inside** the mask, e.g. *“a wooden chair”*.

### mask_data (hidden)

Painter JSON from UI.

## Outputs

| Output | Type |
|---|---|
| **image** | `COMFYTV_IMAGE` |

## Step by step

1. Add **Inpaint**; wire image.
2. Pick **Flux Fill Inpaint**.
3. **Brush** the region to change.
4. Write **main_prompt**.
5. **▶ Run**; iterate mask/prompt/seed.

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
| **This node's workflow folder** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/inpaint |
| **Workflow README** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/inpaint/README.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |
## FAQ

**Q: Whole image changed?**  
A: Mask too large or prompt describes full scene—narrow both.

**Q: Mask ignored?**  
A: Ensure visible mask before Run; don’t Clear accidentally.

**Q: vs Erase?**  
A: Inpaint = new content + prompt; Erase = remove + infill, no prompt.

## Related nodes

- **Erase**, **Outpaint**, **Image Edit**, **Upscale**
