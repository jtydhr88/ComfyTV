# Audio · Background Only

> **Roadmap / pending** — Demucs accompaniment / instrumental stem. Pairs with **Vocals Only**; `audio-bg/` reserved.

## Intended purpose

**Audio · Background Only** extracts the **non-vocal stem** (instrumental, ambience) as `COMFYTV_AUDIO`. MV remix, keep BGM swap vocals, IA2V on rhythm only, etc.

> ⚠️ **Current status**: workflow slot only — [`workflows/audio-bg/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/audio-bg) has no shipped JSON; Demucs backend pending. See [roadmap.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/roadmap.md).

## When to use it (once shipped)

- Keep BGM, regenerate visuals (IA2V)
- Stylize instrumental in **Audio Stage**
- Branch with **Vocals Only** from same source

## Planned design

- **Stage** + **workflow** + **▶ Run**.
- `kind='audio-bg'`, upstream video, no prompt.
- Planned Demucs `AudioStemSeparate`.

## Types

| Type | Notes |
|---|---|
| `COMFYTV_VIDEO` | Input |
| `COMFYTV_AUDIO` | Instrumental output |

## Parameters

### workflow
[`workflows/audio-bg/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/audio-bg)

### video
Source `COMFYTV_VIDEO`.

## Outputs (when implemented)

| Output | Type |
|---|---|
| **audio** | `COMFYTV_AUDIO` |

## Step by step (today)

1. **Not available** — use **Demux · Audio Track** for full mix.
2. Watch roadmap Demucs item.

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

**Q: Run alongside Vocals Only?**  
A: Likely separate Runs on same source when shipped.

**Q: Quality?**  
A: Demucs model + mix complexity.

**Q: Remix today?**  
A: Demux full track only; AI stems pending.

## Related nodes

- **Vocals Only** (pending)
- **Demux · Audio Track** (✅)
- **Audio Stage**
