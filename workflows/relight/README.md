**English** | [简体中文](README.zh.md)

# `relight/` workflows

Workflows in this folder appear in the **Relight** dropdown. Wire an upstream image; re-render it under new lighting (brightness, color temperature, rim-light direction) while preserving subject identity, geometry, and details.

## Stage inputs

- **Source image** (required) — from upstream.
- **Prompt** — RelightStage auto-builds it from the brightness / color / rim_light widgets (e.g. `"relight the image, with bright, natural lighting, tinted with light color #ffaa00, with a subtle rim light separating the subject from the background. Preserve the subject's identity, geometry, and details; only change lighting and shadows."`). The workflow just wires it into the text encoder.
- **Random seed**.
- Second upstream image (optional, with-reference variant only) — used as a reference for light transfer.

## What your workflow needs

- A `SaveImage` output node (auto-detected).
- A `LoadImage` for the source image.
- The model's edit encoder (Qwen-Edit uses `TextEncodeQwenImageEditPlus`, Flux-Kontext-style uses `InstructPixToPixConditioning`) for the prompt.
- A `KSampler` driven by the stage's seed.
- (Optional) 4-step Lightning LoRA to speed up Qwen-Edit-class flows.

To add your own workflow see [docs/custom-workflows.md](../../docs/custom-workflows.md); to configure per-node bindings, select the stage on the canvas and open the left **ComfyTV** sidebar — see [docs/sidebar-config-editor.md](../../docs/sidebar-config-editor.md).

## What's here today

- **Qwen Edit 2509 Relight** (`qwen-edit-2509-relight.json` + `_preset.json`) — Qwen-Image-Edit 2509 fp8 + Relight LoRA + 4-step Lightning LoRA.
- **Qwen Edit 2509 Relight (with reference)** (`qwen-edit-2509-relight-with-ref.json` + `_preset.json`) — variant that takes a second upstream image as a reference.

## Models referenced

- `qwen_image_edit_2509_fp8_e4m3fn.safetensors` → `models/diffusion_models/`
- `Qwen-Image-Edit-2509-Relight.safetensors` → `models/loras/`
- `Qwen-Image-Edit-2509-Lightning-4steps-V1.0-bf16.safetensors` → `models/loras/`
- `qwen_2.5_vl_7b_fp8_scaled.safetensors` → `models/clip/`
- `qwen_image_vae.safetensors` → `models/vae/`

Download links see [docs/models.md](../../docs/models.md).
