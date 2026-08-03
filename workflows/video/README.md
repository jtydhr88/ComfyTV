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
- **Local MiniMax H3 T2V / FLF2V / R2V** (`local-minimax-h3-{t2v,flf2v,r2v}.json` + `_preset.json`) — MiniMax H3 joint video+**audio** generation. T2V is prompt-only; FLF2V takes one image (i2v) or two (first/last frame); R2V takes up to 9 reference images and 2 reference videos (soundtracks ride along) — mention them in the prompt as `@image_N` / `@video_N` / `@audio_N`, which expand to the literal `<Picture n>` / `<Video n>` / `<Audio n>` tags the model was trained on. Unused reference branches are pruned at run time. Model files (all under `Comfy-Org/MiniMax-H3` on Hugging Face): `minimax_h3_fl2va_pruned_int8_convrot.safetensors` (T2V/FLF2V) + `minimax_h3_ref2va_pruned_int8_convrot.safetensors` (R2V) in `diffusion_models/`, `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors` in `clip/`, `minimax_h3_video_vae_fp16.safetensors` + `minimax_h3_audio_vae_fp32.safetensors` in `vae/`.

## Models referenced

See [docs/models.md](../../docs/models.md).
