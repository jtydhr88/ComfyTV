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

## Models referenced

- `v1-5-pruned-emaonly.safetensors` — SD1.5 base (~4 GB)
- Ideogram4: `ideogram4_fp8_scaled.safetensors`, `ideogram4_unconditional_fp8_scaled.safetensors`, `qwen3vl_8b_fp8_scaled.safetensors`, `flux2-vae.safetensors` (see [docs/models.md](../../docs/models.md))
