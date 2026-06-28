> Pick a new camera angle with the 3D widget—AI re-renders the subject, ▶ Run `workflows/multiangle/`.

## What this node does

**Multiangle** regenerates the subject from a **new camera viewpoint**. The **3D camera widget** sets **horizontal** azimuth, **vertical** pitch, and **zoom**; the stage builds `<sks> …` LoRA keywords automatically.

**Generative** (**▶ Run**). Not **Rotate** (instant bitmap spin).

## When to use it

- Need side/back product or character views
- Preview another storyboard angle
- Before **Image Variations** batch multiview

## How it works

- Widget → `horizontal_angle`, `vertical_angle`, `zoom`.
- Server composes prompt; don’t hand-edit `<sks>` structure in workflow.
- Optional **main_prompt** = subject context only.

## Types

`COMFYTV_IMAGE` — [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## 3D camera widget

- Drag ring / orbit scene → azimuth
- Pitch up/down → vertical_angle (−30…60)
- **zoom** → wide / medium / close-up

Example keywords: *front-right quarter view, eye-level shot, medium shot*.

## Parameters

### workflow

[README](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/multiangle/README.md) — **Qwen Edit 2511 Multiangle**

[models.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md)

### main_prompt (optional)

Subject hint, e.g. *modern wooden chair*.

## Outputs

| Output | Type |
|---|---|
| **image** | New-view snapshot, scaled to source size |

## Step by step

1. Download Qwen 2511 + Multiangle LoRA.
2. Wire source; aim 3D camera.
3. Optional main_prompt.
4. **▶ Run**; iterate angle/seed.

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
| **This node's workflow folder** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/multiangle |
| **Workflow README** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/multiangle/README.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |
## FAQ

**Q: vs Rotate?**  
A: Rotate = instant pixels; Multiangle = AI new view + Run.

**Q: vs Multi-cam 9?**  
A: Multiangle = one custom angle; Variations = fixed 9-angle batch.

**Q: Hand-write view prompt?**  
A: No—the widget builds `<sks>` tags.

## Related nodes

- **Image Variations**, **Rotate**, **Relight**, **Upscale**
