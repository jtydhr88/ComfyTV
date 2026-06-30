> Relight with brightness/color/rim controls or a reference image—▶ Run `workflows/relight/`.

## What this node does

**Relight** re-renders lighting while preserving subject identity/geometry. Sliders for **brightness**, **color**, **rim light**, optional **main_prompt**; or **with reference** workflow + 2nd image for light transfer.

**Generative** (**▶ Run**). Complements **Color Grade** (instant GLSL).

## When to use it

- Flat product/portrait → cinematic light
- Image Picker “cinematic lighting” preset
- After **Cutout**

## How it works

- Server composes an English lighting instruction from widgets + prompt.
- with-reference: **images[0]** subject, **images[1]** light reference.

## Types

`COMFYTV_IMAGE` — [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## Parameters

### workflow

[README](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/relight/README.md)

| Built-in | Notes |
|---|---|
| **Qwen Edit 2509 Relight** | Default |
| **… (with reference)** | Needs 2nd image |

[models.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md)

### brightness (0–100), color, rim_light, main_prompt

Widget-driven relight; optional extra text.

## Outputs

| Output | Type |
|---|---|
| **image** | `COMFYTV_IMAGE` |

## Step by step

1. Download Qwen Relight models/LoRAs.
2. Wire subject; pick workflow.
3. Tune widgets; **▶ Run**.
4. For reference transfer: 2nd image + with-reference workflow.

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
| **This node's workflow folder** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/relight |
| **Workflow README** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/relight/README.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |
## FAQ

**Q: vs Color Grade?**  
A: Grade = instant; Relight = AI relight, Run + models.

**Q: Reference ignored?**  
A: Correct workflow variant + wired 2nd slot + re-Run.

## Related nodes

- **Color Grade**, **Cutout**, **Multiangle**, **Image Edit**
