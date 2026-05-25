**English** | [简体中文](README.zh.md)

# `outpaint/` workflows

Workflows in this folder appear in the **Outpaint** dropdown. The user drags handles to extend the canvas; the workflow paints the new region per the prompt while preserving the original image.

## Stage inputs

- **Source image** (required) — from upstream.
- **Prompt** — what should fill the extended area.
- **Per-side pad pixels** (`pad_left` / `top` / `right` / `bottom`) — set by the user's drag handles; 0 if a side isn't extended.
- **Feathering pixels** (default 40) — soft edge.
- **Random seed**.

## What your workflow needs

- A `SaveImage` output node (auto-detected).
- A `LoadImage` for the source image.
- An `ImagePadForOutpaint` driven by the stage's four pad values + feathering. It produces BOTH the padded image and an auto-generated mask covering the new area — no painter input needed.
- A `CLIPTextEncode` for the prompt.
- The model's inpaint conditioning (Flux Fill uses `InpaintModelConditioning`).
- A `KSampler` driven by the stage's seed.

To add your own workflow see [docs/custom-workflows.md](../../docs/custom-workflows.md); to configure per-node bindings, select the stage on the canvas and open the left **ComfyTV** sidebar — see [docs/sidebar-config-editor.md](../../docs/sidebar-config-editor.md).

## What's here today

- **Flux Fill Outpaint** (`flux-fill-outpaint.json` + `_preset.json`) — Flux Fill Dev fp8 outpaint via `ImagePadForOutpaint` + `InpaintModelConditioning`. Tested working. **No third-party plugins required.**
- **Fooocus SDXL Outpaint** (`fooocus-sdxl-outpaint.json` + `_preset.json`) — Adapted from Acly's `comfyui-inpaint-nodes` plugin `outpaint.json` template. SDXL base + Fooocus inpaint head/patch + `MaskedFill` / `MaskedBlur` pre-fill for the new pad area. **Requires the plugin installed + extra model files** — see "Optional: Fooocus variant" below.

## Models referenced

**Flux Fill Outpaint:**
- `flux1-fill-dev_fp8.safetensors` — same model as Flux Fill Inpaint
- `clip_l.safetensors` + `t5xxl_fp16.safetensors` → `models/clip/`
- `ae.safetensors` → `models/vae/`

## Optional: Fooocus SDXL variant

The Fooocus variant uses Acly's [`comfyui-inpaint-nodes`](https://github.com/Acly/comfyui-inpaint-nodes) plugin (same plugin as LaMa Erase / Fooocus Inpaint). Before selecting "Fooocus SDXL Outpaint":

1. **Install the plugin** (skip if already done for Erase / Inpaint):
   ```bash
   cd I:/ComfyUI/custom_nodes
   git clone https://github.com/Acly/comfyui-inpaint-nodes.git
   pip install opencv-python
   ```
2. **Download the Fooocus inpaint files** per the plugin's README ([Acly/comfyui-inpaint-nodes#installation](https://github.com/Acly/comfyui-inpaint-nodes#installation)) into `I:/ComfyUI/models/inpaint/`:
   - `fooocus_inpaint_head.pth` (~3 MB)
   - `inpaint_v26.fooocus.patch` (~1.3 GB)
3. **Have an SDXL checkpoint** in `models/checkpoints/`. The preset defaults to `animagine-xl-3.1.safetensors`; to swap, change the CheckpointLoader's model name in the sidebar.
4. Restart ComfyUI so the plugin's nodes register.
