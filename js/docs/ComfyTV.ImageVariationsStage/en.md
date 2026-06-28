> One Run expands a source image into multiview or story-sequence batches—workflows from multiview/ and sequence/.

## What this node does

**Image Variations** fans one upstream image into **related multiples**: **multiview** (parallel camera angles) or **sequence** (chained next-scene frames). Outputs **images** (`COMFYTV_IMAGES` batch) + **image** (selected `COMFYTV_IMAGE`).

**Generative** (**▶ Run**). Image Picker presets auto-insert this node with workflow preselected.

## When to use it

- Character/product turnarounds, 9-camera boards
- 4- or 25-frame story progression
- Faster than running **Multiangle** N times

## How it works

- **workflow** merges [`multiview/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/multiview) + [`sequence/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/sequence) labels.
- **multiview**: shared model, N parallel samplers, auto angle prefixes per branch.
- **sequence**: frame N+1 uses frame N; Storyboard 25 may drift after ~10 frames.
- **variant_count** is informational; **selected_index** picks **image** output.

## Types

| Type | Role |
|---|---|
| `COMFYTV_IMAGE` | Source / selected output |
| `COMFYTV_IMAGES` | Full batch JSON |

[bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## Toolbar preset ↔ workflow table

(from [image-tools.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/image-tools.md))

| Preset | Workflow | Output | Backend | Kind |
|---|---|---|---|---|
| 🎬 **Multi-cam 9-grid** | `Multi-cam 9` | 9 batch | Qwen Multiple-Angles LoRA, 9 parallel | multiview |
| 👤 **Face 3-view** | `Face 3-View` | 3 (front / 45° / side) | same | multiview |
| 📦 **Product 3-view** | `Product 3-View` | 3 (front / side / back) | same | multiview |
| 🧍 **Character 3-view** | `Character 3-View` | 3 full-body | same | multiview |
| 📖 **Story progression (4)** | `Story 4` | 4 batch | Qwen Next-Scene LoRA, chained | sequence |
| 🎞 **25-grid storyboard** | `Storyboard 25` | 25 batch | same chain; **may drift ~10+ frames** | sequence |
| 🎥 **Cinematic lighting** | — | single | routes to **Relight Stage** | (not this node) |
| ⏱️ **Project +3s / +5s** | — | single | routes to **Image Edit Stage** | (not this node) |

**multiview prompt**: subject description—angles auto-prefixed.  
**sequence prompt**: scene/story—per-frame rhythm keywords auto-added.

## Parameters

### workflow

- [multiview README](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/multiview/README.md)
- [sequence README](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/sequence/README.md)

### variant_count, main_prompt, selected_index, custom_params

Count display; subject/scene text; 1-based pick; sidebar seed.

## Outputs

| Output | Type |
|---|---|
| **images** | `COMFYTV_IMAGES` |
| **image** | `COMFYTV_IMAGE` |

## Step by step

1. Image Picker preset or add **Image Variations**.
2. Wire source; confirm **workflow**.
3. **main_prompt** for subject/scene.
4. **▶ Run** (sequence/25 slower).
5. Pick thumbnail / **selected_index**; wire **image** or **images** → Picker.

## Full guides (recommended reading)

> This page covers **one node only**. For end-to-end workflows, multi-stage pipelines, type conversion, and design rationale, see the [ComfyTV user guides](https://github.com/jtydhr88/ComfyTV/tree/main/docs) on GitHub:

| Guide | Contents |
| --- | --- |
| [Getting started](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.md) | Install, canvas basics, per-stage Run, snapshots, Project, Image Picker |
| [Image tools](https://github.com/jtydhr88/ComfyTV/blob/main/docs/image-tools.md) | Crop, inpaint, outpaint, upscale, multi-angle, variation presets |
| [Model files](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md) | Checkpoints, LoRAs, and folder paths per workflow |
| [Compose](https://github.com/jtydhr88/ComfyTV/blob/main/docs/compose.md) | Image Picker, Compare, Storyboard→Shot Images, timeline |

## Repository and workflows

| Resource | Link |
| --- | --- |
| **GitHub repository** | https://github.com/jtydhr88/ComfyTV |
| **User guides index** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **Built-in workflows** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **Model checklist** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md |
| **This node's workflow folder** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/multiview |
| **Workflow README** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/multiview/README.md |
| **Sequence workflows** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/sequence |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |
## FAQ

**Q: variant_count doesn’t change output count?**  
A: Count is fixed per workflow—switch workflow instead.

**Q: multiview vs sequence?**  
A: Same subject angles → multiview; narrative next frames → sequence.

**Q: Storyboard 25 drifts?**  
A: Known long-chain limit—try Story 4 or shorter runs.

**Q: vs Multiangle?**  
A: Multiangle = one free 3D angle; Variations = preset N images per Run.

## Related nodes

- **Multiangle**, **Image Picker**, **Relight**, **Image Edit**, **Grid Split**
