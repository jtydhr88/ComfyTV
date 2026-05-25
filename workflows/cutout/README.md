**English** | [简体中文](README.zh.md)

# `cutout/` workflows

Workflows in this folder appear in the **Cutout** dropdown. Wire an upstream image in and get the same image back with the subject segmented and the background replaced by a transparent alpha channel.

## Stage inputs

- **Source image** (required) — from upstream. No prompt, no tunable widgets.

## What your workflow needs

- A `SaveImage` output node (auto-detected).
- A `LoadImage` for the source image.
- A background-removal node (BiRefNet, BriaRMBG, etc.) that emits both `IMAGE` (subject) and `MASK`.
- A `JoinImageWithAlpha` (or equivalent) that combines the subject + mask into a transparent-bg PNG. Some segmenter chains do this internally.

To add your own workflow see [docs/custom-workflows.md](../../docs/custom-workflows.md); to configure per-node bindings, select the stage on the canvas and open the left **ComfyTV** sidebar — see [docs/sidebar-config-editor.md](../../docs/sidebar-config-editor.md).

## What's here today

- **BiRefNet Cutout** (`birefnet-cutout.json` + `_preset.json`) — Adapted from ComfyUI's `utility_birefnet_remove_background` template. Top-level: `LoadImage` → BiRefNet subgraph → `SaveImage`. The subgraph wraps `RemoveBackground` / `LoadBackgroundRemovalModel` / `InvertMask` / `JoinImageWithAlpha`.

## Models referenced

- `birefnet.safetensors` → `models/background_removal/`, ~900 MB. Download: <https://huggingface.co/Comfy-Org/BiRefNet/resolve/main/background_removal/birefnet.safetensors>
