**English** | [简体中文](README.zh.md)

# `sequence/` workflows

Workflows in this folder appear in the **Image Variations** dropdown when the stage's `workflow_kind` is `sequence`. Conceptually similar to [`multiview/`](../multiview/README.md) — one run produces N images — but the branches are **sequentially chained**: frame N+1 takes frame N as input. Output is a set of N continuous frames.

Use cases: storyboard previews, scene evolution, "what happens next"-style iterative generation. Each frame uses the previous one as visual reference, keeping style + characters consistent.

## Stage inputs

- **Source / seed image** (required) — input for the first frame.
- **Prompt** — scene / story description. In the shipped workflows, each branch auto-prefixes its own story beat (frame 1 = set the scene, frame 2 = action unfolds, etc.).

## What your workflow needs

Same framework as multiview, but:

- **Chained latent** — each branch has its own `VAEEncode` consuming the previous branch's decoded output. Branch 0 takes the source image; branch N takes branch (N-1)'s output.
- **Model + LoRAs shared**, but **per-branch latent path** (unlike multiview which shares a single base latent).
- N `SaveImage` nodes, one per frame, all collected into the same output set.

To add your own workflow see [docs/custom-workflows.md](../../docs/custom-workflows.md); to configure per-node bindings, select the stage on the canvas and open the left **ComfyTV** sidebar — see [docs/sidebar-config-editor.md](../../docs/sidebar-config-editor.md).

## What's here today

Both use Qwen-Image-Edit 2511 + **Next-Scene LoRA**:

| Label | File | Frames |
|---|---|---|
| **Story 4** | `qwen-next-scene-4.json` | 4 |
| **Storyboard 25** | `qwen-next-scene-25.json` | 25 |

## Models referenced

- `qwen_image_edit_2511_fp8mixed.safetensors` → `models/diffusion_models/`
- `qwen_2.5_vl_7b_fp8_scaled.safetensors` → `models/clip/`
- `qwen_image_vae.safetensors` → `models/vae/`
- `next-scene_lora-v2-3000.safetensors` → `models/loras/`
- `Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors` → `models/loras/`
