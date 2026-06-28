# Audio · Vocals Only

> **Roadmap / pending** — Demucs vocal stem separation from video/mix. Workflow slot exists; backend not wired.

## Intended purpose

**Audio · Vocals Only** takes `COMFYTV_VIDEO` (or demuxed audio path), runs a **Demucs**-style workflow, outputs isolated **vocals** as `COMFYTV_AUDIO`. Lip-sync, vocal replace, karaoke prep, etc.

> ⚠️ **Current status**: **workflow** dropdown scans [`workflows/audio-vocal/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/audio-vocal) ([no shipped JSON yet](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/README.md)). Run fails without backend. Planned: `lum3on/ComfyUI_AudioTools` `AudioStemSeparate`. See [roadmap.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/roadmap.md).

## When to use it (once shipped)

- Extract vocals from MV for IA2V / TTS alignment
- Process vocal stem in **Audio Stage**
- Pair with **Background Only**

## Planned design

- **Stage** + **workflow** + **▶ Run** + snapshot.
- Input: `upstream videos: [video]`, no text prompt.
- Demucs stem → WAV → `COMFYTV_AUDIO` URL.

## Types

| Type | Notes |
|---|---|
| `COMFYTV_VIDEO` | Input with audio |
| `COMFYTV_AUDIO` | Vocal output |

## Parameters

### workflow
[`workflows/audio-vocal/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/audio-vocal) (reserved, not shipped).

### video
Source `COMFYTV_VIDEO`. Optional prior **Demux · Audio Track**.

## Outputs (when implemented)

| Output | Type |
|---|---|
| **audio** | `COMFYTV_AUDIO` |

## Step by step (today)

1. **Demucs separation not available** yet.
2. Need raw track: **Demux · Audio Track** (✅).
3. Advanced: drop custom workflow in `audio-vocal/` + sidebar config.

## Full guides (recommended reading)

> This page covers **one node only**. For end-to-end workflows, multi-stage pipelines, type conversion, and design rationale, see the [ComfyTV user guides](https://github.com/jtydhr88/ComfyTV/tree/main/docs) on GitHub:

| Guide | Contents |
| --- | --- |
| [Getting started](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.md) | Install, canvas basics, per-stage Run, snapshots, Project, Image Picker |
| [Video and audio](https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.md) | Clip, crop, resize, extract frame, demux vs Generate video |
| [Roadmap](https://github.com/jtydhr88/ComfyTV/blob/main/docs/roadmap.md) | Supported vs planned backends (video upscale, Demucs, etc.) |

## Repository and workflows

| Resource | Link |
| --- | --- |
| **GitHub repository** | https://github.com/jtydhr88/ComfyTV |
| **User guides index** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **Built-in workflows** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **Model checklist** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |
## FAQ

**Q: vs Demux?**  
A: Demux copies whole track; Vocals Only **AI-separates** vocals from accompaniment.

**Q: Empty workflow list?**  
A: Expected — nothing shipped yet.

**Q: Models when shipped?**  
A: Demucs + ComfyUI_AudioTools; watch [models.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md).

## Related nodes

- **Background Only** (pending)
- **Demux · Audio Track** (✅)
- **Video Stage** (IA2V)
