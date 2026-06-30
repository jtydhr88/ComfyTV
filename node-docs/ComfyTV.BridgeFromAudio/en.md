# ← ComfyTV Audio

> **Out-bridge**: **COMFYTV_AUDIO** wav URL → native **AUDIO** dict. **No ▶ Run** — torchaudio load on Queue.

## What this node does

ComfyTV **Demux · Audio Track**, **Audio Stage**, etc. output **`COMFYTV_AUDIO`**. Native audio nodes need **`AUDIO`** `{waveform, sample_rate}`. **← ComfyTV Audio** loads wav from `/view?` URL.

Pairs with **→ ComfyTV Audio**: ComfyTV stems → native ecosystem.

## When to use it

- ComfyTV Demux track → native audio FX
- **Audio Stage** music → native video mux tools
- Export ComfyTV audio for native analysis

## How it works

- Not a Stage; `torchaudio.load` → standard AUDIO dict.
- Same URL parsing as other out-bridges.

## Types

| ComfyTV | Native |
|---|---|
| `COMFYTV_AUDIO` | `AUDIO` |

[bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## Parameters

### audio
**COMFYTV_AUDIO** URL.

## Outputs

| Output | Type |
|---|---|
| **AUDIO** | ComfyUI AUDIO |

## Step by step

1. Run **Demux** or **Audio Stage** → **COMFYTV_AUDIO**.
2. Wire **← ComfyTV Audio**.
3. Native AUDIO node, Queue.

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

**Q: Bridge after Demux?**  
A: Only when **leaving ComfyTV for native**. IA2V inside ComfyTV wires **Video Stage audio** directly.

**Q: Sample rate?**  
A: Preserved from wav file.

## Related nodes

- **→ ComfyTV Audio**
- **Demux · Audio Track** / **Audio Stage**
