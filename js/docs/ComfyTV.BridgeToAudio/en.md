# → ComfyTV Audio

> **Into-bridge**: ComfyUI **AUDIO** dict → **COMFYTV_AUDIO** wav URL. **▶ Run** writes `output/ComfyTV/bridge/*.wav`.

## What this node does

ComfyUI audio nodes output **`AUDIO`** `{waveform, sample_rate}`. ComfyTV **Video Stage (IA2V)** and **Audio Stage** expect **`COMFYTV_AUDIO`** URLs. **→ ComfyTV Audio** saves **WAV** via torchaudio on Run (universal, no codec deps).

Use for Stable Audio, ACE-Step native output, or any plugin AUDIO into ComfyTV.

## When to use it

- Native music gen → ComfyTV **Video Stage** IA2V
- External TTS / SFX → ComfyTV timeline (future)
- Processed AUDIO in ComfyUI → back into ComfyTV

## How it works

- **Stage** + **▶ Run**; `_save_audio_to_disk` → WAV.
- Normalizes 3D waveform `[1, channels, samples]`.
- Snapshot `/view?` for IA2V etc.

## Types

| Native `AUDIO` | ComfyTV `COMFYTV_AUDIO` |
|---|---|
| tensor + sample_rate | wav `/view?` URL |

[bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## Parameters

### audio
Upstream **AUDIO**. Required.

## Outputs

| Output | Type | Downstream |
|---|---|---|
| **audio** | `COMFYTV_AUDIO` | Video Stage **audio**, Audio Stage |

## Step by step

1. Native node → AUDIO.
2. **→ ComfyTV Audio**, wire, **▶ Run**.
3. Wire to **Video Stage** **audio** (IA2V).

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

**Q: Demux already COMFYTV_AUDIO?**  
A: No bridge needed — Demux is already ComfyTV. Bridge is for **native AUDIO**.

**Q: wav location?**  
A: `output/ComfyTV/bridge/*.wav`.

**Q: Sample rate changed?**  
A: Preserves source **sample_rate**.

## Related nodes

- **Video Stage** (IA2V)
- **Demux · Audio Track**
- **← ComfyTV Audio**
