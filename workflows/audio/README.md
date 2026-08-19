**English** | [简体中文](README.zh.md)

# `audio/` workflows

Workflows in this folder appear in the **Audio Stage** dropdown. They take a text prompt (style / mood / instruments) + optional lyrics + duration, and produce a music clip or SFX.

## Stage inputs

- **Prompt** — typically style / mood / instrument keywords, e.g. `soft female vocals, kawaii pop, j-pop, piano, cheerful`.
- **Lyrics** (optional) — used by song-mode workflows; instrumental / SFX workflows can ignore.
- **Duration** — seconds slider.
- **Random seed**.

## What your workflow needs

- An audio save node (`SaveAudio` / `SaveAudioMP3` / `SaveAudioOpus` / `SaveAudioAdvanced`, auto-detected).
- A text-encode node for your model (ACE-Step uses `TextEncodeAceStepAudio.tags`).
- Song-mode workflows: a lyrics input (ACE-Step uses `TextEncodeAceStepAudio.lyrics`).
- A duration input (ACE-Step's is `EmptyAceStepLatentAudio.seconds`, in seconds).
- A `KSampler` driven by the stage's seed.

To add your own workflow see [docs/custom-workflows.md](../../docs/custom-workflows.md); to configure per-node bindings, select the stage on the canvas and open the left **ComfyTV** sidebar — see [docs/sidebar-config-editor.md](../../docs/sidebar-config-editor.md).

## What's here today

- **ACE-Step v1 Song** (`ace-step-v1-song.json`) — ACE-Step 3.5B text-to-audio with full song support (tags drive style, lyrics drive vocals, duration tied to the stage's duration widget). Tested working.
- **MiniMax Music 3** (`minimax-music3.json`) — adapted from ComfyUI's official `audio_minimax_music_3` template. Full songs up to ~5 minutes with stable structure; prompt → caption (style / mood / vocals / arrangement — the more structured, the better), lyrics with `[intro]`/`[verse]`/`[chorus]`/`[bridge]`/`[outro]` tags drive song structure, duration → max_duration (the model may end earlier). Official sampler defaults kept (30 steps, cfg 1.7, euler/simple).

## Models referenced

- `ace_step_v1_3.5b.safetensors` → `models/checkpoints/`. Provided by the ACE-Step v1 release.
- MiniMax Music 3 (all under `Comfy-Org/MiniMax-Music-3` on Hugging Face): `minimax_music3_dit_fp16.safetensors` (or `..._int8_convrot` for low VRAM) → `models/diffusion_models/`, `minimax_music3_text_encoder_pruned_int8_convrot.safetensors` → `models/text_encoders/`, `minimax_music3_dav.safetensors` → `models/vae/`.
