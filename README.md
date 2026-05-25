<!-- Language: **English** | [简体中文](README.zh.md) -->

**English** | [简体中文](README.zh.md)

# ComfyTV
ComfyTV — the canvas-based app that truly belongs to ComfyUI.

ComfyTV turns ComfyUI into a **TapNow / LibTV-style canvas app**. Every operation is its own node; results flow downstream automatically. Chain stages into a complete flow: generate → pick → edit → compose.

![ComfyTV canvas overview](docs/images/overview.png)

---

## Highlights

- **Per-node Run**: each stage runs on its own, not through ComfyUI's global queue. Downstream stages consume the **snapshot** of an upstream stage's last output, so re-running one node doesn't drag the whole chain with it.
- **Seamless integration with the existing ComfyUI ecosystem** — subgraphs, plugins, all of it.
- **Custom workflow import** — bring in workflows from your own environment.
- **Real local generation**: text-to-image, image-to-image, image editing, Inpaint / Outpaint / Upscale / Multiangle, text/image/audio-to-video, text, text-to-music, 360° panorama — all running against your own local models.
- **Shipped workflows out of the box**: a curated set under `workflows/<kind>/`.
- **Rich in-node editors**: multi-angle 3D camera, mask painter with annotation tools, crop / rotate / mirror, HDRI / equirectangular panorama viewer + viewport capture, A/B compare, grid split.
- **Project-centric**: stages belong to a project; outputs persist and restore on reload.
- **Workflow configuration**: customize bindings directly in the GUI.

---

## Install

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/jtydhr88/ComfyTV
```

Restart ComfyUI. ComfyTV nodes appear under the **`ComfyTV`** category in the Add-Node menu, grouped into sub-categories (Project / Input / Generate / Image / Panorama / Video / Audio / Compose / Bridge).

---

## User guides

Step-by-step usage docs live in [`docs/`](docs/):

| Guide | What it covers |
|-------|----------------|
| [getting-started.md](docs/getting-started.md) | Install, the canvas basics, your first generation, per-node Run, picking from a set |
| [generate.md](docs/generate.md) | Text / Image / Video / Audio generation, choosing a model, running |
| [image-tools.md](docs/image-tools.md) | Crop, Rotate, Mirror, Inpaint, Erase, Cutout, Upscale, Outpaint, Grid Split, Variations, Multiangle |
| [panorama.md](docs/panorama.md) | Loading/viewing a 360° panorama, capturing single + multi viewports |
| [video-and-audio.md](docs/video-and-audio.md) | Video editing (clip / crop / resize / extract-frame / demux) and audio (vocal/bg separation, demux) |
| [compose.md](docs/compose.md) | Image Picker, A/B Compare |
| [roadmap.md](docs/roadmap.md) | What works today vs **TODO** (backend workflows not yet built) |
| [models.md](docs/models.md) | Per-workflow model files + folder locations + download URLs for everything shipped under `workflows/` |
| [custom-workflows.md](docs/custom-workflows.md) | Adding your own ComfyUI workflow as a JSON file (no Python edits) |
| [sidebar-config-editor.md](docs/sidebar-config-editor.md) | The sidebar GUI for editing how a stage's inputs map to its workflow nodes |
| [bridges.md](docs/bridges.md) | Connecting third-party ComfyUI plugins (mesh2motion, IPAdapter, …) via Bridge nodes |

---

## Quick tour

1. Drop a **Generate → Image** node, type a prompt, pick `Local SD1.5` as the workflow, click **Run**. It produces a set of images and auto-spawns an **Image Picker**.
2. Pick a frame in the picker. Its `✏️ Edit` toolbar offers Inpaint / Crop / Rotate / Mirror / Grid Split / Upscale / Outpaint / Cutout.
3. Crop / Rotate / Mirror happen entirely in the browser — no Run needed.
4. Wire the picked image into a **Generate → Video** node (`Local LTX I2V`) and Run.
5. Use **Compose → Compare** to A/B the before/after.

---

## License

See [LICENSE](LICENSE).
