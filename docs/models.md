**English** | [简体中文](models.zh.md)

# Model files for the shipped workflows

ComfyTV ships a curated set of ComfyUI workflows under `workflows/<kind>/`. Each one references one or more model files that ComfyUI itself must be able to find under your `ComfyUI/models/` tree. This page lists, per workflow, exactly which files are needed and where they go.

> If you'd rather plug in your **own** ComfyUI workflow (different model, different sampler, different LoRA stack), you don't need any of these — see [custom-workflows.md](custom-workflows.md) for how to drop in a custom workflow JSON + `_preset.json`.

ComfyUI normally auto-creates these subfolders on first run; if one is missing, create it manually. Folders below are relative to `ComfyUI/models/`.

---

## Generate · Text

| Workflow | Files | Folder |
|---|---|---|
| **Local Qwen3 4B** | `qwen_3_4b.safetensors` | `text_encoders/` |

Download: <https://huggingface.co/Comfy-Org/flux2-klein/tree/main/split_files/text_encoders>

---

## Generate · Image

| Workflow | Files | Folder |
|---|---|---|
| **Local SD1.5** / **Local SD1.5 I2I** | `v1-5-pruned-emaonly-fp16.safetensors` | `checkpoints/` |
| **Image Ideogram4 T2I** | `ideogram4_fp8_scaled.safetensors`, `ideogram4_unconditional_fp8_scaled.safetensors`, `qwen3vl_8b_fp8_scaled.safetensors`, `flux2-vae.safetensors` | `diffusion_models/`, `diffusion_models/`, `text_encoders/`, `vae/` |

---

## Generate · Video (LTX 2.3)

All four variants share the same base model + text encoder + LoRA stack.

| Workflow | Files | Folder |
|---|---|---|
| **Local LTX 2.3 T2V** | `ltx-2.3-22b-dev-fp8.safetensors`, `ltx-2.3-spatial-upscaler-x2-1.1.safetensors`, `ltx_2.3_22b_distilled_1.1_lora_dynamic_fro09_avg_rank_111_bf16.safetensors`, `gemma-3-12b-it-abliterated_lora_rank64_bf16.safetensors`, `gemma_3_12B_it_fp4_mixed.safetensors` | `checkpoints/`, `latent_upscale_models/`, `loras/`, `loras/`, `text_encoders/` |
| **Local LTX 2.3 I2V** | same as T2V | same |
| **Local LTX 2.3 FLF2V** | `ltx-2.3-22b-distilled-fp8.safetensors`, `gemma_3_12B_it_fp4_mixed.safetensors` | `checkpoints/`, `text_encoders/` |
| **Local LTX 2.3 IA2V** | same as T2V/I2V | same |

Download:
- <https://huggingface.co/Lightricks/LTX-2.3-fp8>
- <https://huggingface.co/Lightricks/LTX-2.3>
- <https://huggingface.co/Comfy-Org/ltx-2.3>
- <https://huggingface.co/Comfy-Org/ltx-2>

---

## Generate · Audio

| Workflow | Files | Folder |
|---|---|---|
| **ACE-Step v1 Song** | `ace_step_v1_3.5b.safetensors` | `checkpoints/` |

ACE-Step v1 ships natively in ComfyUI core — no custom node needed.

---

## Image edits

| Workflow | Files | Folder |
|---|---|---|
| **Flux Canny Edit** (image-edit) | `flux1-canny-dev.safetensors`, `t5xxl_fp16.safetensors` *(or `t5xxl_fp8_e4m3fn_scaled.safetensors`)*, `clip_l.safetensors`, `ae.safetensors` | `diffusion_models/`, `text_encoders/`, `text_encoders/`, `vae/` |
| **Flux Fill Inpaint** (inpaint) | `flux1-fill-dev.safetensors`, t5 + clip\_l + ae (same as above) | `diffusion_models/`, `text_encoders/`, `text_encoders/`, `vae/` |
| **Fooocus SDXL Inpaint** (inpaint) | `juggernautXL_version6Rundiffusion.safetensors`, `fooocus_inpaint_head.pth` | `checkpoints/`, `inpaint/` |
| **Flux Fill Outpaint** (outpaint) | same as Flux Fill Inpaint | same |
| **Fooocus SDXL Outpaint** (outpaint) | same as Fooocus SDXL Inpaint | same |
| **LaMa Erase** (erase) | `big-lama.pt` | `inpaint/` |
| **BiRefNet Cutout** (cutout) | `birefnet.safetensors` | `background_removal/` |
| **Ultrasharp 4x** (upscale) | `4x-UltraSharp.pth` | `upscale_models/` |

