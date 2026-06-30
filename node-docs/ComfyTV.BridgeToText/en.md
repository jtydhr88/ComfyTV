# → ComfyTV Text

> **Into-bridge**: any ComfyUI **STRING** (prompt enhance, caption, LLM) → **COMFYTV_TEXT** snapshot. **▶ Run** persists in project lineage (text stored as string, not PNG).

## What this node does

**Image Stage** / **Video Stage** **texts** inputs expect **`COMFYTV_TEXT`**, not native **STRING**. **→ ComfyTV Text** converts third-party string outputs into ComfyTV snapshot payloads.

```
[Prompt Enhance] ──STRING──→ [→ ComfyTV Text] ──COMFYTV_TEXT──→ [Image Stage texts]
                                   ▲ Run
```

Unlike image bridges, text is **not** written under `bridge/` — Run registers the string directly.

## When to use it

- Comfy-Org **Prompt Enhance** → ComfyTV generation
- External LLM story/caption → **Text Stage** / future **Storyboard**
- Chain multiple strings into ComfyTV context

## How it works

- **Stage** + **▶ Run**; `_stage_emit_auto` text snapshot.
- **force_input** allows wired STRING or inline multiline widget.
- Downstream reads snapshot until you re-run bridge.

## Types

| Native `STRING` | ComfyTV `COMFYTV_TEXT` |
|---|---|
| In-memory / widget string | Persisted text snapshot |

Out of ComfyTV: **← ComfyTV Text** → STRING. [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## Parameters

### text
Upstream STRING or inline multiline input.

## Outputs

| Output | Type | Downstream |
|---|---|---|
| **text** | `COMFYTV_TEXT` | Image/Video Stage **texts** |

## Step by step

1. LLM / Prompt Enhance → STRING.
2. **→ ComfyTV Text**, wire.
3. **▶ Run**.
4. Wire to **Image Stage** **texts** (chain multiple COMFYTV_TEXT).

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

**Q: Still need main_prompt?**  
A: **texts** append context; **main_prompt** on stage is primary. Either works.

**Q: Run without wired STRING?**  
A: Yes — use inline multiline widget.

**Q: vs Text Stage?**  
A: **Text Stage** runs LLM workflow; bridge **forwards** existing STRING.

## Related nodes

- **Image Stage** / **Video Stage**
- **← ComfyTV Text**
- **Text Stage**
