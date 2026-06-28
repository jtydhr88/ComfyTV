# Panorama

> Interactive 360° panorama viewer: upload an HDRI / equirectangular image, or generate a full surround scene with an AI workflow, then look around from the center of the sphere.

## What this node does

Panorama is ComfyTV's **360° environment entry point**. Its output is not a flat photo but an **equirectangular** panorama — imagine a flat "world map" where the horizontal axis wraps 360° and the vertical axis runs from sky to ground. The node opens a 3D viewer: you sit at the center and drag to look in any direction.

Three ways to bring a panorama in, **highest priority first**:

1. **📤 Upload** — pick `.jpg` / `.png` / `.webp` / `.hdr` / `.exr`. The viewer loads instantly with a **manual** badge. Upload overrides everything else; clear it with ✕ before generating.
2. **Image-to-panorama** — workflow `Qwen-Image-Edit 2511 Image-to-Panorama`, wire a photo to **image**. The source becomes the front view; the model pushes out the full 360°.
3. **Text-to-panorama** — workflow `Qwen-Image 2512 + 360 LoRA`, fill **main_prompt** only, no reference image.

Panorama **only shows the 3D viewer** — no flat thumbnail. Use **Panorama · Current View** or **Multi-View** downstream for flat frames.

## When to use it

- HDRI / skybox references for 3D, games, or VR
- Expand a regular photo into a look-around scene
- Generate a 360° environment from text alone
- Shared environment base for storyboard or multi-view shots

## How ComfyTV designed this

- **Stage** = a step with **▶ Run**. Run executes **this node only** — it does **not** queue the entire ComfyUI graph.
- **Snapshot**: after Run, the panorama URL is stored in the project. Downstream Current View / Multi-View reads that snapshot; it does not re-run Panorama generation automatically.
- **workflow dropdown** = the ComfyUI sub-workflow JSON ([`workflows/panorama/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/panorama)). ComfyTV maps **main_prompt** and **image**; the stage auto-prefixes `equirectangular 360 degree panorama, `.
- **Upload mode** needs no Run — pick a file and it loads immediately. AI generation requires Run.

## Types (COMFYTV_* vs native ComfyUI)

| ComfyTV type | What it is | vs ComfyUI |
|---|---|---|
| `COMFYTV_PANORAMA` | Panorama `/view?` URL snapshot | Not an in-memory `IMAGE` tensor |
| `COMFYTV_IMAGE` | Single-image URL snapshot | Used for flat viewport captures |

**Conversion:** native `IMAGE` → ComfyTV via **→ ComfyTV Image**; snapshots back to tensor via **← ComfyTV Image**. See [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## Parameters

### workflow
Backends from [`workflows/panorama/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/panorama). **Qwen-Image 2512 + 360 LoRA** (text, ~2048×1024); **Qwen-Image-Edit 2511 Image-to-Panorama** (image input required). Click **▶ Run** after choosing; skip when uploading only.

### main_prompt
Scene description, e.g. "sunset over a mountain lake". Do not repeat 360° trigger words. For image-to-pano, add extension hints ("expand outward into grassland and distant mountains").

### image (optional)
Reference `COMFYTV_IMAGE` for image-to-pano. Wire **Image Stage** or **Image Picker**.

### manual_source (hidden)
Set by **📤 Upload**. When non-empty, skips workflow. Files land in ComfyUI `input/`. **✕ Clear upload** to generate instead.

### custom_params
JSON overrides for workflow sidebar params. See [sidebar-config-editor.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/sidebar-config-editor.md).

## Outputs

| Output | Type | Meaning | Downstream |
|---|---|---|---|
| **panorama** | `COMFYTV_PANORAMA` | 360° panorama URL | **Current View**, **Multi-View** |

## Step by step

1. Search **Panorama**, drop on canvas.
2. **Upload**: **📤 Upload panorama**, pick equirectangular / HDRI, drag in 3D.
3. **Text**: workflow `Qwen-Image 2512 + 360 LoRA`, write **main_prompt**, **▶ Run**.
4. **Image**: `Qwen-Image-Edit 2511 Image-to-Panorama`, wire **COMFYTV_IMAGE**, prompt, Run.
5. For flat frames: add **Current View** or **Multi-View**, connect **panorama**, operate viewer, Run.

## Full guides (recommended reading)

> This page covers **one node only**. For end-to-end workflows, multi-stage pipelines, type conversion, and design rationale, see the [ComfyTV user guides](https://github.com/jtydhr88/ComfyTV/tree/main/docs) on GitHub:

| Guide | Contents |
| --- | --- |
| [Getting started](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.md) | Install, canvas basics, per-stage Run, snapshots, Project, Image Picker |
| [Panorama 360°](https://github.com/jtydhr88/ComfyTV/blob/main/docs/panorama.md) | Upload/generate equirectangular, Current View, Multi-View |
| [Model files](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md) | Checkpoints, LoRAs, and folder paths per workflow |

## Repository and workflows

| Resource | Link |
| --- | --- |
| **GitHub repository** | https://github.com/jtydhr88/ComfyTV |
| **User guides index** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **Panorama guide** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/panorama.md |
| **Built-in workflows** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **Model checklist** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md |
| **This node's workflow folder** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/panorama |
| **Workflow README** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/panorama/README.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |

## FAQ

**Q: Uploaded file — Run does nothing new?**  
A: Upload wins. **✕ Clear upload**, pick workflow, Run.

**Q: What is equirectangular?**  
A: A projection that unwraps a 360° sphere onto a flat 2:1 rectangle. The viewer maps it on the inside of a sphere; you look outward from the center.

**Q: No flat output — how do I edit?**  
A: **Current View** first → `COMFYTV_IMAGE` → edit stage.

**Q: Workflow Run fails?**  
A: Check [models.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md) for Qwen-Image / 360 LoRA; or upload instead.

## Related nodes

- **Panorama · Current View** / **Multi-View** — flat captures
- **Image Stage** — reference for image-to-pano
- **→ ComfyTV Image** — plugin IMAGE into ComfyTV
