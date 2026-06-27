**English** | [简体中文](README.zh.md)

# `speech/` workflows

Workflows in this folder appear in the **Speech Stage** dropdown — text-to-speech / voice generation. The stage is **model-agnostic**: it exposes only the knobs common to (nearly) every TTS backend (text, voice, language, speed, optional reference audio/text) and leaves model-specific parameters to the per-stage **Custom Params** panel.

> For music / song generation, see [`../music/`](../music/) and the **Music Stage**.

ComfyUI has **no native TTS** (its built-in audio is ACE-Step / Stable Audio, music only), so Speech runs through a custom node.

## Shipped workflow: Kokoro TTS

`kokoro-tts.json` shows up as **"Kokoro TTS"** in the dropdown. Kokoro-82M is a tiny, fast, multilingual TTS that runs on CPU via ONNX — chosen here as the lightest way to exercise the Speech Stage end to end.

Graph: `Kokoro Speaker → Kokoro Generator → SaveAudioMP3`.

### Install

```
cd ComfyUI/custom_nodes
git clone https://github.com/stavsap/comfyui-kokoro.git
pip install kokoro-onnx onnxruntime
```

No torch, no GPU. The model (~300 MB) auto-downloads to the node folder on first run.

### Stage → node bindings (`kokoro-tts_preset.json`)

| Stage input (`from`)   | Target node · input                |
|------------------------|------------------------------------|
| `main_prompt`          | `KokoroGenerator` · `text`         |
| `option:voice`         | `KokoroSpeaker` · `speaker_name` (default `af_sarah`) |
| `option:speed`         | `KokoroGenerator` · `speed`        |
| `option:language`      | `KokoroGenerator` · `lang` (default `English`) |

Kokoro has no voice cloning and no seed, so the stage's **reference audio**, **reference text** and **seed** are intentionally unbound here. Its `language` must be one of Kokoro's names (`English`, `English (British)`, `Mandarin Chinese`, `Japanese`, `French`, `Spanish`, `Brazilian Portuguese`, `Italian`, `Hindi`); the stage's `Auto` falls back to `English`.

## Using other / heavier engines

The stage is model-agnostic — bring your own workflow exported from ComfyUI with normal **Save** (not "Save (API Format)"), ending on a native `SaveAudio` / `SaveAudioMP3` / `SaveAudioOpus` node, and map the same stage inputs in the left **ComfyTV** sidebar or a `_preset.json`. Heavier options: [TTS-Audio-Suite](https://github.com/diodiogod/TTS-Audio-Suite) (16 engines under one node), [VibeVoice](https://github.com/Enemyx-net/VibeVoice-ComfyUI) (long-form, multi-speaker, cloning), [F5-TTS](https://github.com/niknah/ComfyUI-F5-TTS) (lightweight cloning). For voice cloning, wire a reference clip into the stage's `reference_audio` input → `upstream_audio:value`.
