> Flip horizontally and/or vertically—instant browser preview, no Run.

## What this node does

**Mirror** mirrors the upstream image: **horizontal (⇋)** and/or **vertical (⇅)**. Toggles map to hidden `flip_horizontal` / `flip_vertical`; preview updates immediately.

**Instant** node—no GPU. Fix selfie mirroring, test symmetry, or chain with **Rotate** / **Crop**.

## When to use it

- Flip faces or products left↔right
- Check pattern symmetry
- From Image Picker mirror tool
- Before **Crop** or **Upscale**

## How it works

Like Crop/Rotate: **Stage without Run**. Output stays `COMFYTV_IMAGE`.

- Both flips on ≈ 180° rotation visually (different from **Rotate**—don’t stack unless intended).
- Downstream generative stages need re-Run after changes.

## Types

| Type | Meaning |
|---|---|
| `COMFYTV_IMAGE` | URL snapshot, not `IMAGE` tensor |

[bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## UI and parameters

### image (input)

Upstream `COMFYTV_IMAGE`.

### flip_horizontal (⇋)

Left↔right mirror. Default false.

### flip_vertical (⇅)

Top↔bottom mirror. Default false.

## Outputs

| Output | Type |
|---|---|
| **image** | `COMFYTV_IMAGE` |

## Step by step

1. Add **Mirror** (menu or Image Picker).
2. Wire **image** in.
3. Toggle horizontal and/or vertical; check preview.
4. Wire out to **Crop**, **Color Grade**, or generative stages.
5. **▶ Run** downstream if needed.
6. Re-Run downstream after toggling.

## Workflows

None—instant only.

| Resource | Link |
|---|---|
| Image tools | https://github.com/jtydhr88/ComfyTV/blob/main/docs/image-tools.md |


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

**Q: Downstream unchanged?**  
A: Re-Run downstream; confirm you wired Mirror **output**, not a bypass.

**Q: Same as Rotate 180°?**  
A: Both flips look similar; pick one approach.

**Q: Quality loss?**  
A: Flip is lossless; upscale later if needed.

## Related nodes

- **Rotate**, **Crop**, **Color Grade**, **Image Picker**
