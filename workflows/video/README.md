**English** | [简体中文](README.zh.md)

# `video/` workflows

Workflows in this folder appear in the **Video Stage** dropdown. Take 0..N text prompts, 0..N images, 0..N videos, plus an optional audio track; produce a video.

## Stage inputs

- **Prompt** — the stage's main input.
- **Upstream images**, **upstream videos**, **upstream text**, **upstream audio** (all optional) — consume as needed; e.g. i2v uses the first image, ia2v uses image + audio together.
- **Resolution** (`480P` / `720P` / `1080P`), **aspect ratio** (`16:9` / `9:16` / `1:1`, etc.).
- **Duration** (seconds).
- **Generate audio** (toggle), **random seed**, **negative prompt** (all optional).

## What your workflow needs

- A `SaveVideo` or `VHS_VideoCombine` output node.
- A `CLIPTextEncode` (or whatever encoder your model requires) for the prompt.
- A latent node sized by the stage's width / height / frame count (derived from the stage's resolution + aspect + duration).
- A `KSampler` (or model-specific sampler) driven by the stage's seed.
- i2v workflows: a `LoadImage` for the upstream image.

The frame-count formula uses tier maps + a per-model divisor (LTX divisor=8, Wan divisor=4).

To add your own workflow see [docs/custom-workflows.md](../../docs/custom-workflows.md); to configure per-node bindings, select the stage on the canvas and open the left **ComfyTV** sidebar — see [docs/sidebar-config-editor.md](../../docs/sidebar-config-editor.md).

## What's here today

- **Local LTX 2.3 T2V / I2V / FLF2V** (`local-ltx-2.3-{t2v,i2v,flf2v}.json` + `_preset.json`) — LTX-Video 2.3 22B text- / image- / first-last-frame-to-video (fp8 + Gemma 3 text encoder + 4-step Lightning LoRA + 2× spatial upscaler).
- **Local LTX 2.3 IA2V** (`local-ltx-2.3-ia2v.json` + `_preset.json`) — image + audio to video. Wire a source frame to `images.image0` AND an audio track to `audio`; the video's timing follows the audio. Shares the LTX 2.3 model files.

## Models referenced

See [docs/models.md](../../docs/models.md).
