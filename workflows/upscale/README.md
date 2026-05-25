**English** | [简体中文](README.zh.md)

# `upscale/` workflows

Workflows in this folder appear in the **Upscale** dropdown. Wire an upstream image; get a higher-resolution version.

## Stage inputs

- **Source image** (required) — from upstream.
- **Scale** (`2x` / `4x`) — the shipped GAN workflow ignores this (model scale is fixed); diffusion-refine variants can consume it.
- **Prompt** (optional) — pure GAN upscalers usually don't use it; only diffusion-refine variants consume it.

## What your workflow needs

- A `SaveImage` output node (auto-detected).
- A `LoadImage` for the source image.
- GAN upscale: `UpscaleModelLoader` + `ImageUpscaleWithModel`.
- (Optional) diffusion refine chain: `VAEEncode + KSampler + VAEDecode`, usually with a very low denoise (~0.2) for sharpening without altering content.
- (Optional) rescale to target size: an `ImageScaleBy` after the GAN, with a fixed factor packed per variant ("Ultrasharp 2x" = 4x model + 0.5 scale, "Ultrasharp 4x" = no scale).

To add your own workflow see [docs/custom-workflows.md](../../docs/custom-workflows.md); to configure per-node bindings, select the stage on the canvas and open the left **ComfyTV** sidebar — see [docs/sidebar-config-editor.md](../../docs/sidebar-config-editor.md).

## What's here today

- **Ultrasharp 4x** (`ultrasharp-4x.json` + `_preset.json`) — pure GAN 4x upscale using `4x-UltraSharp.pth`. No diffusion, no prompt. Output is strictly 4× input size. Tested working.

## Models referenced

- `4x-UltraSharp.pth` → `models/upscale_models/`, ~67 MB. Any other ESRGAN-style upscaler in the same folder works too (e.g. `RealESRGAN_x4plus.safetensors`); change the corresponding loader's model name in the sidebar.
