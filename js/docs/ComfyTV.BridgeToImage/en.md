# → ComfyTV Image

> **Into-bridge**: convert native ComfyUI **IMAGE** tensor (any plugin) to a **COMFYTV_IMAGE** URL snapshot. Click **▶ Run** to write `output/ComfyTV/bridge/` and persist in the project.

## What this node does

ComfyTV stages pass **URL snapshots** (`/view?filename=…` strings), not GPU tensors. Any node outputting **`IMAGE`** — **IPAdapter**, ControlNet preprocessors, **mesh2motion** frames, custom nodes — cannot wire directly to **Image Picker** or **Upscale**.

**→ ComfyTV Image** is the entry checkpoint: on Run, read upstream tensor, **save PNG**, emit a ComfyTV snapshot URL.

```
[IPAdapter, etc.] ──IMAGE tensor──→ [→ ComfyTV Image] ──COMFYTV_IMAGE URL──→ [Image Picker / Upscale / …]
                                         ▲ Run + snapshot
```

## When to use it

- mesh2motion / 3D plugin frames → ComfyTV edit pipeline
- IPAdapter styled still → ComfyTV **Video Stage** I2V
- ControlNet maps → ComfyTV **Inpaint**
- Any third-party IMAGE → ComfyTV assets + lineage

## How ComfyTV designed this

- ComfyTV **Stages** run individually via **▶ Run**; snapshots let downstream read URLs without re-running expensive upstream.
- **Into-bridges are Stages** with Run. Run = execute upstream (if needed) + **write PNG + register snapshot**.
- Files: `ComfyUI/output/ComfyTV/bridge/ComfyTV_bridge_xxxxx_.png` ([`bridges.py`](https://github.com/jtydhr88/ComfyTV/blob/main/nodes/bridges.py)).
- Downstream ComfyTV stages use the bridge snapshot until you **Re-run the into-bridge**.

## Types (COMFYTV_* vs native) — essential

| Side | Native ComfyUI | ComfyTV |
|---|---|---|
| Image | `IMAGE` torch batch `[B,H,W,C]` | `COMFYTV_IMAGE` — single `/view?` URL string |
| Multi | `IMAGE` batch B>1 | `COMFYTV_IMAGES` JSON — use **→ ComfyTV Images** |
| Video | `VIDEO` object | `COMFYTV_VIDEO` mp4 URL |
| Audio | `AUDIO` `{waveform, sample_rate}` | `COMFYTV_AUDIO` wav URL |
| Text | `STRING` | `COMFYTV_TEXT` text snapshot |

**Wiring rule:** native sockets **cannot** connect to ComfyTV sockets directly — use **→** into or **←** out bridges. Full guide: [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## Parameters

### image (input)
Upstream **IMAGE** tensor. Only **first batch item** (`image[:1]`). Multi-frame → **→ ComfyTV Images** or **Create Video**.

### force_run_token / project_id / parent_output_id (hidden)
Internal lineage — leave default.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **image** | `COMFYTV_IMAGE` | Persisted PNG `/view?` URL |

## Step by step

1. Run native plugin (e.g. IPAdapter) to IMAGE.
2. Add **→ ComfyTV Image**, wire **image**.
3. **▶ Run the bridge** (required for snapshot).
4. Wire output to **Image Picker** or **Upscale**.
5. After upstream changes, **Re-run bridge**.

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

**Q: Wired but downstream empty?**  
A: Into-bridge **must Run**. Out-bridges (←) have no Run; into-bridges (→) do.

**Q: IPAdapter multi-image batch?**  
A: **→ ComfyTV Images**; or bridge first frame only.

**Q: mesh2motion outputs VIDEO?**  
A: **→ ComfyTV Video**; IMAGE sequence → **Create Video (fps)** first.

**Q: File location?**  
A: `output/ComfyTV/bridge/*.png`.

## Related nodes

- **→ ComfyTV Images** / **Video** / **Text** / **Audio**
- **← ComfyTV Image**
- **Image Picker**
