# Image Stage

> Generates one or more images from text with local or built-in models—the main “create from scratch” entry in ComfyTV, with img2img (i2i) support.

## What this node does

**Image Stage** handles **text-to-image (t2i)** and **image-to-image (i2i)**. Write **main_prompt**, pick a **workflow** (e.g. Local SD1.5 or Ideogram4), set resolution, aspect ratio, and batch size, click **▶ Run**, and thumbnails appear on the node.

Two outputs:

- **images** (`COMFYTV_IMAGES`): the **full batch** from this run.
- **image** (`COMFYTV_IMAGE`): the **selected** thumbnail (**selected_index**, 1-based).

On the **first successful run**, ComfyTV usually **auto-spawns an Image Picker** downstream to pick one image for crop, upscale, or inpaint.

## When to use it

- Generate concept art, product shots, or character designs from prompts.
- i2i: choose an i2i workflow, wire a reference to **images**, describe the desired change in main_prompt.
- Batch 2–8 images and compare compositions before editing one.
- Wire Text Stage **text** → **texts** for LLM-expanded prompts.
- Feed Video Stage I2V / FLF2V with **image** (`COMFYTV_IMAGE`).

## How ComfyTV stages work

- **▶ Run** executes only Image Stage’s subgraph—not the whole ComfyUI graph.
- **Snapshots**: image URLs are stored in the project; downstream Upscale/Crop reads them without re-running Image Stage.
- The **workflow** dropdown maps to JSON in [`workflows/image/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/image); ComfyTV maps prompt, resolution, aspect_ratio, batch_size, and seed into `EmptyLatentImage`, `KSampler`, `CLIPTextEncode`, etc.

i2i workflows bind the first upstream **images** entry to `LoadImage` in the subgraph.

## Types (COMFYTV_IMAGE vs ComfyUI IMAGE)

| ComfyTV type | What it is | vs native ComfyUI |
| --- | --- | --- |
| `COMFYTV_IMAGE` | Single-image project snapshot (`/view?` URL) | **Not** an in-memory `IMAGE` tensor |
| `COMFYTV_IMAGES` | Batch JSON `{images:[...]}` | **Not** a native IMAGE batch |
| Native `IMAGE` | Pixel tensor in GPU memory | Used by SaveImage; cannot wire directly to ComfyTV stages |

**Conversion:**

- Native → ComfyTV: **ComfyTV/Bridge** → **→ ComfyTV Image** (Run to snapshot)
- ComfyTV → native: **← ComfyTV Image** (snapshot → `IMAGE` tensor for ControlNet, IPAdapter, etc.)

See [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

**Common mistake**: Wiring native `Load Image` (`IMAGE`) to **images**—types do not match. Use **→ ComfyTV Image** Bridge or **Load Image from Asset** (`COMFYTV_IMAGE`).

## Parameters

### workflow

Backends in [`workflows/image/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/image):

| Option | Mode | Notes |
| --- | --- | --- |
| **Local SD1.5** | t2i | Classic SD1.5 text-to-image |
| **Local SD1.5 I2I** | i2i | Same checkpoint, VAEEncode + denoise &lt; 1 |
| **Image Ideogram4 T2I** | t2i | Ideogram 4 + Qwen3-VL text encoder |

Models: [models.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md). Details: [README.md](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/image/README.md).

### main_prompt

Describe the scene. Upstream **texts** append as extra context.

**Example:** `a red apple on a wooden table, soft window light, photorealistic`

### resolution

Short-side tier: `480P`, `720P`, `1K`, `1080P`, etc. Combined with **aspect_ratio** for `(w, h)` on the latent node.

### aspect_ratio

e.g. `1:1`, `16:9`, `9:16`. Use `9:16` for vertical posters, `16:9` for widescreen.

### batch_size

Images per run (1–8). **image** output uses **selected_index**.

### texts

Wire Text Stage **text** or other `COMFYTV_TEXT` for extra prompt context.

### images

**Required for i2i**: pick **Local SD1.5 I2I**, wire reference to **images.image0** (first image wins). t2i workflows ignore upstream images.

Sources: **image** from Image Stage/Picker, Asset Loader, Bridge → ComfyTV Image.

### selected_index

Which batch item **image** refers to (**1-based**). Click thumbnails on the node to switch; toolbar appears (✏️ Edit, 🌐 Panorama, etc.).

### custom_params

Sidebar bindings for seed, negative prompt, steps, CFG, etc.

## Outputs

| Output | Type | Meaning | Downstream |
| --- | --- | --- | --- |
| **images** | `COMFYTV_IMAGES` | Full batch | Image Picker, Compare Stage |
| **image** | `COMFYTV_IMAGE` | Selected single | Video I2V, Upscale, Inpaint, Bridge ← ComfyTV Image |

## Step by step for beginners

1. Add **Project**, then **ComfyTV → Generate → Image Stage**.
2. **workflow** → **Local SD1.5**.
3. **main_prompt**: `a red apple on a wooden table`.
4. **resolution** `1K`, **aspect_ratio** `1:1`, **batch_size** `1`.
5. Download `v1-5-pruned-emaonly.safetensors` ([models.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md)).
6. **▶ Run**; Image Picker may appear automatically.
7. Click a thumbnail → **Upscale** or **Crop** from the toolbar.

**i2i**: **Local SD1.5 I2I** → wire **image** to **images** → prompt e.g. `watercolor style` → Run.

## Full guides (recommended reading)

> This page covers **one node only**. For end-to-end workflows, multi-stage pipelines, type conversion, and design rationale, see the [ComfyTV user guides](https://github.com/jtydhr88/ComfyTV/tree/main/docs) on GitHub:

| Guide | Contents |
| --- | --- |
| [Getting started](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.md) | Install, canvas basics, per-stage Run, snapshots, Project, Image Picker |
| [Generate](https://github.com/jtydhr88/ComfyTV/blob/main/docs/generate.md) | Text, Image, Video, Music, and Speech stages and workflow selection |
| [Image tools](https://github.com/jtydhr88/ComfyTV/blob/main/docs/image-tools.md) | Crop, inpaint, outpaint, upscale, multi-angle, variation presets |
| [Model files](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md) | Checkpoints, LoRAs, and folder paths per workflow |
| [Custom workflows](https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md) | Import your ComfyUI workflow JSON without Python changes |

## Repository and workflows

| Resource | Link |
| --- | --- |
| **GitHub repository** | https://github.com/jtydhr88/ComfyTV |
| **User guides index** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **Built-in workflows** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **Model checklist** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md |
| **This node's workflow folder** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/image |
| **Workflow README** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/image/README.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |
## FAQ

**Q: Run does nothing or workflow is grey?**  
A: Check models; restart ComfyUI; read terminal errors.

**Q: Cannot wire native Load Image to images?**  
A: Wrong type—use Bridge **→ ComfyTV Image** or **Load Image from Asset**.

**Q: Batch has 4 images but downstream gets one?**  
A: Use **image** or **Image Picker**; **images** is the full batch JSON.

**Q: Changed prompt but downstream still shows old image?**  
A: Re-run Image Stage, then downstream stages.

## Related nodes

- **Image Picker**—pick one from batch or accumulated pool (often auto-created).
- **Text Stage**—upstream prompt expansion.
- **Video Stage (I2V / FLF2V)**—**image** as video conditioning.
- **Upscale / Inpaint / Outpaint Stage**—single-image editing.
- **Bridge → / ← ComfyTV Image**—native ComfyUI interop.
- **Project**—project context.
