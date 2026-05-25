**English** | [简体中文](README.zh.md)

# `panorama/` workflows

Workflows in this folder appear in the **Panorama** dropdown. Produce a 360° equirectangular panorama from a text description (and optionally a reference image).

## Stage inputs

- **Prompt** — the stage auto-prepends the LoRA trigger phrase `"equirectangular 360 degree panorama, "`, so the workflow wires it straight into the text encoder. Do **not** re-prepend it inside the workflow.
- **Reference image** (optional) — if wired, image-to-pano variants treat it as the central front view and extrapolate the surrounding 360°.

## What your workflow needs

- A `SaveImage` output node (auto-detected).
- An `EmptySD3LatentImage` (or equivalent) at the panorama LoRA's training resolution — 2048×1024 / 2:1 aspect is the standard.
- A generator: Flux / SDXL / SD1.5 base + a panorama-finetuned LoRA, OR a dedicated 360 model (e.g. Diffusion360 via a custom node).
- A `CLIPTextEncode` for the prompt.

To add your own workflow see [docs/custom-workflows.md](../../docs/custom-workflows.md); to configure per-node bindings, select the stage on the canvas and open the left **ComfyTV** sidebar — see [docs/sidebar-config-editor.md](../../docs/sidebar-config-editor.md).

## What's here today

- **Qwen-Image 2512 + 360 LoRA** (`qwen-image-2512-360.json` + `_preset.json`) — text-to-panorama using Qwen-Image 2512 fp8 + 4-step Lightning LoRA + 360 LoRA. Output ~2048×1024 equirectangular. No reference image required.
- **Qwen-Image-Edit 2511 Image-to-Panorama** (`qwen-edit-2511-img2pano.json` + `_preset.json`) — image-to-panorama. Shares Qwen-Image-Edit 2511 weights with Image Edit / Multiangle / Relight.

## Models referenced

See [docs/models.md](../../docs/models.md).
