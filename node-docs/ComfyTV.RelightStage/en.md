> Pure-frontend light source: 3D light-ball editor + prompt pass-through. No Run — feed its outputs into an Image Stage.

## What this node does

**Relight** is a light *source* node. It doesn't run any workflow itself; instead it produces two outputs for downstream stages:

| Output | Type | Content |
|---|---|---|
| **3d light** (`light_render`) | `COMFYTV_IMAGE` | The 3D light-ball scene (clay sphere + your lights) rendered in the browser from a fixed studio view |
| **light_prompt** | `COMFYTV_TEXT` | The node's prompt, passed through verbatim |

The card hosts a 3D viewport where you place directional / point / spot lights (drag gizmos, color, intensity, cone angles), with one-click **lighting presets** (three-point, Rembrandt, butterfly, rim, side). Every edit re-renders and auto-uploads the reference PNG after ~1 s.

## When to use it

- Click the **Relight** action on any image stage — it spawns this node plus an Image Stage preset to the **Flux2 Klein Relight** workflow, pre-wired: subject → `images[0]`, this node's **3d light** → `images[1]`.
- To transfer lighting from a photo instead, wire a **Load Image from Asset** node into `images[1]`.
- Wire **light_prompt** into any texts slot to reuse your lighting description.

## How it works

- The light-ball render uses a fixed output view (camera (0,6,8), fov 35) so results are reproducible.
- The render URL lives in a hidden widget; downstream image stages consume it as a normal upstream image.
- The relight workflow itself lives in `workflows/image/flux2klein-relight.json` (Flux-2 Klein 9B + Sun-direction LoRA, 4-step).

## Parameters

### main_prompt

Free-form lighting description, emitted verbatim on **light_prompt**.

### Light-ball editor

Add/remove lights (chips), per-light type / color / intensity / range / cone angles, drag gizmos in the viewport, presets row, gizmo visibility, output-view reset, camera lock.

## Step by step

1. On an image stage, click **Relight** — the pair spawns pre-wired.
2. Click a preset or place lights manually in the 3D viewport.
3. (Optional) type a lighting description into the prompt.
4. **▶ Run the Image Stage** (not this node) to get the relit image.

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
| **Relight workflow folder** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/image |
| **Workflow README** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/image/README.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |

## FAQ

**Q: Why is there no Run button?**
A: This node is a source, like the asset loaders — the downstream Image Stage runs the relight workflow.

**Q: Nothing happens downstream?**
A: Make sure the light ball has at least one light (or a reference is picked), so the wired output actually carries an image.

## Related nodes

- **Color Grade**, **Cutout**, **Multiangle**, **Image Edit**, **Load Image from Asset**
