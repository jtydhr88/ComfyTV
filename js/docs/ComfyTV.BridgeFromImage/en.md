# ← ComfyTV Image

> **Out-bridge**: **COMFYTV_IMAGE** URL snapshot → native **IMAGE** tensor. **No ▶ Run** — loads PNG from disk when the ComfyUI graph executes.

## What this node does

ComfyTV stages output **`COMFYTV_IMAGE`** URL strings. Native nodes — **IPAdapter**, ControlNet, Save Image, VAE Encode — need **`IMAGE`** tensors. **← ComfyTV Image** parses `/view?` on graph execute, loads PNG from `output/` / `input/` / `temp`, returns `[1,H,W,C]` float tensor.

Opposite of **→ ComfyTV Image**: ComfyTV → native plugin ecosystem.

```
[Upscale Stage] ──COMFYTV_IMAGE──→ [← ComfyTV Image] ──IMAGE──→ [IPAdapter / Save Image / …]
                                        (no Run — loads on Queue)
```

## When to use it

- ComfyTV edit result → IPAdapter restyle
- ComfyTV output → native upscale / face restore
- End pipeline with **Save Image**

## How it works

- **Not a Stage** — no Run, no snapshot write. Normal node on **Queue**.
- `_load_image_tensor`: RGB; alpha available via **← ComfyTV Mask**.
- URL must be ComfyTV `/view?filename=…&subfolder=…&type=…`.

## Types

| ComfyTV | Native |
|---|---|
| `COMFYTV_IMAGE` URL | `IMAGE` tensor |

Into ComfyTV: **→ ComfyTV Image** (Run required). [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## Parameters

### image
Upstream **COMFYTV_IMAGE**. Empty → error.

## Outputs

| Output | Type | Downstream |
|---|---|---|
| **IMAGE** | ComfyUI IMAGE | Any native IMAGE input |

## Step by step

1. ComfyTV chain produces **COMFYTV_IMAGE** (e.g. **Upscale** after Run).
2. Add **← ComfyTV Image**, wire.
3. Connect to IPAdapter / Save Image.
4. **Queue** full graph (not ComfyTV stage Run).

## Full guides (recommended reading)

> This page covers **one node only**. For end-to-end workflows, multi-stage pipelines, type conversion, and design rationale, see the [ComfyTV user guides](https://github.com/jtydhr88/ComfyTV/tree/main/docs) on GitHub:

| Guide | Contents |
| --- | --- |
| [Getting started](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.md) | Install, canvas basics, per-stage Run, snapshots, Project, Image Picker |
| [Bridge nodes](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md) | COMFYTV_* vs native types, into/out bridges, plugin examples |
| [Custom workflows](https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md) | Import your ComfyUI workflow JSON without Python changes |

## Repository and workflows

| Resource | Link |
| --- | --- |
| **GitHub repository** | https://github.com/jtydhr88/ComfyTV |
| **User guides index** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **Built-in workflows** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **Model checklist** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md |
| **Bridge source code** | https://github.com/jtydhr88/ComfyTV/blob/main/nodes/bridges.py |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |

## FAQ

**Q: Out-bridge Run?**  
A: **No**. Into-bridges (→) Run; out-bridges (←) load on Queue.

**Q: Upstream ComfyTV not Run yet?**  
A: No valid URL — Run upstream stage or into-bridge first.

**Q: PNG with alpha?**  
A: RGB → IMAGE; inverted alpha as mask → **← ComfyTV Mask**.

## Related nodes

- **→ ComfyTV Image**
- **← ComfyTV Mask**
- **Upscale** / **Cutout**
