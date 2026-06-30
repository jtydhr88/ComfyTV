> Crop a region in the browser instantly—drag a rectangle, no ▶ Run, no GPU.

## What this node does

**Crop** cuts a rectangular region from an upstream image. You see a preview with a draggable crop box; moving or resizing it updates the result **immediately**.

This is an **instant** node: all processing happens in the browser. It does not queue ComfyUI or load models. Use it for reframing, aspect-ratio exports, or trimming edges before heavier edits.

Input and output are `COMFYTV_IMAGE` (a URL snapshot), not ComfyUI’s native `IMAGE` tensor. If your image comes from Save Image or another plugin, insert **Bridge → ComfyTV Image** first.

## When to use it

- Keep the subject and remove extra background after generation
- Export at fixed ratios (1:1, 16:9, 9:16) for covers or storyboards
- Auto-inserted from the **Image Picker** ✏️ Edit toolbar
- Chain into **Upscale**, **Outpaint**, or other generative stages afterward

## How it works (why ComfyTV is designed this way)

ComfyTV treats lightweight edits as **Stages**, but unlike **Upscale / Inpaint**, Crop has **no ▶ Run** button. The UI writes `crop_x / crop_y / crop_w / crop_h` and passes a cropped preview URL downstream.

- **Local to this node** — does not queue the whole ComfyUI graph.
- **Snapshots** — after a downstream generative stage Runs once, changing the crop box does not auto re-run downstream; click Run there again.
- **No workflow** — nothing under `workflows/`; pure front-end cropping.

## Types (COMFYTV_* vs native ComfyUI)

| ComfyTV type | What it is | vs ComfyUI |
|---|---|---|
| `COMFYTV_IMAGE` | Single-image URL snapshot | Not an in-memory `IMAGE` tensor |
| `COMFYTV_IMAGES` | Multi-image batch JSON | Not an `IMAGE` batch |

**Conversion:**

- Native → ComfyTV: `ComfyTV/Bridge` → `→ ComfyTV Image` (Run to snapshot)
- ComfyTV → native: `← ComfyTV Image` (snapshot back to tensor)

See [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## UI and parameters

### image (input)

Upstream `COMFYTV_IMAGE`. Typical sources: **Image Stage**, **Image Picker**, **Load Image**, **Bridge → ComfyTV Image**.

### Crop box (preview)

- Drag the **box** to move; drag **edges/corners** to resize.
- **Ratio** locks aspect (free, 1:1, 4:3, 16:9, …); 🔒 toggles lock.
- **X / Y / W / H** for exact pixels (hidden fields `crop_x`, `crop_y`, `crop_w`, `crop_h`).
- Result updates live—no Run.

### crop_x / crop_y / crop_w / crop_h (hidden)

Written by the UI. W or H = 0 means no valid crop yet.

## Outputs

| Output | Type | Meaning | Downstream |
|---|---|---|---|
| **image** | `COMFYTV_IMAGE` | Cropped snapshot | Any Image stage, Image Picker, Bridge ← ComfyTV Image |

## Step by step

1. Add **Crop** from **ComfyTV / Image**, or use Image Picker’s crop preset.
2. Wire upstream **image** → this node’s **image**.
3. Drag the crop box; optionally pick **Ratio**.
4. Wire **image** out to the next step (Upscale, Compare, …).
5. If downstream is generative, click **▶ Run** there—Crop itself needs no Run.
6. To refine framing, adjust the box and Run downstream again.

## Full guides (recommended reading)

> This page covers **one node only**. For end-to-end workflows, multi-stage pipelines, type conversion, and design rationale, see the [ComfyTV user guides](https://github.com/jtydhr88/ComfyTV/tree/main/docs) on GitHub:

| Guide | Contents |
| --- | --- |
| [Getting started](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.md) | Install, canvas basics, per-stage Run, snapshots, Project, Image Picker |
| [Image tools](https://github.com/jtydhr88/ComfyTV/blob/main/docs/image-tools.md) | Crop, inpaint, outpaint, upscale, multi-angle, variation presets |

## Repository and workflows

| Resource | Link |
| --- | --- |
| **GitHub repository** | https://github.com/jtydhr88/ComfyTV |
| **User guides index** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **Built-in workflows** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **Model checklist** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |
## FAQ

**Q: Why is there no ▶ Run?**  
A: Crop is instant; the box applies immediately. Only GPU/model stages have Run.

**Q: I changed the crop but Upscale looks the same.**  
A: Downstream still uses the last Run snapshot. Run Upscale again.

**Q: Can’t connect Save Image?**  
A: Type mismatch. Add `→ ComfyTV Image` Bridge, Run it, then Crop.

**Q: What resolution is the output?**  
A: Exactly the crop box W×H; no automatic upscale.

## Related nodes

- **Rotate**, **Mirror**, **Color Grade**, **Grid Split** — other instant tools
- **Image Picker** — pick + edit toolbar
- **Upscale / Outpaint** — common next steps
- **Bridge → ComfyTV Image** — from native IMAGE
