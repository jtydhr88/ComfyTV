# ← ComfyTV Text

> **Out-bridge**: **COMFYTV_TEXT** snapshot → native **STRING**. **No ▶ Run** — passes string on Queue.

## What this node does

ComfyTV **Text Stage** or **→ ComfyTV Text** produces **`COMFYTV_TEXT`**. Native nodes (CLIP Text Encode, Show Text, LLM chains) expect **`STRING`**. **← ComfyTV Text** returns the string as-is — no disk IO.

ComfyTV-generated copy → other native ComfyUI branches.

## When to use it

- **Text Stage** narrative → native CLIP compare
- ComfyTV prompt chain → third-party STRING tools
- Debug with Show Text

## How it works

- Normal node; `execute` → `str(text)`.
- No Run; runs on Queue.

## Types

| ComfyTV | Native |
|---|---|
| `COMFYTV_TEXT` | `STRING` |

[bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## Parameters

### text
Upstream **COMFYTV_TEXT**.

## Outputs

| Output | Type |
|---|---|
| **STRING** | ComfyUI STRING |

## Step by step

1. Run **Text Stage** or **→ ComfyTV Text**.
2. Wire **← ComfyTV Text**.
3. STRING → CLIP Text Encode, etc.
4. Queue graph.

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

**Q: Empty string?**  
A: Upstream ComfyTV text not Run or empty.

**Q: vs → ComfyTV Text?**  
A: → into ComfyTV (Run); ← out of ComfyTV (no Run).

## Related nodes

- **→ ComfyTV Text**
- **Text Stage**
