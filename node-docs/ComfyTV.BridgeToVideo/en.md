# → ComfyTV Video

> **Into-bridge**: ComfyUI **VIDEO** object (e.g. **mesh2motion**) → **COMFYTV_VIDEO** URL. **▶ Run** writes `output/ComfyTV/bridge/*.mp4`.

## What this node does

**mesh2motion**, AnimateDiff export, **Create Video**, etc. output **`VIDEO`** — ComfyTV **Video Clip**, **Demux**, **Video Stage** expect **`COMFYTV_VIDEO`** URL strings. **→ ComfyTV Video** saves the object to mp4 on Run (auto codec) and registers a snapshot.

```
[mesh2motion] ──VIDEO──→ [→ ComfyTV Video] ──COMFYTV_VIDEO──→ [Video Clip / Demux / …]
                              ▲ Run
```

IMAGE frame sequence without VIDEO: **Create Video (fps)** first, then this bridge.

## When to use it

- 3D / motion plugin clips into ComfyTV edit chain
- AnimateDiff into ComfyTV **↪ Extend**
- Native VIDEO into ComfyTV IA2V pipeline

## How it works

- **Stage** + **▶ Run**; `_save_video_to_disk`, prefix `ComfyTV/bridge`.
- Container/codec auto.
- Snapshot persists; downstream does not re-encode until you re-run bridge.

## Types

| Native `VIDEO` | ComfyTV `COMFYTV_VIDEO` |
|---|---|
| ComfyUI video object | Persistent mp4 `/view?` URL |

[bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## Parameters

### video
Upstream **VIDEO**. Unwired → error on Run.

## Outputs

| Output | Type | Downstream |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | Clip, Crop, Demux, Extract Frame |

## Step by step

1. Run mesh2motion (or Create Video) to VIDEO.
2. Add **→ ComfyTV Video**, wire.
3. **▶ Run** bridge.
4. Wire **Video Clip** or toolbar **Demux**.

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

**Q: Queue vs Run?**  
A: **Run** = ComfyTV stage / into-bridge snapshot (required for this node); **Queue** = execute full ComfyUI graph. Into-bridges cannot substitute Run with Queue.

**Q: mesh2motion outputs IMAGE?**  
A: **Create Video (fps)** → **→ ComfyTV Video**.

**Q: Skip Run?**  
A: No snapshot without Run.

**Q: mp4 path?**  
A: `output/ComfyTV/bridge/ComfyTV_bridge_xxxxx_.mp4`.

## Related nodes

- **→ ComfyTV Image(s)**
- **Video Clip** / **Demux**
- **← ComfyTV Video**
