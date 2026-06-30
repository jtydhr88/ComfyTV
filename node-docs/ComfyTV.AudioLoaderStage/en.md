# Load Audio

> Pick or upload local audio from ComfyUI's `input/` folder as the **starting point** for ComfyTV audio pipelines—voiceover, mixing, and IA2V video inputs.

## What this node does

**Load Audio** is an instant **Input** stage. It reads audio files from ComfyUI's **`input/`** folder (or uploads written there), registers a project snapshot, and outputs `COMFYTV_AUDIO`.

Use it for existing BGM, voice WAV, demuxed tracks, etc.—**not** for AI generation. Selecting a file immediately sets output without invoking Speech or Music Stage workflows.

vs **Load Audio from Asset**: this node = raw disk files; asset loader = project library from runs and imports.

## When to use it

- Import external narration, music (FLAC/WAV/MP3).
- Feed reference audio into **Speech Stage** (voice cloning).
- Wire into **Video Stage → audio** for image+audio-to-video.
- Optional track on **Director Timeline**.

## How it works (why ComfyTV is designed this way)

- **Stage vs Run**: **No ▶ Run**—select or upload to output.
- **Snapshots**: Downstream Runs read the current file URL; they won't re-read this node automatically.
- **No workflow**: Not tied to `workflows/audio/` or `workflows/speech/` generators.

## Types (COMFYTV_* vs native ComfyUI)

| ComfyTV type | What it is | vs ComfyUI native |
|---|---|---|
| `COMFYTV_AUDIO` | Audio file URL snapshot | Not in-memory `AUDIO` tensor |
| `COMFYTV_VIDEO` | Video snapshot | Demux to audio, then load or asset-pick |
| `COMFYTV_TEXT` | Text snapshot | Speech output—not the same as file load |

**Conversion:**

- Native → ComfyTV: `→ ComfyTV Audio`
- ComfyTV → native: `← ComfyTV Audio`

Details: [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## UI and parameters

### audio

- **What**: Dropdown of audio in **`input/`** plus **upload**.
- **What to set**: Pick or upload (WAV, MP3, FLAC, etc.).
- **Effect**: Defines source audio for downstream; must be a format ComfyUI recognizes.
- **Common mistake**: Looking here for **Music/Speech Stage** outputs—use **Load Audio from Asset** or wire from the generator.

### project_id / parent_output_id (internal)

- Hidden; maintained by Project and wiring.

## Outputs

| Output | Type | Meaning | Typical downstream |
|---|---|---|---|
| **audio** | `COMFYTV_AUDIO` | Selected audio snapshot | Video Stage (audio), Director Timeline (audio), Speech Stage (reference_audio), audio extract stages |

## Step by step for beginners

1. **Add Node → ComfyTV → Input → Load Audio**.
2. Wire a **Project** node (recommended).
3. Put files in **`input/`** or upload here.
4. Select in dropdown—**no Run needed**.
5. Connect **audio** downstream, e.g. **Video Stage → audio**.
6. **▶ Run** the downstream generator.

## Full guides (recommended reading)

> This page covers **one node only**. For end-to-end workflows, multi-stage pipelines, type conversion, and design rationale, see the [ComfyTV user guides](https://github.com/jtydhr88/ComfyTV/tree/main/docs) on GitHub:

| Guide | Contents |
| --- | --- |
| [Getting started](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.md) | Install, canvas basics, per-stage Run, snapshots, Project, Image Picker |
| [Video and audio](https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.md) | Clip, crop, resize, extract frame, demux vs Generate video |
| [Generate](https://github.com/jtydhr88/ComfyTV/blob/main/docs/generate.md) | Text, Image, Video, Music, and Speech stages and workflow selection |

## Repository and workflows

| Resource | Link |
| --- | --- |
| **GitHub repository** | https://github.com/jtydhr88/ComfyTV |
| **User guides index** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **Built-in workflows** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **Model checklist** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |

## FAQ

**Q: Load vs generate (Speech/Music Stage)?**  
A: **Load Audio** = existing files, no GPU inference. **Speech/Music** = AI creation with workflow + Run. Loaders **import**; generators **create**.

**Q: Load Audio vs Load Audio from Asset?**  
A: This = **`input/` disk**. Asset = **project library** after generation/import.

**Q: Type mismatch?**  
A: Downstream must expect `COMFYTV_AUDIO`; native `AUDIO` needs **→ ComfyTV Audio** Bridge.

**Q: No Run button?**  
A: Normal—same as Load Image/Video.

## Related nodes

- **Load Audio from Asset** — library picker.
- **Speech Stage** / **Music Stage** — AI audio generation.
- **AudioVideoDemuxAudioStage** — extract audio from video.
- **Director Timeline** — arrange audio on a timeline.
- **→ ComfyTV Audio** (Bridge).
