**English** | [简体中文](README.zh.md)

# Workflows

This folder is the public-facing extension point for ComfyTV. **Adding a new model option = dropping JSON files into the right subfolder. No Python edits.** Restart ComfyUI to pick up new files.

## Layout

```
workflows/
  <kind>/                              ← one folder per stage kind
    <name>.json                        ← GUI-format ComfyUI workflow export
    <name>_preset.json                 ← OPTIONAL — shipped default bindings
```

The folder name **is** the runner kind — each stage scans only its own folder for the workflow dropdown.

| Folder | Stage(s) | Tested baseline | Per-kind doc |
|---|---|---|---|
| `audio/`       | Audio Stage              | ACE-Step v1 Song | [README](audio/README.md) |
| `image/`       | Image Stage              | Local SD1.5 (t2i + i2i), Image Ideogram4 T2I | [README](image/README.md) |
| `image-edit/`  | Image Edit               | Flux Canny Edit | [README](image-edit/README.md) |
| `inpaint/`     | Inpaint                  | Flux Fill Inpaint (subgraph); Fooocus SDXL Inpaint *(opt-in plugin)* | [README](inpaint/README.md) |
| `outpaint/`    | Outpaint                 | Flux Fill Outpaint; Fooocus SDXL Outpaint *(opt-in plugin)* | [README](outpaint/README.md) |
| `upscale/`     | Upscale                  | Ultrasharp 4x (GAN) | [README](upscale/README.md) |
| `cutout/`      | Cutout                   | BiRefNet (subgraph) | [README](cutout/README.md) |
| `erase/`       | Erase                    | LaMa Erase (Acly inpaint-nodes plugin + big-lama.pt) | [README](erase/README.md) |
| `relight/`     | Relight                  | Qwen Edit 2509 Relight + (with reference) variant | [README](relight/README.md) |
| `multiangle/`  | Multiangle               | Qwen Edit 2511 Multiangle (fal Multiple-Angles LoRA) | [README](multiangle/README.md) |
| `multiview/`   | Image Variations (parallel) | Face 3-View, Product 3-View, Character 3-View, Multi-cam 9 | [README](multiview/README.md) |
| `sequence/`    | Image Variations (chained) | Story 4, Storyboard 25 (Next-Scene LoRA) | [README](sequence/README.md) |
| `panorama/`    | Panorama                 | Qwen-Image 2512 + 360 LoRA, Qwen-Image-Edit 2511 Image-to-Panorama | [README](panorama/README.md) |
| `text/`        | Text Stage               | Local Qwen3 4B | [README](text/README.md) |
| `video/`       | Video Stage              | LTX 2.3 T2V / I2V / FLF2V / IA2V | [README](video/README.md) |
| `storyboard/`  | Storyboard               | Local Qwen3 Storyboard | [README](storyboard/README.md) |
| `shot-images/` | Shot Images              | Flux Schnell, Local Z-Image Turbo | [README](shot-images/README.md) |
| `audio-vocal/` `audio-bg/` `timeline/` | various | *not shipped yet* | — |

## Adding a workflow in 30 seconds

1. In ComfyUI's web UI, open the workflow you want and choose **Workflow → Save** (GUI format — **not** "Save (API Format)").
2. Save the exported JSON as `workflows/<kind>/<name>.json`.
3. **Restart ComfyUI.** The workflow now appears in the matching stage's dropdown, labelled by a humanized filename.

If the workflow has a `SaveImage` / `SaveVideo` / `PreviewImage` node, ComfyTV auto-detects it and runs with the values baked in at export. That's enough for testing the wiring — for plugging user input (prompts, upstream images, seeds), see below.

## Plugging in user input

Two ways to bind stage inputs (prompts, upstream images, seeds, model files) to nodes in your workflow:

1. **Edit in the sidebar** — select the stage on the canvas, open the left **ComfyTV** sidebar, and configure bindings per widget. Changes apply immediately, no restart.
2. **Export `<name>_preset.json`** — once the bindings are how you like them, click "Export preset.json" at the bottom of the sidebar and drop the file next to the workflow JSON. Others get your defaults on first load.

See:
- [`docs/custom-workflows.md`](../docs/custom-workflows.md) — adding your own workflow end-to-end
- [`docs/sidebar-config-editor.md`](../docs/sidebar-config-editor.md) — the sidebar UI walkthrough

Then read your kind's `README.md` for the run-time contract (what the stage provides, what nodes the workflow typically needs).
