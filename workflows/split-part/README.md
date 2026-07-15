# split-part workflows

Segmentation workflows for the **Split Parts** stage: take one upstream image plus
part prompts, return **one transparent-background PNG per part** (`COMFYTV_IMAGES`,
via `ui_save_batch`).

Model: `sam3.1_multiplex_fp16.safetensors` →
`https://huggingface.co/Comfy-Org/sam3.1` → place in `ComfyUI/models/checkpoints/`.
SAM3 nodes are ComfyUI core (`comfy_extras/nodes_sam3.py`), so no custom node packs
are needed.

| Workflow | Prompting | Notes |
|---|---|---|
| `sam3-prompt` | points + boxes drawn on the card | stage runs once per point-group and once for all boxes |
| `sam3-text` | stage main prompt (open vocabulary) | one image per detected instance of the concept |

Contract for custom workflows linked to this stage:
- the stage supplies `option:points_pos` / `option:points_neg` (JSON strings of
  `[{"x":int,"y":int},…]`, source-image pixel coords) and `option:bboxes`
  (list of `{x,y,width,height}` dicts) — bind whichever your graph consumes;
- output must end in a SaveImage over an image batch (one image per part);
- `JoinImageWithAlpha` writes `alpha = 1 - mask`, so put an `InvertMask` in front
  of it when compositing SAM masks to transparency.
