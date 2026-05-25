**English** | [简体中文](README.zh.md)

# `image-edit/` workflows

Workflows in this folder appear in the **Image Edit** dropdown. Wire a source image + an instruction prompt; produce a re-imagined version — same overall composition, content changed per the prompt. Distinct from **Inpaint** (mask-based local edit) and **Outpaint** (canvas extension).

## Stage inputs

- **Source image** (required) — from upstream.
- **Prompt** — the edit instruction.
- **Random seed**.

## What your workflow needs

- A `SaveImage` output node (auto-detected).
- A `LoadImage` for the source image.
- A `CLIPTextEncode` for the prompt.
- The model's edit conditioning node (`InstructPixToPixConditioning` / Flux Canny's `Canny` + `InstructPixToPixConditioning` / Qwen-Edit's `TextEncodeQwenImageEditPlus`, etc.).
- A `KSampler` driven by the stage's seed.

To add your own workflow see [docs/custom-workflows.md](../../docs/custom-workflows.md); to configure per-node bindings, select the stage on the canvas and open the left **ComfyTV** sidebar — see [docs/sidebar-config-editor.md](../../docs/sidebar-config-editor.md).

## What's here today

- **Flux Canny Edit** (`flux-canny-edit.json` + `_preset.json`) — uses the upstream image as a Canny edge map and repaints per the prompt. Tested working.

## Models referenced

- `flux1-canny-dev_fp8.safetensors` → `models/diffusion_models/`
- `clip_l.safetensors` + `t5xxl_fp16.safetensors` → `models/clip/`
- `ae.safetensors` → `models/vae/`
