# ← ComfyTV Video

> **Out-bridge**: **COMFYTV_VIDEO** URL → native **VIDEO** object. **No ▶ Run** — loads mp4 on Queue.

## What this node does

ComfyTV edit chain outputs **`COMFYTV_VIDEO`** (`/view?` → mp4 on disk). Native nodes — VHS, Wan Video, Save Video — need ComfyUI **`VIDEO`**. **← ComfyTV Video** wraps the file with `VideoFromFile`.

Opposite of **→ ComfyTV Video** (mesh2motion into ComfyTV).

```
[Video Clip] ──COMFYTV_VIDEO──→ [← ComfyTV Video] ──VIDEO──→ [Save Video / native VHS…]
```

## When to use it

- ComfyTV clip/demux → native video tools
- ComfyTV gen + clip → external plugin
- Final **Save Video** export

## How it works

- Not a Stage, no Run.
- URL → annotated path → `VideoFromFile`.

## Types

| ComfyTV | Native |
|---|---|
| `COMFYTV_VIDEO` | `VIDEO` |

[bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## Parameters

### video
**COMFYTV_VIDEO** URL — Run upstream ComfyTV video stage first.

## Outputs

| Output | Type |
|---|---|
| **VIDEO** | ComfyUI VIDEO |

## Step by step

1. ComfyTV chain produces **COMFYTV_VIDEO**.
2. Wire **← ComfyTV Video**.
3. Connect Save Video or native VIDEO node.
4. **Queue** graph.

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

**Q: Pair with → ComfyTV Video?**  
A: Yes — → for plugin into ComfyTV; ← for ComfyTV out to plugins.

**Q: Invalid URL?**  
A: Run upstream stage; URL must be `/view?` format.

## Related nodes

- **→ ComfyTV Video**
- **Video Clip** / **Demux**
