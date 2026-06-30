# Video Stage

> Generates short video clips from text, images, and optional audio—four built-in LTX 2.3 modes: T2V, I2V, FLF2V, and IA2V.

## What this node does

**Video Stage** turns prompts and optional references into an MP4 preview. Pick **workflow**, resolution, aspect ratio, and duration, click **▶ Run**, and play the clip on the node.

Output is **`COMFYTV_VIDEO`**—a project video snapshot URL, not a native ComfyUI VIDEO tensor. Wire it to Video Crop, Video Upscale, Timeline, or Bridge for native nodes.

Depending on the workflow you may need only text (T2V), or images, start/end frames, and an audio track (I2V / FLF2V / IA2V).

## When to use it

- Generate motion from text only (**Local LTX 2.3 T2V**).
- Animate a still concept (**I2V**).
- Interpolate between start and end keyframes (**FLF2V**).
- Lip-sync or rhythm driven by narration or BGM (**IA2V**, requires **audio**).
- Image Stage → Video I2V to preview motion quickly.

## How ComfyTV stages work

- **▶ Run** executes only the subgraph in [`workflows/video/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/video).
- **Snapshots**: video URL is stored in the project; downstream Clip/Resize reads it without re-running Video Stage.
- ComfyTV derives frame count from **resolution + aspect_ratio + duration_s** (LTX uses divisor=8, etc.) and maps into latent + `SaveVideo` / `VHS_VideoCombine`.

**generate_audio** asks the subgraph to synthesize an audio track—different from IA2V, which uses **external audio** to drive visuals.

## Types (COMFYTV_VIDEO vs native ComfyUI)

| ComfyTV type | What it is | vs native ComfyUI |
| --- | --- | --- |
| `COMFYTV_VIDEO` | Video clip project snapshot URL | Not an in-memory VIDEO/LATENT chain |
| Native video outputs | Tensors or temp files | Need Bridge for ComfyTV stages |

**Conversion:**

- Native → ComfyTV: **→ ComfyTV Video**
- ComfyTV → native: **← ComfyTV Video**

See [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## Parameters

### workflow — four LTX 2.3 variants (when to use each)

Options from [`workflows/video/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/video). All four share LTX-Video 2.3 22B (fp8 + Gemma 3 text encoder + Lightning LoRA + 2× spatial upsampler):

| Workflow | Mode | When to use | Required upstream |
| --- | --- | --- | --- |
| **Local LTX 2.3 T2V** | Text-to-video | Text-only, no reference image | Prompt only |
| **Local LTX 2.3 I2V** | Image-to-video | **One** still as first-frame / appearance ref | **images**: 1× `COMFYTV_IMAGE` |
| **Local LTX 2.3 FLF2V** | First-last-frame | Control **start and end** frames | **images**: **2** (start + end keyframes) |
| **Local LTX 2.3 IA2V** | Image + audio | Motion/lips follow **existing audio** | **images**: 1 + **audio** required |

**Quick picks:**

- Brainstorm motion → **T2V**.
- Storyboard still → **I2V**.
- Known opening and closing frames → **FLF2V**.
- Existing Speech/Music output → **IA2V**.

Models: [models.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md).  
Workflow docs: [workflows/video/README.md](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/video/README.md).

### main_prompt

Scene, camera motion, mood. Upstream **texts** append. For I2V, still describe motion (e.g. `camera slowly pans left`).

### resolution / aspect_ratio

Short-side tier (default **720P**) and ratio (default **16:9**). Use `9:16` for vertical shorts.

### duration_s

Target length **4–15** seconds (default 5). Drives fps and frame count in the subgraph.

### generate_audio

Whether the **subgraph** also synthesizes audio. Optional for T2V/I2V/FLF2V. For **IA2V**, prefer external **audio** and usually leave this off.

### texts / images / videos

- **texts**: Text Stage or story context.
- **images**: I2V = 1; FLF2V = 2 (start → end order).
- **videos**: Some workflows accept motion refs (built-in LTX is image-first).

### audio

**Required for IA2V**. Wire Speech Stage, Music Stage, or Load Audio from Asset (`COMFYTV_AUDIO`). Other LTX workflows do not need it.

### custom_params

Sidebar: seed, negative prompt, etc.

## Outputs

| Output | Type | Meaning | Downstream |
| --- | --- | --- | --- |
| **video** | `COMFYTV_VIDEO` | Generated clip snapshot | Video Crop / Upscale / Clip / Timeline; Bridge ← ComfyTV Video |

## Step by step for beginners

1. Add **Project** + **Image Stage** for a `16:9` concept (or skip for pure T2V).
2. **ComfyTV → Generate → Video Stage**.
3. With a reference: **Local LTX 2.3 I2V**, Image **image** → **images**; text-only: **T2V**.
4. **main_prompt**: `slow cinematic zoom, soft fog`.
5. **duration_s** `5`; download LTX 2.3 models ([models.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md)).
6. **▶ Run** and preview on the node.
7. For editing: **Video Crop Stage** or **Director Timeline Stage**.

**FLF2V**: two Image outputs → **images.image0** and **images.image1** → **FLF2V** → Run.

**IA2V**: Speech **audio** → Video **audio**, portrait **image** → **images** → **IA2V** → Run.

## Full guides (recommended reading)

> This page covers **one node only**. For end-to-end workflows, multi-stage pipelines, type conversion, and design rationale, see the [ComfyTV user guides](https://github.com/jtydhr88/ComfyTV/tree/main/docs) on GitHub:

| Guide | Contents |
| --- | --- |
| [Getting started](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.md) | Install, canvas basics, per-stage Run, snapshots, Project, Image Picker |
| [Generate](https://github.com/jtydhr88/ComfyTV/blob/main/docs/generate.md) | Text, Image, Video, Music, and Speech stages and workflow selection |
| [Video and audio](https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.md) | Clip, crop, resize, extract frame, demux vs Generate video |
| [Model files](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md) | Checkpoints, LoRAs, and folder paths per workflow |

## Repository and workflows

| Resource | Link |
| --- | --- |
| **GitHub repository** | https://github.com/jtydhr88/ComfyTV |
| **User guides index** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **Built-in workflows** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **Model checklist** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md |
| **This node's workflow folder** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/video |
| **Workflow README** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/video/README.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |
## FAQ

**Q: I2V ignores my reference?**  
A: Wire **images** and pick **I2V**, not T2V; check LoadImage binding in the preset.

**Q: FLF2V with one image?**  
A: Need **two** keyframes in order (start, then end).

**Q: IA2V fails or A/V out of sync?**  
A: **audio** is required; align duration with **duration_s**; use ComfyTV audio stages, not raw native AUDIO.

**Q: Cannot wire to native video nodes?**  
A: Use **← ComfyTV Video** Bridge.

## Related nodes

- **Image Stage**—keyframes for I2V / FLF2V.
- **Speech Stage / Music Stage (Audio Stage)**—**audio** for IA2V.
- **Video Crop / Upscale / Clip Stage**—post-processing.
- **Director Timeline Stage**—multi-clip assembly.
- **Bridge → / ← ComfyTV Video**—native interop.
- **Project**—project context.
