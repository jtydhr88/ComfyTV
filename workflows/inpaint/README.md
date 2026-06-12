**English** | [简体中文](README.zh.md)

# `inpaint/` workflows

Workflows in this folder appear in the **Inpaint** dropdown. The user paints a mask on the source image; the workflow regenerates the masked region per the prompt.

## Stage inputs

- **Source image** (required) — from upstream.
- **Mask** (required) — painted by the user with the painter widget.
- **Prompt** — what the masked region should become.
- **Random seed**.

## What your workflow needs

- A `SaveImage` output node (auto-detected).
- A `LoadImage` for the source image, plus the mask via **either** of:
  - a separate `LoadImageMask` node (`channel = "alpha"`) — bind it to **Stage mask (painter output)**; or
  - the `LoadImage`'s own **MASK output** (the common pattern when masks are drawn in ComfyUI's mask editor) — bind the `LoadImage`'s `image` input to **Upstream image + painted mask (alpha)**. At run time ComfyTV bakes the painted mask into the image's alpha channel, so the single `LoadImage` outputs both.
- A `CLIPTextEncode` for the prompt.
- The model's inpaint conditioning (Flux Fill uses `InpaintModelConditioning`, SD1.5 uses `VAEEncodeForInpaint`).
- A `KSampler` with `denoise=1.0` to fully regenerate the masked region.

To add your own workflow see [docs/custom-workflows.md](../../docs/custom-workflows.md); to configure per-node bindings, select the stage on the canvas and open the left **ComfyTV** sidebar — see [docs/sidebar-config-editor.md](../../docs/sidebar-config-editor.md).

## What's here today

- **Flux Fill Inpaint** (`flux-fill-inpaint.json` + `_preset.json`) — Flux Fill Dev fp8 inpaint, subgraph workflow. Tested working. **No third-party plugins required.**
- **Fooocus SDXL Inpaint** (`fooocus-sdxl-inpaint.json` + `_preset.json`) — Adapted from Acly's `comfyui-inpaint-nodes` plugin `inpaint-refine.json` template. SDXL base + Fooocus inpaint head/patch. **Requires the plugin installed + extra model files** — see "Optional: Fooocus variant" below.

## Models referenced

**Flux Fill Inpaint:**
- `flux1-fill-dev_fp8.safetensors` → `models/diffusion_models/`
- `clip_l.safetensors` + `t5xxl_fp16.safetensors` → `models/clip/`
- `ae.safetensors` → `models/vae/`

## Optional: Fooocus SDXL variant

The Fooocus variant uses Acly's [`comfyui-inpaint-nodes`](https://github.com/Acly/comfyui-inpaint-nodes) plugin for the inpaint head + patch nodes (same plugin used for LaMa Erase). Before selecting "Fooocus SDXL Inpaint" in the workflow combo:

1. **Install the plugin** (skip if already done for Erase):
   ```bash
   cd I:/ComfyUI/custom_nodes
   git clone https://github.com/Acly/comfyui-inpaint-nodes.git
   pip install opencv-python
   ```
2. **Download the Fooocus inpaint files** per the plugin's README ([Acly/comfyui-inpaint-nodes#installation](https://github.com/Acly/comfyui-inpaint-nodes#installation)). Files go into `I:/ComfyUI/models/inpaint/`:
   - `fooocus_inpaint_head.pth` (~3 MB)
   - `inpaint_v26.fooocus.patch` (~1.3 GB)
3. **Have an SDXL checkpoint** in `models/checkpoints/`. The preset defaults to `animagine-xl-3.1.safetensors`; to swap, change the CheckpointLoader's model name in the sidebar.
4. Restart ComfyUI so the plugin's nodes register.