Download:
- Flux dev: <https://huggingface.co/Comfy-Org/flux1-dev>
- t5xxl / clip_l: <https://huggingface.co/comfyanonymous/flux_text_encoders>
- VAE (ae.safetensors): <https://huggingface.co/Comfy-Org/Lumina_Image_2.0_Repackaged>
- LaMa Erase: install [`Acly/comfyui-inpaint-nodes`](https://github.com/Acly/comfyui-inpaint-nodes) for the `INPAINT_LoadInpaintModel` node + `big-lama.pt` from its repo.
- Fooocus inpaint head: bundled with the Fooocus inpaint patch (`fooocus_inpaint_head.pth`).
- BiRefNet: native to ComfyUI core (`LoadBackgroundRemovalModel` + `RemoveBackground`); <https://huggingface.co/Comfy-Org/BiRefNet>

---

## Image variations (single-workflow N-output)

The "multi-view" (Face / Product / Character / Multi-cam 9) and the "sequence" (Story 4 / Storyboard 25) presets share the same Qwen base — **only the LoRA differs**.

| Group | Files | Folder |
|---|---|---|
| **Multi-cam / 3-view set** | `qwen_image_edit_2511_fp8mixed.safetensors`, `Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors`, `qwen-image-edit-2511-multiple-angles-lora.safetensors`, `qwen_2.5_vl_7b_fp8_scaled.safetensors`, `qwen_image_vae.safetensors` | `diffusion_models/`, `loras/`, `loras/`, `text_encoders/`, `vae/` |
| **Story 4 / Storyboard 25** | `qwen_image_edit_2509_bf16.safetensors`, `Qwen-Image-Edit-2509-Lightning-4steps-V1.0-bf16.safetensors`, `next-scene-qwen-image-lora-2509.safetensors`, `qwen_2.5_vl_7b_fp8_scaled.safetensors`, `qwen_image_vae.safetensors` | `diffusion_models/`, `loras/`, `loras/`, `text_encoders/`, `vae/` |
| **Multiangle** (3D-camera-driven) | same as the multi-view set above | same |

Download:
- Qwen Image Edit base: <https://huggingface.co/Comfy-Org/Qwen-Image-Edit_ComfyUI>
- Qwen Image base: <https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI>
- Lightning 4-step LoRA: <https://huggingface.co/lightx2v/Qwen-Image-Edit-2511-Lightning>
- Multiple-Angles LoRA: typically <https://huggingface.co/PVC-Inc/Qwen-Image-Edit-2511-Multiple-Angles-LoRA>
- Next-Scene LoRA: <https://huggingface.co/lovis93/next-scene-qwen-image-lora-2509>

---

## Relight

The with-reference and plain variants use the same model stack.

| Workflow | Files | Folder |
|---|---|---|
| **Qwen Edit 2509 Relight** (+ with-reference) | `qwen_image_edit_2509_fp8_e4m3fn.safetensors`, `Qwen-Image-Edit-2509-Lightning-4steps-V1.0-bf16.safetensors`, `Qwen-Image-Edit-2509-Relight.safetensors`, `qwen_2.5_vl_7b_fp8_scaled.safetensors`, `qwen_image_vae.safetensors` | `diffusion_models/`, `loras/`, `loras/`, `text_encoders/`, `vae/` |

---

## Panorama

| Workflow | Files | Folder |
|---|---|---|
| **Qwen-Image-Edit 2511 Image-to-Panorama** (image→pano) | `qwen_image_edit_2511_bf16.safetensors` *(or fp8mixed)*, `Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors`, `qwen_2.5_vl_7b_fp8_scaled.safetensors`, `qwen_image_vae.safetensors` | `diffusion_models/`, `loras/`, `text_encoders/`, `vae/` |
| **Qwen-Image 2512 + 360 LoRA** (text→pano) | `qwen_image_2512_fp8_e4m3fn.safetensors`, `Qwen-Image-2512-Lightning-4steps-V1.0-fp32.safetensors`, `qwen-360-diffusion-2512-int8-bf16-v2.safetensors`, `qwen_2.5_vl_7b_fp8_scaled.safetensors`, `qwen_image_vae.safetensors` | `diffusion_models/`, `loras/`, `loras/`, `text_encoders/`, `vae/` |

360 LoRA download: <https://huggingface.co/ProGamerGov/qwen-360-diffusion>

---

## Third-party custom node dependencies

A few workflows rely on a third-party ComfyUI custom node:

- **LaMa Erase** → [`Acly/comfyui-inpaint-nodes`](https://github.com/Acly/comfyui-inpaint-nodes)
- **Fooocus SDXL Inpaint / Outpaint** → uses the same `comfyui-inpaint-nodes` plugin for its `INPAINT_*` nodes.
- *(Planned, not shipped)* **Demucs Vocals / Background** → [`lum3on/ComfyUI_AudioTools`](https://github.com/lum3on/ComfyUI_AudioTools) for the `AudioStemSeparate` node.

All other workflows use only ComfyUI core nodes.

---

## Not using the shipped workflows?

You don't need to download any of the above. ComfyTV runs any ComfyUI GUI workflow JSON you drop into `workflows/<kind>/`, together with a `_preset.json` that maps stage inputs to its nodes. Build it in regular ComfyUI, save it, drop it in, restart ComfyUI, and your custom option appears in the matching stage's workflow dropdown.

See [custom-workflows.md](custom-workflows.md) for the `_preset.json` format and examples.
