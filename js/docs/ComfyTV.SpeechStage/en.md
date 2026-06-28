# Speech Stage

> Synthesizes spoken narration and dialogue (TTS) from a script—not the same as Music Stage song/instrumental generation.

## What this node does

**Speech Stage** is ComfyTV’s **text-to-speech (TTS)** node. Put the full script in **main_prompt**, pick a TTS **workflow**, click **▶ Run**, and get a **`COMFYTV_AUDIO`** speech snapshot.

The stage is **model-agnostic**: the UI exposes parameters common to most TTS backends (text, voice, language, speed, optional reference audio). Engine-specific options live in sidebar **Custom Params** via preset JSON.

**Do not** use Speech Stage like Music Stage: there are no genre/BPM tags—**main_prompt is the script to read aloud**.

## When to use it

- Short-form narration, ad voice-over, character dialogue.
- Copy **dialogue** from Storyboard shots into Speech Stage.
- Audio for Video Stage **IA2V** (Speech **audio** → Video **audio**).
- Voice cloning with **reference_audio** + **reference_text** (F5-TTS, GPT-SoVITS, etc.).

## How ComfyTV stages work

- **▶ Run** executes only the subgraph in [`workflows/speech/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/speech).
- **Snapshots**: MP3/FLAC URL stored in the project for IA2V and Timeline.
- Native ComfyUI has **no TTS** (ACE-Step is music-only); Speech relies on custom nodes (e.g. Kokoro).

Division of labor: Music = melody, arrangement, optional sung lyrics; Speech = **accurate reading of given text**.

## Types (COMFYTV_AUDIO vs native ComfyUI)

| ComfyTV type | What it is | vs native ComfyUI |
| --- | --- | --- |
| `COMFYTV_AUDIO` | Speech clip project snapshot | Not an in-memory AUDIO tensor |
| Native AUDIO | Sample tensor | Needs Bridge for ComfyTV |

**Conversion:**

- Native → ComfyTV: **→ ComfyTV Audio**
- ComfyTV → native: **← ComfyTV Audio**

See [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## Speech Stage vs Music Stage (important)

| | **Speech Stage** (this node) | **Music Stage** |
| --- | --- | --- |
| Purpose | Read scripts, narration, dubbing | Songs, instrumentals, SFX |
| main_prompt | Full script to speak | Music style tags |
| voice / language | TTS voice and language | N/A (lyrics for singing) |
| Typical workflow | Kokoro TTS | ACE-Step v1 Song |
| Sound | Spoken voice, no full arrangement | Musical structure, possible vocals |

## Parameters

### workflow

TTS backend from [`workflows/speech/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/speech).

**Built-in: Kokoro TTS** (`kokoro-tts.json`)

- Kokoro-82M, ONNX on CPU, lightweight for end-to-end testing.
- Install custom node:

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/stavsap/comfyui-kokoro.git
pip install kokoro-onnx onnxruntime
```

Model (~300MB) downloads on first run. Details: [workflows/speech/README.md](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/speech/README.md).

### main_prompt (script)

The **full text to speak**—not music tags.

**Example:** `Welcome to today's show. Next, we visit a cyberpunk city of the future.`

### voice (preset speaker)

Named speaker id for preset-voice models (Kokoro, Bark, ElevenLabs). Kokoro uses preset defaults like `af_sarah`.

Leave empty when cloning from **reference_audio** (if the workflow supports it).

### language

Language for multilingual models. **Auto** = workflow/model default (Kokoro falls back to English).

Kokoro requires exact names: `English`, `Mandarin Chinese`, `Japanese`, `French`, etc.

**Mistake:** Expecting Chinese with **Auto** on Kokoro—pick **Mandarin Chinese** explicitly.

### speed

`1.0` = natural rate, range **0.5–2.0**.

### reference_text

Transcript of the reference clip; required for F5-TTS / GPT-SoVITS cloning. Auto-transcribing engines may leave it empty.

### reference_audio

Optional `COMFYTV_AUDIO` for **voice cloning**. Wire upstream audio or Load Audio from Asset; bind via `upstream_audio:value` in preset.

Kokoro **does not** support cloning—these fields are ignored for Kokoro.

### custom_params

Sidebar bindings for engine-specific params.

## Outputs

| Output | Type | Meaning | Downstream |
| --- | --- | --- | --- |
| **audio** | `COMFYTV_AUDIO` | Synthesized speech snapshot | Video IA2V **audio**; Timeline; Bridge |

## Step by step for beginners

1. Install Kokoro (above), add **Project** + **Speech Stage**.
2. **workflow** → **Kokoro TTS**.
3. **main_prompt**: a short narration (2–3 sentences).
4. **language** → `Mandarin Chinese` for Chinese (avoid Auto).
5. **voice** empty (preset default), **speed** `1.0`.
6. **▶ Run** and preview on the node.
7. For lip-sync video: **Video Stage** → **IA2V**, Speech **audio** → Video **audio**, portrait on **images**.

## Full guides (recommended reading)

> This page covers **one node only**. For end-to-end workflows, multi-stage pipelines, type conversion, and design rationale, see the [ComfyTV user guides](https://github.com/jtydhr88/ComfyTV/tree/main/docs) on GitHub:

| Guide | Contents |
| --- | --- |
| [Getting started](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.md) | Install, canvas basics, per-stage Run, snapshots, Project, Image Picker |
| [Generate](https://github.com/jtydhr88/ComfyTV/blob/main/docs/generate.md) | Text, Image, Video, Music, and Speech stages and workflow selection |
| [Model files](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md) | Checkpoints, LoRAs, and folder paths per workflow |
| [Custom workflows](https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md) | Import your ComfyUI workflow JSON without Python changes |

## Repository and workflows

| Resource | Link |
| --- | --- |
| **GitHub repository** | https://github.com/jtydhr88/ComfyTV |
| **User guides index** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **Built-in workflows** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **Model checklist** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md |
| **This node's workflow folder** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/speech |
| **Workflow README** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/speech/README.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |
## FAQ

**Q: Reads English but I wrote Chinese?**  
A: On Kokoro, set **language** to `Mandarin Chinese`, not Auto.

**Q: Speech or Music Stage?**  
A: Read script → Speech; BGM or song → Music Stage.

**Q: Kokoro not found?**  
A: Install `comfyui-kokoro` + `kokoro-onnx`, restart ComfyUI.

**Q: reference_audio has no effect?**  
A: Kokoro has no cloning—use F5-TTS etc. with proper preset bindings.

## Related nodes

- **Music Stage (Audio Stage)**—songs/instrumentals, not TTS.
- **Video Stage (IA2V)**—**audio** from Speech drives visuals.
- **Storyboard Stage**—copy shot **dialogue** to Speech main_prompt.
- **Load Audio from Asset**—pick existing voice tracks.
- **Bridge → / ← ComfyTV Audio**—native interop.
- **Project**—project context.
