**English** | [简体中文](README.zh.md)

# `multiview/` workflows

Workflows in this folder appear in the **Image Variations** dropdown when the stage's `workflow_kind` is `multiview`. Each one fans the source image out into **N parallel KSampler branches inside a single ComfyUI submission**: shared model / CLIP / VAE / LoRAs, only the per-branch conditioning differs. Output is a set of images, one per angle.

Why single-prompt instead of N sequential runs:
- Model loads once
- Base image encode runs once, shared across branches
- One progress bar, one cancel point
- Result is natively a set of multiple images

## Stage inputs

- **Source image** (required) — from upstream.
- **Prompt** — subject description (e.g. *"young Asian businesswoman, 30s"*). Each branch auto-prefixes its own angle keyword in front.
- No other tunable params — the angle list is baked into the workflow.

## What your workflow needs

- One or more `SaveImage` output nodes (all collected into the same output set).
- A `LoadImage` for the source image.
- Shared model chain (UNet → multiangle LoRA → Lightning LoRA → ModelSamplingAuraFlow → CFGNorm), CLIP, VAE.
- Shared base latent: one `VAEEncode` from the scaled source image; every sampler's `latent_image` points here.
- Per branch: `TextEncodeQwenImageEditPlus` (prefixes the angle keyword onto the prompt) + `FluxKontextMultiReferenceLatentMethod` + `KSampler` + `VAEDecode` + `ImageScale` (back to source size) + `SaveImage`.

To add your own workflow see [docs/custom-workflows.md](../../docs/custom-workflows.md); to configure per-node bindings, select the stage on the canvas and open the left **ComfyTV** sidebar — see [docs/sidebar-config-editor.md](../../docs/sidebar-config-editor.md).

## What's here today

All four use Qwen-Image-Edit 2511 + fal Multiple-Angles LoRA + Lightning 4-step LoRA:

| Label | File | N branches | Subject default |
|---|---|---|---|
| **Face 3-View** | `qwen-3view-face.json` | 3 (close-up front/side/back of a face) | "a face" |
| **Product 3-View** | `qwen-3view-product.json` | 3 (front/3-quarter/back of a product) | "a product" |
| **Character 3-View** | `qwen-3view-character.json` | 3 (full-body front/side/back) | "a character" |
| **Multi-cam 9** | `qwen-9cam.json` | 9 (8 azimuths every 45° + center) | "a person" |

## Models referenced

Same set as the [Multiangle workflow](../multiangle/README.md):
- `qwen_image_edit_2511_fp8mixed.safetensors` → `models/diffusion_models/`
- `qwen_2.5_vl_7b_fp8_scaled.safetensors` → `models/clip/`
- `qwen_image_vae.safetensors` → `models/vae/`
- `qwen-image-edit-2511-multiple-angles-lora.safetensors` → `models/loras/`
- `Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors` → `models/loras/`

## Notes

- All N branches share the model + base latent, so VRAM stays bounded at single-image cost (not N×).
- The 9-cam workflow is the heaviest by wall-clock (~ 4× the 3-view variants).
- For a "give me ONE specific angle" workflow see [`workflows/multiangle/README.md`](../multiangle/README.md).
