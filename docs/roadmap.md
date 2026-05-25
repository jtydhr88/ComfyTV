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
| **Relight · Qwen Edit 2509 Relight** (+ with-reference variant) | Brightness / color / rim-light widgets compose a natural-language instruction; the with-reference variant accepts a reference image for light transfer. |
| **Cutout · BiRefNet Cutout** | Background removal via ComfyUI core's BiRefNet. Outputs PNG with real alpha. |
| **Image Variations · Face 3-View / Product 3-View / Character 3-View / Multi-cam 9** | Single workflow, N parallel KSampler branches sharing the same model + base latent. Qwen-Image-Edit 2511 + Multiple-Angles LoRA + Lightning 4-step. |
| **Image Variations · Story 4 / Storyboard 25** | Single workflow, N chained frames — frame N+1 takes frame N as input. Qwen-Image-Edit 2509 + Next-Scene LoRA + Lightning 4-step. |
| **Outpaint · Flux Fill Outpaint** + **Fooocus SDXL Outpaint** | Canvas extension. |
| **Upscale · Ultrasharp 4x** | 4x-UltraSharp GAN upscale. |
| **Multiangle · Qwen Edit 2511 Multiangle** | Qwen Image-Edit + Multiangle LoRA, driven by the 3D camera. |
| **Video · Local LTX 2.3** (T2V + I2V + FLF2V + IA2V) | Fast; recommended default. T2V from text only; I2V needs an image; FLF2V interpolates between two keyframes; IA2V follows an audio track. |
| **Video editing · Clip / Crop / Resize / Extract Frame / Demux** | Real PyAV-based edits — trim to range, crop a region, resize, pull a still, split audio from video. No GPU; runs against the source clip on disk. |
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

---

## ⏳ Pending

### Video editing
- [ ] **Video Upscale** — frame-by-frame upscale.
- [ ] **Subtitle Erase (Smart) / (Region)** — the Region variant also needs a frame-region box-selection UI.

### Audio
- [ ] **Vocals Only / Background Only (Demucs)** — via `lum3on/ComfyUI_AudioTools`'s `AudioStemSeparate`.

### Storyboard & shots
- [ ] **Storyboard + Shot Images** — Storyboard runs the LLM shot-list, Shot Images iterates it per shot.

### Timeline
- [ ] **Director Timeline + Timeline Render** — LTX multishot + ffmpeg concat.

### Panorama
- [ ] **Diffusion360 low-VRAM variant** (SD1.5 base + circular blending) — for users without enough VRAM for Flux Dev. Requires installing `ArcherFMY/Diffusion360_ComfyUI`.

### Other
- [ ] Box-region selection UI (for Subtitle Erase / other region-based tools).
- [ ] "Fast" presets for the heavy video models.
- [ ] Cloud / remote generation (today everything runs against your local models).
