> Rotate an image instantly in the browser—live slider preview, no ▶ Run.

## What this node does

**Rotate** spins the upstream image around its center (−180° to +180°, positive = clockwise). The preview updates live, including any empty corners after rotation.

This is an **instant** node: browser Canvas only—no queue, no models. Use it to straighten horizons, try orientations, then optionally **Crop**.

Input/output: `COMFYTV_IMAGE`. From native `IMAGE`, use **Bridge → ComfyTV Image** first.

## When to use it

- Fix slightly tilted photos or scans
- Quick 90° / 180° checks before **Crop**
- Inserted from Image Picker’s rotate tool
- Before **Mirror** or **Color Grade**

## How it works

Rotate is a **transform** stage with **no Run**. The slider writes hidden `angle`; output URL updates immediately.

- Downstream generative stages use **snapshots**—re-Run them after angle changes.
- No `workflows/` backend.

## Types

| ComfyTV type | Meaning | vs ComfyUI |
|---|---|---|
| `COMFYTV_IMAGE` | URL snapshot | Not `IMAGE` tensor |

Conversion: `→ ComfyTV Image` / `← ComfyTV Image` — [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## UI and parameters

### image (input)

Upstream `COMFYTV_IMAGE`.

### angle slider (−180 … +180)

- Drag for continuous rotation; **positive = clockwise**.
- Shortcuts: ⟲ −90°, 0°, 180°, ⟳ +90°.
- Hidden field `angle`, default 0.

### Preview

Live result. Large angles expand the canvas—**Crop** to tighten.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **image** | `COMFYTV_IMAGE` | Rotated snapshot |

## Step by step

1. Add **Rotate** (menu or Image Picker).
2. Wire upstream **image** in.
3. Adjust **angle** or use 90° buttons.
4. Optionally **Crop** empty corners.
5. **▶ Run** downstream generative stages if any.
6. Re-Run downstream after tweaks.

## Workflows and links

Instant only—no workflow.

| Resource | Link |
|---|---|
| Image tools | https://github.com/jtydhr88/ComfyTV/blob/main/docs/image-tools.md |
| Repo | https://github.com/jtydhr88/ComfyTV |


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

**Q: Canvas got bigger?**  
A: Rotation expands the bounding box—**Crop** afterward.

**Q: No Run button?**  
A: Expected for instant nodes.

**Q: Native IMAGE?**  
A: Bridge with `→ ComfyTV Image` first.

**Q: vs Multiangle?**  
A: Rotate = bitmap geometry; **Multiangle** = AI re-render from a new camera (Run + workflow).

## Related nodes

- **Crop**, **Mirror**, **Color Grade**, **Multiangle**
