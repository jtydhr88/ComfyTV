> Pick **one** image from a batch to keep editing, with a full action toolbar—the hub between ComfyTV **generation** and **refinement**.

## What this node does

**Image Picker** is a **Compose** stage. Upstream stages like **Image Stage**, **Grid Split**, **Image Variations**, and **Panorama Multi-View** output **multiple** images. This node shows a thumbnail strip; whichever you click becomes the sole **`COMFYTV_IMAGE`** on the **image** output.

After selection, an **action toolbar** appears: `✏️ Edit`, `🌐 Panorama`, `📐 Multiangle`, `💡 Relight`, variation presets, etc.—ComfyTV's "pick and go" menu.

On the **first ▶ Run** of **Image Stage**, ComfyTV **auto-creates** an Image Picker downstream—you don't have to add one manually.

## When to use it

- Text-to-image returns 4–8 candidates—pick one for Inpaint / Upscale.
- Consolidate **Grid Split** or multi-view grids into one chooser.
- **Accumulate** candidates across multiple upstream Runs without losing older images (pool).
- Spawn edit subgraphs from the toolbar instead of dragging Crop / Edit nodes by hand.

## How it works (why ComfyTV is designed this way)

- **No ▶ Run**: Clicking a thumbnail updates `selected_index` and the output snapshot instantly.
- **batch socket**: Accepts `COMFYTV_IMAGES` (batch JSON) or a single `COMFYTV_IMAGE` (treated as a 1-item batch).
- **pool (accumulator)**: Hidden JSON `{images:[...]}`. The UI **appends** new upstream batches (deduped by `image_url`); pool can survive disconnect/regeneration until you **Clear** it.
- **Snapshots**: Downstream Runs read the selected image URL; changing the thumbnail changes what they see.
- **Why COMFYTV types**: URL snapshots persist per project; native `IMAGE` tensors can't. Use Bridge to cross over (table below).

## Types (COMFYTV_* vs native ComfyUI)

| ComfyTV type | What it is | vs ComfyUI native |
|---|---|---|
| `COMFYTV_IMAGES` | Multi-image JSON batch | Wire to **batch** |
| `COMFYTV_IMAGE` | Single-image URL snapshot | **image** output; also valid on **batch** as 1-item batch |
| Native `IMAGE` | Tensor | **→ ComfyTV Image(s)** Bridge first |

Details: [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## UI and parameters

### batch (upstream)

- **What**: The visible wired input; `COMFYTV_IMAGES` or `COMFYTV_IMAGE`.
- **Wire**: Image Stage **images**, Grid Split **images**, etc.
- **Effect**: New batches merge into pool and the thumbnail strip.
- **Mistake**: Wiring only **image** works, but multi-image generation should use **images**.

### selected_index (hidden)

- 1-based index; set by **clicking a thumbnail**. Chooses which pool item feeds **image**.

### pool (hidden)

- Accumulator JSON; UI handles append/dedupe/Clear. Rarely edited by hand.

### Toolbar (node UI)

- Appears after selecting a thumbnail; buttons spawn edit/generate stages prefilled with the current image.
- See [compose.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/compose.md) and [getting-started.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.md).

## Outputs

| Output | Type | Meaning | Typical downstream |
|---|---|---|---|
| **image** | `COMFYTV_IMAGE` | Selected single-image snapshot | Any image edit stage, Video Stage (I2V), Compare image_a/image_b |

## Step by step for beginners

1. Add **Project** + **Image Stage**, prompt, workflow (e.g. Local SD1.5).
2. **▶ Run** Image Stage—ComfyTV inserts **Image Picker** if missing.
3. **Click** your favorite thumbnail; watch the toolbar appear.
4. (Optional) Click `✏️ Edit` or wire **Upscale** manually.
5. **▶ Run** downstream on the selected image.
6. (Optional) Run Image Stage again for more candidates; pool keeps old images until **Clear**.

## Full guides (recommended reading)

> This page covers **one node only**. For end-to-end workflows, multi-stage pipelines, type conversion, and design rationale, see the [ComfyTV user guides](https://github.com/jtydhr88/ComfyTV/tree/main/docs) on GitHub:

| Guide | Contents |
| --- | --- |
| [Getting started](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.md) | Install, canvas basics, per-stage Run, snapshots, Project, Image Picker |
| [Compose](https://github.com/jtydhr88/ComfyTV/blob/main/docs/compose.md) | Image Picker, Compare, Storyboard→Shot Images, timeline |
| [Image tools](https://github.com/jtydhr88/ComfyTV/blob/main/docs/image-tools.md) | Crop, inpaint, outpaint, upscale, multi-angle, variation presets |

## Repository and workflows

| Resource | Link |
| --- | --- |
| **GitHub repository** | https://github.com/jtydhr88/ComfyTV |
| **User guides index** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **Built-in workflows** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **Model checklist** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |
## FAQ

**Q: vs clicking thumbnails on Image Stage itself?**  
A: Image Stage also has **selected_index** on its **image** output; Picker adds **pool accumulation**, a dedicated toolbar, and merging multiple upstream batches.

**Q: Why COMFYTV types?**  
A: URL snapshots save with the project; downstream stages Run independently. Bridge native plugin output.

**Q: Pool too cluttered?**  
A: Click **Clear** in the UI, or add a fresh Picker node.

**Q: No toolbar?**  
A: You must **click** to select a thumbnail—not hover only.

**Q: Load vs generate?**  
A: Loaders import existing files; Image Stage generates batches. After generation, pick via Picker (or Stage selection) before editing.

## Related nodes

- **Image Stage** — common upstream; auto-creates Picker on first Run.
- **Shot Images** — storyboard batch; wire Picker to pick one shot.
- **Compare** — before/after slider (two separate `COMFYTV_IMAGE` wires).
- **Grid Split** / **Image Variations** / **Panorama Multi-View** — multi-image upstream.
- **→ ComfyTV Images** — import native batches.
