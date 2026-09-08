**English** | [简体中文](README.zh.md)

# `custom/` workflows

Workflows in this folder appear in the **Custom Stage** dropdown. Nothing ships here — this kind exists for your own workflows.

## Stage inputs

None are fixed. Select the stage on the canvas, click **Expose I/O** on the card, and tick the workflow nodes you want exposed. Media loaders (`LoadImage`, `LoadVideo`, `LoadAudio`, `Load3D`) become sockets, `STRING` widgets become text sockets with an on-card editor, other widgets become on-card parameters.

## What your workflow needs

- At least one output node you can expose: `SaveImage` / `PreviewImage` (image or batch), `SaveVideo` / `VHS_VideoCombine` (video), `SaveAudio*` (audio), `SaveGLB` (3D model), or a text-preview node such as `PreviewAny` / `ShowText` (text).
- Normal GUI-format save (not "Save (API Format)").

The exposure is stored as ordinary bindings plus `meta.custom_io`, so it exports into `_preset.json` like any other workflow. See [docs/custom-workflows.md](../../docs/custom-workflows.md).
