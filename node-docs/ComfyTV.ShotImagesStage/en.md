# Shot Images

> Automatically run an image workflow **once per shot** from a **Storyboard**—turn a text shot list into a visual storyboard image set.

## What this node does

**Shot Images** is a **Compose** stage. It reads upstream **Storyboard** output (`COMFYTV_STORYBOARD` JSON with a `shots[]` array—prompts, durations, camera notes, etc.), then **sequentially** invokes an image workflow once per shot. Each shot yields one image; results are packaged as `COMFYTV_IMAGES`.

Think of it as the **renderer** for Storyboard: Storyboard produces **structured text**; Shot Images produces **pixels**.

Typical pipeline:

```
Storyboard (LLM shot list) → Shot Images (per-shot render) → Image Picker (pick shots to edit)
```

## When to use it

- Previz for short video / ads: AI shot list, then one-click concept frames.
- Same storyboard, different image workflows (Flux, SD, etc.) for style A/B.
- Shared character refs via **images** autogrow on every shot.
- Prepare labeled shot images for **Director Timeline**.

## How it works (why ComfyTV is designed this way)

- **Stage + ▶ Run**: Run executes **this node only**, calling the workflow per shot in order—progress shows `shot 2/6`, etc.
- **Snapshots**: After Run, batch JSON is stored in the project; downstream Picker Runs use it without re-running Shot Images.
- **workflow dropdown**: Maps to `workflows/shot-images/` plus image workflows with `kinds: ["image","shot-images"]`. ComfyTV injects each shot's prompt, resolution, and aspect_ratio into the subgraph.
- **Storyboard-driven**: Missing storyboard or empty shots fails—Run Storyboard first.

## Types (COMFYTV_* vs native ComfyUI)

| ComfyTV type | What it is | vs ComfyUI native |
|---|---|---|
| `COMFYTV_STORYBOARD` | Shot-list JSON | Storyboard → **storyboard** socket |
| `COMFYTV_IMAGES` | Multi-image batch | **images** output, one per shot |
| `COMFYTV_IMAGE` | Single image | **image** via **selected_index** |
| Native `IMAGE` | Tensor | Bridge required; this node outputs COMFYTV snapshots |

Details: [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## UI and parameters

### workflow

- **What**: Image backend from [workflows/shot-images/](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/shot-images) and multi-kind image workflows.
- **Options**: Scanned at startup from repo config; examples include **Flux Schnell**, **Local Z-Image Turbo** (install-dependent).
- **Models**: See per-workflow README and [models.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md).
- **Effect**: Visual style/quality per shot; swap workflow to A/B the same storyboard.

### resolution / aspect_ratio

- Same tiers as Image Stage (e.g. 1K short side, 1:1 / 16:9 ratios).
- **Uniform for every shot**—per-shot size changes happen in Storyboard UI or downstream Crop, not here.

### storyboard

- **What**: Upstream `COMFYTV_STORYBOARD` wire.
- **Wire**: **Storyboard → storyboard** here.
- **Effect**: `shots.length` Run iterations; each shot's `prompt` / `image_prompt` becomes that shot's generation prompt.
- **Mistake**: Editing prompts on Shot Images—edit in **Storyboard UI**, then Run here.

### images (reference autogrow)

- Up to 8 optional `COMFYTV_IMAGE` refs.
- **Same refs on every shot**—character sheets, scene refs, etc.

### selected_index

- Which batch item feeds **image** (1-based); click thumbnails to change.

### custom_params

- Sidebar-bound extra workflow params (seed, steps, etc.).

## Outputs

| Output | Type | Meaning | Typical downstream |
|---|---|---|---|
| **images** | `COMFYTV_IMAGES` | Full shot batch with labels | Image Picker, Director Timeline (images) |
| **image** | `COMFYTV_IMAGE` | Currently selected shot | Single-shot edit, Video Stage |

## Step by step for beginners

1. **Project** + **Storyboard**: premise, shot_count, duration; pick a workflow from the dropdown (e.g. Qwen3 Storyboard—may be a placeholder until the backend ships), **▶ Run**.
2. Review/edit per-shot prompts in Storyboard UI.
3. Add **Shot Images**, wire **storyboard**.
4. Pick **workflow**, **resolution**, **aspect_ratio**; optional refs on **images**.
5. **▶ Run** Shot Images; wait for per-shot progress.
6. Wire **Image Picker** or **Director Timeline**.

## Full guides (recommended reading)

> This page covers **one node only**. For end-to-end workflows, multi-stage pipelines, type conversion, and design rationale, see the [ComfyTV user guides](https://github.com/jtydhr88/ComfyTV/tree/main/docs) on GitHub:

| Guide | Contents |
| --- | --- |
| [Getting started](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.md) | Install, canvas basics, per-stage Run, snapshots, Project, Image Picker |
| [Compose](https://github.com/jtydhr88/ComfyTV/blob/main/docs/compose.md) | Image Picker, Compare, Storyboard→Shot Images, timeline |
| [Generate](https://github.com/jtydhr88/ComfyTV/blob/main/docs/generate.md) | Text, Image, Video, Music, and Speech stages and workflow selection |
| [Image tools](https://github.com/jtydhr88/ComfyTV/blob/main/docs/image-tools.md) | Crop, inpaint, outpaint, upscale, multi-angle, variation presets |

## Repository and workflows

| Resource | Link |
| --- | --- |
| **GitHub repository** | https://github.com/jtydhr88/ComfyTV |
| **User guides index** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **Built-in workflows** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **Model checklist** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md |
| **This node's workflow folder** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/shot-images |
| **Workflow README** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/shot-images/README.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |

## FAQ

**Q: "no shots" / "returned no shots"?**  
A: Run **Storyboard** with non-empty shots; verify models; check console for per-shot failures.

**Q: vs Image Stage?**  
A: Image Stage = **one prompt, N similar images**. Shot Images = **N different prompts (shots), one image each**. Batch storyboard render vs single-prompt batch.

**Q: Empty/gray workflow list?**  
A: Restart ComfyUI to rescan; confirm shot-images or multi-kind configs exist.

**Q: Manual prompts without Storyboard?**  
A: Designed for storyboard JSON; run Storyboard, edit shots in UI, then Shot Images.

**Q: Load vs generate?**  
A: Loaders **import** files; Shot Images **generates** shot frames. Mix: loaders as refs, Shot Images for finals.

## Related nodes

- **Storyboard** — required upstream; outputs COMFYTV_STORYBOARD.
- **Image Picker** — pick one shot from the batch.
- **Image Stage** — single-prompt multi-image, not storyboard pipeline.
- **Director Timeline** — arrange shot images on a timeline.
- **Text Stage** — optional premise expansion for Storyboard.
