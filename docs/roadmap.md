**English** | [简体中文](roadmap.zh.md)

# What works today — and the TODO list

ComfyTV is pre-release.

Legend: ✅ done · ⏳ pending.

---

## ✅ Done

| Feature | Notes |
|---------|-------|
| **Image · Local SD1.5** (text→image) | Real generation; outputs a set of images. |
| **Image · Local SD1.5 I2I** (image→image) | Needs a reference image wired in. |
| **Image · Image Ideogram4 T2I** | Ideogram 4 + Qwen3-VL text encoder text-to-image. |
| **Image Edit · Flux Canny Edit** | Prompt-driven image editing. |
| **Inpaint · Flux Fill Inpaint** + **Fooocus SDXL Inpaint** | Mask-driven regeneration (mask painter produces the mask). |
| **Erase · LaMa Erase** | Promptless object removal. Requires `Acly/comfyui-inpaint-nodes` + `big-lama.pt`. |
| **Relight · Flux2 Klein Relight** | A pure-frontend 3D light-ball node renders the lighting reference in the browser; the Image Stage workflow (Flux-2 Klein 9B + Sun-direction LoRA) transfers it onto the subject. |
| **Cutout · BiRefNet Cutout** | Background removal via ComfyUI core's BiRefNet. Outputs PNG with real alpha. |
| **Image Variations · Face 3-View / Product 3-View / Character 3-View / Multi-cam 9** | Single workflow, N parallel KSampler branches sharing the same model + base latent. Qwen-Image-Edit 2511 + Multiple-Angles LoRA + Lightning 4-step. |
| **Image Variations · Story 4 / Storyboard 25** | Single workflow, N chained frames — frame N+1 takes frame N as input. Qwen-Image-Edit 2509 + Next-Scene LoRA + Lightning 4-step. |
| **Outpaint · Flux Fill Outpaint** + **Fooocus SDXL Outpaint** | Canvas extension. |
| **Upscale · Ultrasharp 4x** | 4x-UltraSharp GAN upscale. |
| **Multiangle · Qwen Edit 2511 Multiangle** | Qwen Image-Edit + Multiangle LoRA, driven by the 3D camera. |
| **Video · Local LTX 2.3** (T2V + I2V + FLF2V + IA2V) | Fast; recommended default. T2V from text only; I2V needs an image; FLF2V interpolates between two keyframes; IA2V follows an audio track. |
| **Video · Local MiniMax H3** (T2V + FLF2V + R2V) | Video **with sound** in one pass. R2V takes multiple image/audio references for identity-locked shots. Lightning LoRAs wired in (~half the render time). |
| **Audio · MiniMax Music 3** | Higher-quality text-to-music alongside ACE-Step. |
| **3D Model · Hunyuan3D 2.1 / MoGe-2 / TripoSplat** | Image → textured mesh / depth geometry / Gaussian splat, all as builtin `model` workflows. |
| **Director + master timeline** | Shot-by-shot production console: generated clips, per-clip transitions, shared reference cast, content-addressed re-renders, ruler + playhead + unified film preview. |
| **MCP server + ComfyTV Bot** | 45-tool agent endpoint (stages + native graph) and the embedded sidebar agent with four providers (Claude Code / Codex / Qwen Code / Local LLM), attachments and per-provider models. |
| **Agent Skills** | SKILL.md instruction packs served to agents via MCP and to the Bot (`/` palette); manage in Settings → Skills. |
| **V2 node skins (experimental)** | Content-first LibTV-style node shells, light + dark, behind the `enable-v2` setting. |
| **Keyboard-first editing** | ←/→ frame stepping (±1) + Home/End on video track widgets; numeric sliders accept typed values with clamping. |
| **Video editing · Clip / Crop / Resize / Extract Frame / Demux** | Real edits on the source clip — trim to range, crop a region, resize, pull a still, split audio from video. No GPU or model needed. |
| **Extend a video** (↪ action) | One-click chain: extract the source's last frame → spawn a new Video Stage with that frame as the I2V starting image, fill prompt and Run. |
| **Text · Qwen3 4B** | Local LLM text generation. |
| **Audio Stage · ACE-Step v1 Music** | Text-to-music via ACE-Step v1 3.5B (native to ComfyUI core). Free-form tags + optional lyrics for vocal tracks + per-stage duration slider. |
| **Crop / Rotate / Mirror** | Browser-side, instant, no GPU. |
| **Grid Split** | Slice image → set, browser-side. |
| **Panorama viewer + Current/Multi-View capture** | Runs in the browser. |
| **Panorama · Qwen-Image-Edit 2511 Image-to-Panorama** | Image-to-equirectangular: takes a regular photo as the front view, extrapolates the full 360°. |
| **Panorama · Qwen-Image 2512 + 360 LoRA** | Text-to-equirectangular: no input image needed, describe the scene and get a full 360° panorama. Uses Qwen-Image 2512 base + 360 LoRA. |
| **Image Picker / Compare** | Pick, A/B compare. |
| **Image preview pan/zoom**, **mask painter + annotation tools** | UI utilities. |
| **Bridge nodes** (5 into-bridges) | Any third-party ComfyUI plugin can plug into a ComfyTV pipeline. |
| **Persistence** | Editor state + uploads persist. |

