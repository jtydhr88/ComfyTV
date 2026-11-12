**English** | [简体中文](README.zh.md)

# `image/` workflows

Workflows in this folder appear in the **Image Stage** dropdown. Take a prompt + 0..N reference images, produce one or more images.

## Stage inputs

- **Prompt** + optional **negative prompt**.
- **Reference image** (optional) — i2i workflows use the first upstream image.
- **Resolution** (`1K` / `2K` / `4K`), **aspect ratio** (`1:1`, `16:9`, etc.), **batch size** (1..8), **random seed**.

## What your workflow needs

- A `SaveImage` output node (auto-detected; multiple outputs are merged into a `COMFYTV_IMAGES` batch).
- A `CLIPTextEncode` for the prompt; t2i workflows add a second one for the negative prompt.
- An `EmptyLatentImage` / `EmptySD3LatentImage` fed by the stage's width / height / batch size.
- A `KSampler` driven by the stage's seed.
- i2i workflows: a `LoadImage` for the upstream image.

To add your own workflow see [docs/custom-workflows.md](../../docs/custom-workflows.md); to configure per-node bindings, select the stage on the canvas and open the left **ComfyTV** sidebar — see [docs/sidebar-config-editor.md](../../docs/sidebar-config-editor.md).

## What's here today

- **Local SD1.5** (`local-sd15.json` + `_preset.json`) — vanilla SD1.5 text-to-image using `v1-5-pruned-emaonly.safetensors`. Tested working.
- **Local SD1.5 I2I** (`local-sd15-i2i.json` + `_preset.json`) — same model, image-to-image via `VAEEncode + denoise<1.0`. Tested working.
- **Image Ideogram4 T2I** (`image_ideogram4_t2i.json` + `_preset.json`) — Ideogram 4 + Qwen3-VL text encoder text-to-image. Tested working.
- **Flux2 Klein Relight** (`flux2klein-relight.json` + `_preset.json`) — relight via Flux-2 Klein 9B + Sun-direction LoRA (4-step). images[0] = subject, images[1] = lighting reference (e.g. the Relight node's 3d-light render, or any image via Load Image from Asset). Output size follows the subject. The image-stage **Relight** action spawns this workflow pre-wired.
- **Qwen Product Shot (Canny)** (`qwen-product-shot.json` + `_preset.json`) — structure-locked FULL repaint: images[0] → Canny → Qwen-Image-2512 Fun ControlNet-Union + Lightning 4-step LoRA. Only the silhouette survives; colors/materials come from the prompt. To preserve the reference's own colors and materials (e.g. part-bound 3D captures) use the image-edit stage's **Qwen Edit 2511** — that's what the 3D-model-stage **Product Shot** action spawns. Output size follows the reference (~1.6MP). Tested working.
- **Qwen Image 2.1 T2I** (`qwen-image-2.1-t2i.json` + `_preset.json`) — the official Qwen Image 2.1 text-to-image graph (int8 DiT + Qwen3-VL-8B int8 encoder, 25 steps, cfg 1). Native 2K: the **2K** resolution tier gives 2048px output. Prompt → `TextEncodeQwenImage21`, which emits positive and negative from one node; the stage's negative prompt only matters if you raise cfg. Tested working (~25 s per 1K image on a 5090).
- **Qwen Image 2.1 Transparent (RGBA)** (`qwen-image-2.1-rgba.json` + `_preset.json`) — same graph; the preset wraps your prompt in the RGBA phrasing from the official template and the 2.1 VAE decodes a real alpha channel, so `SaveImage` writes an RGBA PNG with the subject on a transparent background — no matting model. Describe just the subject. Tested working (1024² pocket watch, 56% of pixels fully transparent).
- **Qwen Image 2.1 Multi-Ref Edit** (`qwen-image-2.1-multi-ref-edit.json` + `_preset.json`) — instruction editing with up to 4 images: images[0] is the edit target (output follows its size), images[1..3] are references. Refer to them with the stage's `@image_1`..`@image_4` mentions (type `@` in the prompt); the preset sets `mention_style: qwen_tags`, so they reach the model as `<image1>`..`<image4>` ("put the mug from `@image_2` in the hand of the person in `@image_1`"). Unused slots are pruned, so 1–4 images all run. Resolution / aspect ratio / batch size do not apply. For a single-image edit use the image-edit stage's **Qwen Image 2.1 Edit**. Tested working.
- **FLUX.3 Klein T2I** (`flux3-klein-t2i.json` + `_preset.json`) — the official FLUX.3 Image Klein distilled text-to-image graph: int8 DiT + Qwen3-VL-4B int8 encoder (`CLIPLoader` type `flux3`) + Flux2 VAE, `KSampler` 16 steps, euler / simple, cfg 1, so there is no negative prompt. For editing with references use the image-edit stage's **FLUX.3 Klein Edit**. Tested working (~4 s for 1024×1808 on a 5090 once loaded).
- **MOSS-Image T2I** (`moss-image-t2i.json` + `_preset.json`) — the official MOSS-Image text-to-image graph: SFT int8 DiT + Qwen3.5-9B w4a8 encoder (`CLIPLoader` type `moss_image`) + small Flux2 VAE, `KSampler` 25 steps, er_sde / simple, cfg 2.5, with the template's fixed negative prompt. It is trained on full scene captions, so write one rather than a few keywords. Tested working (~27 s for 1808×1024 on a 5090).
- **MiniMax H3 Image T2I** (`minimax-h3-image-t2i.json` + `_preset.json`) — the official MiniMax-H3-Image text-to-image template, subgraph included: int8 DiT + Qwen3-VL-32B int8 encoder (`CLIPLoader` type `minimax`) + the H3 Image VAE, `MiniMaxH3ImageConditioning` → `KSampler` 6 steps, euler / simple, cfg 1. The model is tuned for 2048×2048 of area, so pick the **2K** tier. Your prompt is sent as written. Turn on the `switch` widget on the subgraph node to have the prompt expander (`TextGenerateV2` on Qwen3.5-9B) rewrite it into a detailed caption first; that takes about 4 minutes per image on a 5090, most of it swapping the three models. One image per run. Tested (5090, about 26 seconds per 3616×2048 image and 9 seconds per 2048×2048 image with the models loaded).

## Models referenced

- `v1-5-pruned-emaonly.safetensors` — SD1.5 base (~4 GB)
- Ideogram4: `ideogram4_fp8_scaled.safetensors`, `ideogram4_unconditional_fp8_scaled.safetensors`, `qwen3vl_8b_fp8_scaled.safetensors`, `flux2-vae.safetensors` (see [docs/models.md](../../docs/models.md))
- Flux2 Klein Relight: `flux-2-klein-9b-nvfp4.safetensors` (diffusion_models), `Sun_direction_LoRA_Flux_2_Klein_9b_v1.safetensors` (loras), `qwen_3_8b_fp8mixed.safetensors` (clip), `flux2-vae.safetensors` (vae)
- Qwen Product Shot: `qwen_image_2512_fp8_e4m3fn.safetensors` (diffusion_models), `Qwen-Image-2512-Fun-Controlnet-Union-2602.safetensors` (controlnet), `Qwen-Image-Lightning-4steps-V1.0.safetensors` (loras), `qwen_2.5_vl_7b_fp8_scaled.safetensors` (clip), `qwen_image_vae.safetensors` (vae)
- Qwen Image 2.1 (T2I / Transparent / Multi-Ref Edit, ~17 GB total): `qwen_image_2.1_int8_convrot.safetensors` (diffusion_models), `qwen3vl_8b_int8_convrot.safetensors` (text_encoders), `qwen_image_2.1_vae_bf16.safetensors` (vae) — all from <https://huggingface.co/Comfy-Org/Qwen-Image-2.1>. Needs ComfyUI with `TextEncodeQwenImage21` (v0.37+).
- FLUX.3 Klein T2I: `flux3-image-klein-int8-convrot.safetensors` (diffusion_models), `qwen3vl_4b_int8_convrot.safetensors` (text_encoders), `flux2-vae.safetensors` (vae) — <https://huggingface.co/black-forest-labs/flux-3-image-klein-comfy> (gated: accept the licence on the page first)
- MOSS-Image T2I: `moss_image_sft_int8_convrot.safetensors` (diffusion_models), `qwen3.5_9b_w4a8_gptq.safetensors` (text_encoders), `flux2-vae_small.safetensors` (vae) — <https://huggingface.co/Comfy-Org/MOSS-Image>
- MiniMax H3 Image T2I: `minimax_h3_image_pruned_int8_convrot.safetensors` (diffusion_models), `qwen3vl_32b_minimax_h3_int8_convrot.safetensors` and `qwen3.5_9b_w4a8_gptq.safetensors` (text_encoders), `minimax_h3_image_vae_fp16.safetensors` (vae) — DiT and VAE at <https://huggingface.co/Comfy-Org/MiniMax-H3-Image>, the Qwen3-VL-32B encoder at <https://huggingface.co/Comfy-Org/MiniMax-H3>, the Qwen3.5-9B expander at <https://huggingface.co/Comfy-Org/Qwen3.5>
