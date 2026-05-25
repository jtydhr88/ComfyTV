**English** | [简体中文](README.zh.md)

# `erase/` workflows

Workflows in this folder appear in the **Erase** dropdown. The user paints over an object they want **removed**, clicks Run, and the object disappears — the painted region is filled from surrounding context with no prompt input. Distinct from **Inpaint**, where the user *describes what should appear* in the masked region.

The shipped workflow uses LaMa via Acly's `comfyui-inpaint-nodes` plugin.

## Stage inputs

- **Source image** (required) — from upstream.
- **Mask** (required) — painted by the user with the painter widget.
- No prompt.

## What your workflow needs

- A `SaveImage` output node (auto-detected).
- A `LoadImage` for the source image.
- A `LoadImageMask` for the mask (`channel = "alpha"`).
- LaMa (or equivalent) inference: `INPAINT_LoadInpaintModel` + `INPAINT_InpaintWithModel` from the Acly plugin.

To add your own workflow see [docs/custom-workflows.md](../../docs/custom-workflows.md); to configure per-node bindings, select the stage on the canvas and open the left **ComfyTV** sidebar — see [docs/sidebar-config-editor.md](../../docs/sidebar-config-editor.md).

## What's here today

- **LaMa Erase** (`lama-erase.json` + `_preset.json`) — 5-node workflow: `LoadImage` + `LoadImageMask` → `INPAINT_LoadInpaintModel` + `INPAINT_InpaintWithModel` → `SaveImage`.

## Required plugin + model

**Plugin:** [Acly/comfyui-inpaint-nodes](https://github.com/Acly/comfyui-inpaint-nodes)

```bash
cd I:/ComfyUI/custom_nodes
git clone https://github.com/Acly/comfyui-inpaint-nodes.git
pip install opencv-python   # if not already installed
```

**Model:** [big-lama.pt (196 MB)](https://github.com/Sanster/models/releases/download/add_big_lama/big-lama.pt) → `models/inpaint/`

```bash
cd I:/ComfyUI/models/inpaint
curl -L -O https://github.com/Sanster/models/releases/download/add_big_lama/big-lama.pt
```

Restart ComfyUI after both are in place.
