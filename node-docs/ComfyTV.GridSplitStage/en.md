> Split one image into a grid batch instantly in the browser—no Run.

## What this node does

**Grid Split** cuts an upstream image into a rows×cols grid. Each cell becomes one entry in a batch. Preview grid lines update live.

**Instant** node. Outputs **images** (`COMFYTV_IMAGES` full batch) and **image** (`COMFYTV_IMAGE` selected cell).

## When to use it

- Split AI contact sheets (2×2, 3×3) into shots
- Per-cell **Upscale**
- Grid Split toolbar preset → **Image Picker** → edit one cell

## How it works

Browser pixel rects; hidden `rows`, `cols`, `border`, `outer_border`.

- **No Run**.
- `selected_index` (1-based) picks the **image** output.
- Unlike **Image Variations** (AI batch, Run + workflow).

## Types

| Type | Meaning |
|---|---|
| `COMFYTV_IMAGE` | Single snapshot |
| `COMFYTV_IMAGES` | Multi-image JSON batch |

[bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## UI and parameters

### image (input)

Single upstream `COMFYTV_IMAGE`.

### Presets / Rows / Cols

Presets 1×2, 2×2, 3×3, … or manual rows/cols (1–10).

### border

Pixels cut between cells (gutter). 0 = even split only.

### outer_border

Also trim a margin around the whole grid.

### selected_index

Which cell feeds **image** (1-based); click thumbnails to change.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **images** | `COMFYTV_IMAGES` | All cells |
| **image** | `COMFYTV_IMAGE` | Selected cell |

## Step by step

1. Add **Grid Split**; wire upstream image.
2. Pick preset or set rows/cols.
3. Tune **border** to remove grid lines if needed.
4. **images** → Image Picker, or **image** → single-cell edit.
5. **▶ Run** downstream generative stages.
6. Re-Run downstream after grid changes.

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
| [Compose](https://github.com/jtydhr88/ComfyTV/blob/main/docs/compose.md) | Image Picker, Compare, Storyboard→Shot Images, timeline |

## Repository and workflows

| Resource | Link |
| --- | --- |
| **GitHub repository** | https://github.com/jtydhr88/ComfyTV |
| **User guides index** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **Built-in workflows** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **Model checklist** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |
## FAQ

**Q: Empty cells?**  
A: Check upstream image; don’t make cells too small.

**Q: vs Image Variations 9-grid?**  
A: Grid Split = physical cut; Variations = AI-generated views (Run).

**Q: Native nodes?**  
A: Bridge `← ComfyTV Images` or use **image** only.

## Related nodes

- **Image Picker**, **Image Variations**, **Crop**, **Upscale**
