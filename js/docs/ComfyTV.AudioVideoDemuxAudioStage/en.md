# Demux · Audio Track

> **Extract the audio stream** from a video container as `COMFYTV_AUDIO`. **PyAV** — pairs with **Demux · Silent Video**.

## What this node does

**Demux · Audio Track** reads audio from `COMFYTV_VIDEO` and writes a standalone audio file (`/view?` URL). For picture-only, use **Demux · Silent Video**.

Toolbar 🔀 **Demux** on upstream video stages creates **both** Audio Track + Silent Video nodes wired automatically.

## When to use it

- Pull BGM / dialogue for **Audio Stage** or IA2V
- Feed **Vocals Only** (Demucs — ⏳ pending)
- Replace audio: Silent Video + new audio (ffmpeg / future Timeline)

## How it works

- **Stage** + **▶ Run**; PyAV `demux_audio`, no GPU.
- **Snapshot**: audio URL persisted in project.
- Shares source video snapshot with Silent Video; separate Run outputs.

## Types

| ComfyTV type | What it is | vs ComfyUI |
|---|---|---|
| `COMFYTV_VIDEO` | Input video snapshot | Not `VIDEO` |
| `COMFYTV_AUDIO` | Output audio snapshot | Not `AUDIO` dict |

[bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## Parameters

### video
Source `COMFYTV_VIDEO`. Required.

## Outputs

| Output | Type | Downstream |
|---|---|---|
| **audio** | `COMFYTV_AUDIO` | **Video Stage** (IA2V), **Audio Stage**, **← ComfyTV Audio** |

## Step by step

1. Run upstream **Video Stage** or **Load Video**.
2. Add **Demux · Audio Track** or click 🔀 **Demux** on upstream toolbar.
3. **▶ Run**.
4. Wire **audio** to **Video Stage** **audio** (IA2V) or **Vocals Only** (pending).

## Full guides (recommended reading)

> This page covers **one node only**. For end-to-end workflows, multi-stage pipelines, type conversion, and design rationale, see the [ComfyTV user guides](https://github.com/jtydhr88/ComfyTV/tree/main/docs) on GitHub:

| Guide | Contents |
| --- | --- |
| [Getting started](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.md) | Install, canvas basics, per-stage Run, snapshots, Project, Image Picker |
| [Video and audio](https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.md) | Clip, crop, resize, extract frame, demux vs Generate video |

## Repository and workflows

| Resource | Link |
| --- | --- |
| **GitHub repository** | https://github.com/jtydhr88/ComfyTV |
| **User guides index** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **Built-in workflows** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **Model checklist** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |
## FAQ

**Q: No audio stream?**  
A: Source may be silent; PyAV may error or write empty output.

**Q: Where is Demux button?**  
A: 🔀 **Demux** on upstream video stage toolbar.

**Q: Native AUDIO?**  
A: Add **← ComfyTV Audio**.

## Related nodes

- **Demux · Silent Video**
- **Vocals Only** / **Background Only** (pending)
- **Video Stage** (IA2V)
