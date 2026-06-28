> Upscale images with local models—click ▶ Run to execute a `workflows/upscale/` workflow.

## What this node does

**Upscale** takes an upstream image, runs the selected upscaling workflow on GPU, and outputs a higher-resolution `COMFYTV_IMAGE`. **Generative** stage—you must click **▶ Run** on this node.

Built-in **Ultrasharp 4x** (pure GAN 4×). **scale** (2x/4x) mainly applies to custom diffusion-refine workflows; built-in GAN always outputs 4×.

## When to use it

- Need print/large-display resolution after generation
- After **Crop** / **Color Grade**
- Image Picker “HD” preset
- **Compare** before/after

## How it works

- **Stage + Run** — runs only the bound JSON under `workflows/upscale/`.
- **Snapshots** — downstream stages use the last Upscale result until you Run Upscale again.
- Requires model files (e.g. `4x-UltraSharp.pth`).

## Types

| Type | Meaning |
|---|---|
| `COMFYTV_IMAGE` | URL snapshot |

[bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## UI and parameters

### image (input)

Required `COMFYTV_IMAGE`.

### workflow

From [`workflows/upscale/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/upscale). See [README](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/upscale/README.md).

| Built-in | Notes | Model |
|---|---|---|
| **Ultrasharp 4x** | GAN 4×, no prompt | `4x-UltraSharp.pth` in `upscale_models/` |

[models.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md)

### scale (2x / 4x)

Ignored by Ultrasharp (fixed 4×). For custom refine workflows.

### main_prompt (optional)

Unused by pure GAN; optional for custom KSampler refine.

### custom_params

Extra bindings from the ComfyTV sidebar editor.

## Outputs

| Output | Type |
|---|---|
| **image** | `COMFYTV_IMAGE` (~4× pixels for Ultrasharp) |

## Step by step

1. Add **Upscale**; wire upstream **image**.
2. Pick **Ultrasharp 4x** (download model first).
3. Optional prompt (leave empty for built-in).
4. **▶ Run**; wait for completion.
5. Wire out to **Compare** or Bridge.
6. Re-Run after source or scale changes.

## Workflows and links

| Resource | Link |
|---|---|
| upscale folder | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/upscale |
| README | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/upscale/README.md |
| Models | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md |


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
| **This node's workflow folder** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/upscale |
| **Workflow README** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/upscale/README.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |
## FAQ

**Q: Run fails / missing model?**  
A: Place `4x-UltraSharp.pth` in `models/upscale_models/`, restart.

**Q: Empty workflow list?**  
A: Check `workflows/upscale/*.json` exists.

**Q: Not 2× output?**  
A: Ultrasharp is fixed 4×—use a custom workflow for 2×.

**Q: Grade then upscale?**  
A: Typical order; re-Run Upscale after grading changes.

## Related nodes

- **Image Stage**, **Crop**, **Color Grade**, **Compare**, **Bridge**