### ✅ Suites (no AI model needed — work instantly on your footage)

| Suite | Notes |
|---------|-------|
| **Video suite (~100 nodes)** | Editing, color (curves/LUT/CDL/HueCorrect), full keying bench (PIK/Keyer/Despill/KeyMix/…), roto + tracking + mask propagation, compositing (39 blend modes, 57 xfades), particles, lens optics, stylize, expressions, scopes, **FX Chain** single-pass rendering. See [video-and-audio.md](video-and-audio.md). |
| **Audio suite (30+ nodes)** | Dynamics/EQ/loudness/denoise/repair, **stem split** (built in, nothing to install), noise reduction, beats & notes extraction, convolution + algorithmic reverb, sidechain ducking, audio-reactive automation. |
| **Music (symbolic)** | MusicXML score + notation, piano-roll score/MIDI editors, performance profiles, SoundFont synth, click track, chord accompaniment. See [making-music.md](making-music.md). |
| **2D layer editor + storyboard** | Raster/text/vector/adjustment/fill layers, masks, magic-wand selections, **PSD import/export**; storyboard workbench with onion skin + animatic/GIF/PDF export. |
| **3D** | Scene3D workbench (keyframed cameras), geometry workshop (mesh ops/boolean/bake), PBR materials + per-part binding, line art from 3D. |
| **Libraries & runners** | Asset library, resource library (LUTs/fonts/SoundFonts), per-stage presets + default workflows, **remote ComfyUI machines as runners** (Servers tab) with capability preflight. |

---

## ⏳ Pending

### Video editing
- [ ] **Video Upscale** — frame-by-frame upscale.
- [ ] **Subtitle Erase (Smart) / (Region)** — the Region variant also needs a frame-region box-selection UI.

### Audio
- [ ] **Vocals Only / Background Only** convenience stages — the built-in **Audio Stem Split** already covers this; the dedicated toolbar stages still need rewiring onto it.

### Storyboard & shots
- [ ] **Storyboard + Shot Images** — Storyboard runs the LLM shot-list, Shot Images iterates it per shot.

### Panorama
- [ ] **Diffusion360 low-VRAM variant** (SD1.5 base + circular blending) — for users without enough VRAM for Flux Dev. Requires installing `ArcherFMY/Diffusion360_ComfyUI`.

### Other
- [ ] Box-region selection UI (for Subtitle Erase / other region-based tools).
- [ ] "Fast" presets for the heavy video models.
- [ ] Cloud generation (remote **self-hosted** ComfyUI machines already work as runners via the Servers tab; hosted/cloud backends are still pending).
