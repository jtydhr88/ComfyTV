**English** | [简体中文](README.zh.md)

# `multiangle/` workflows

Workflows in this folder appear in the **Multiangle** dropdown. The user picks a viewpoint on the 3D camera widget (azimuth / elevation / zoom); MultiangleStage auto-builds the LoRA's required `<sks> [az_kw] [el_kw] [dist_kw]` prompt. The workflow re-renders the source image from that viewpoint, preserving the subject.

## Stage inputs

- **Source image** (required) — from upstream.
- **Prompt** — already built server-side per the 3D camera (`<sks> ...` format); the workflow wires it straight into the positive text encoder. Do **not** re-build it inside the workflow.
- **Random seed**.

## What your workflow needs (Qwen-Image-Edit + fal LoRA pattern)

- A `SaveImage` output node (auto-detected).
- A `LoadImage` for the source image.
- A `FluxKontextImageScale` that scales to a model-friendly resolution.
- A `GetImageSize` (off LoadImage) to capture the source size for rescale-back.
- A `TextEncodeQwenImageEditPlus` encoding image + text (`image1` + `clip` + `vae` + `prompt`).
- A `FluxKontextMultiReferenceLatentMethod` wrapping both pos and neg conditioning.
- Model chain: UNETLoader → multiangle LoRA → Lightning LoRA → `ModelSamplingAuraFlow` (shift=3.1) → `CFGNorm`.
- A `KSampler` — 4 steps, cfg=1, euler, simple, denoise=1.0.
- After `VAEDecode`, an `ImageScale` fed by `GetImageSize`'s width/height to rescale output back to source dimensions.

To add your own workflow see [docs/custom-workflows.md](../../docs/custom-workflows.md); to configure per-node bindings, select the stage on the canvas and open the left **ComfyTV** sidebar — see [docs/sidebar-config-editor.md](../../docs/sidebar-config-editor.md).

## Prompt format (auto-built by the stage)

```
<sks> [azimuth] [elevation] [distance], [optional extra context]
```

- **8 azimuths** (every 45°): front view, front-right quarter view, right side view, back-right quarter view, back view, back-left quarter view, left side view, front-left quarter view
- **4 elevations**: low-angle shot (≤ -15°), eye-level shot (-15..15°), elevated shot (15..45°), high-angle shot (> 45°)
- **3 distances**: wide shot (zoom < 3), medium shot (3..7), close-up (≥ 7)

## What's here today

- **Qwen Edit 2511 Multiangle** (`qwen-edit-2511-multiangle.json` + `_preset.json`) — Qwen-Image-Edit 2511 fp8mixed + fal Multiple-Angles LoRA + Lightning 4-step LoRA. Tested working.

## Models referenced

- `qwen_image_edit_2511_fp8mixed.safetensors` → `models/diffusion_models/`
- `qwen_2.5_vl_7b_fp8_scaled.safetensors` → `models/clip/` (or `text_encoders/`)
- `qwen_image_vae.safetensors` → `models/vae/`
- `qwen-image-edit-2511-multiple-angles-lora.safetensors` → `models/loras/` (from [fal/Qwen-Image-Edit-2511-Multiple-Angles-LoRA](https://huggingface.co/fal/Qwen-Image-Edit-2511-Multiple-Angles-LoRA))
- `Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors` → `models/loras/`
