> Extend the canvas outward and fill new areas with AI—drag padding handles, describe the whole image, ▶ Run.

## What this node does

**Outpaint** enlarges the canvas around your image and fills new regions with a diffusion model while preserving the center. Drag edge handles (or set pad pixels) and write **main_prompt** describing the **entire finished** image.

**Generative** stage—requires **▶ Run**. Workflows: [`workflows/outpaint/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/outpaint).

## When to use it

- Change aspect ratio without re-generating from scratch
- Add environment space around a subject
- Image Picker outpaint preset
- Then **Upscale** or **Relight**

## How it works

- Passes `pad_*` and `feathering` to `ImagePadForOutpaint`—**no mask painter**.
- Prompt = full scene (subject + environment + style), not “extend left”.
- Snapshots—re-Run after pad/prompt changes.

## Types

`COMFYTV_IMAGE` in/out — [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## UI and parameters

### image

Source `COMFYTV_IMAGE`.

### workflow

[README](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/outpaint/README.md)

| Built-in | Models |
|---|---|
| **Flux Fill Outpaint** | flux1-fill-dev + t5 + clip_l + ae |
| **Fooocus SDXL Outpaint** | comfyui-inpaint-nodes + SDXL |

[models.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md)

### pad_* / handles (hidden)

`pad_left/top/right/bottom` from preview handles.

### feathering (default 40)

Soft blend at seams, 0–256 px.

### main_prompt

Whole-scene description, e.g. *“hiker on a forest path, golden hour, photorealistic”*.

### custom_params

Sidebar extras (seed, …).

## Outputs

| Output | Type |
|---|---|
| **image** | `COMFYTV_IMAGE` (larger canvas) |

## Step by step

1. Add **Outpaint**; wire image.
2. Pick workflow (Flux Fill recommended).
3. Drag edge handles to expand.
4. Write full-scene **main_prompt**.
5. **▶ Run**.
6. Tweak pad/prompt/seed → Run again.

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
| **This node's workflow folder** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/outpaint |
| **Workflow README** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/outpaint/README.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |
## FAQ

**Q: vs Inpaint?**  
A: Outpaint = expand canvas; Inpaint = paint mask on existing pixels.

**Q: Blurry seams?**  
A: Increase feathering; richer prompt; new seed.

**Q: Fooocus errors?**  
A: Install comfyui-inpaint-nodes per README.

## Related nodes

- **Inpaint**, **Image Edit**, **Upscale**, **Crop**
