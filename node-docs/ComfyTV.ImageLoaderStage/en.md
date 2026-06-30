> Pick or upload a local image from ComfyUI's `input/` folder as a **starting point** for your ComfyTV pipeline—ideal when you already have assets and don't need AI generation.

## What this node does

**Load Image** is an **Input** stage that does **not** call any AI model. It registers a file on disk (or one you just uploaded) as a project **snapshot** and passes it downstream as `COMFYTV_IMAGE`.

Think of it as "bring an existing image into my ComfyTV project." After you select a file, the node body shows a preview; downstream stages (crop, upscale, image-to-video, etc.) read that snapshot.

Unlike **Load Image from Asset**, this node reads ComfyUI's global **`input/` directory** (or files written there by the upload widget)—not items produced by running stages inside the ComfyTV asset library.

## When to use it

- You already have PNG/JPG/WebP files and want them in a ComfyTV edit or video pipeline.
- You exported images elsewhere, dropped them into `input/`, and pick them here.
- You need a **raw file** (not a generated project asset) as a reference for Image Edit, Video Stage, etc.
- You bridge output from native ComfyUI plugin nodes into ComfyTV (see FAQ).

## How it works (why ComfyTV is designed this way)

- **Stage vs Run button**: This node has **no ▶ Run** button. Choosing from the dropdown or uploading **immediately** sets the output—an instant Input stage that does not enqueue the whole graph.
- **Snapshots**: Once selected, ComfyTV stores a URL for that file in the current project. When a downstream stage Runs, it uses that snapshot—it will **not** auto-refresh if you replace the file on disk under the same name; re-select here.
- **No workflow**: There is no ComfyUI subgraph JSON behind this node—only a file path under `input/`. Generation stages use `workflows/<kind>/`.

## Types (COMFYTV_* vs native ComfyUI)

| ComfyTV type | What it is | vs ComfyUI native |
|---|---|---|
| `COMFYTV_IMAGE` | Single-image URL snapshot | Not an in-memory `IMAGE` tensor |
| `COMFYTV_IMAGES` | Multi-image batch JSON | Not an `IMAGE` batch |
| `COMFYTV_VIDEO` / `COMFYTV_AUDIO` | Same pattern | Use Bridge nodes to cross over |

**How to convert:**

- Native → ComfyTV: `ComfyTV/Bridge` → `→ ComfyTV Image` (Run to snapshot)
- ComfyTV → native: `← ComfyTV Image` (snapshot back to tensor)

Details: [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## UI and parameters

### image

- **What**: Dropdown of image files in ComfyUI **`input/`**, plus an **upload** control (writes to the same folder).
- **What to set**: Pick an existing file or upload a new one.
- **Effect**: The chosen file is the sole output; changing the selection changes the snapshot.
- **Common mistake**: Expecting generated project images here—that is **Load Image from Asset**. `input/` is ComfyUI's shared folder for all workflows.

### project_id / parent_output_id (internal)

- Hidden; maintained by the **Project** node and graph wiring. You rarely touch these.

## Outputs

| Output | Type | Meaning | Typical downstream |
|---|---|---|---|
| **image** | `COMFYTV_IMAGE` | Snapshot URL of the selected file | Image Picker, Crop, Upscale, Inpaint, Video Stage (I2V), Compare image_a/image_b |

## Step by step for beginners

1. **Add Node → ComfyTV → Input → Load Image**.
2. (Recommended) Add a **Project** node, name your project, and wire it in so snapshots are scoped correctly.
3. Put files in ComfyUI's **`input/`** folder or use **Upload** on this node.
4. Select the file in the dropdown—the preview updates; **no Run click needed**.
5. Connect **image** downstream, e.g. to **Image Picker** or **Crop**.
6. Click **▶ Run** on the downstream stage to process from this input.

## Full guides (recommended reading)

> This page covers **one node only**. For end-to-end workflows, multi-stage pipelines, type conversion, and design rationale, see the [ComfyTV user guides](https://github.com/jtydhr88/ComfyTV/tree/main/docs) on GitHub:

| Guide | Contents |
| --- | --- |
| [Getting started](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.md) | Install, canvas basics, per-stage Run, snapshots, Project, Image Picker |
| [Compose](https://github.com/jtydhr88/ComfyTV/blob/main/docs/compose.md) | Image Picker, Compare, Storyboard→Shot Images, timeline |

## Repository and workflows

| Resource | Link |
| --- | --- |
| **GitHub repository** | https://github.com/jtydhr88/ComfyTV |
| **User guides index** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **Built-in workflows** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **Model checklist** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |
## FAQ

**Q: Load Image vs Load Image from Asset?**  
A: **Load Image** = raw files in ComfyUI `input/` (upload/disk). **Load Image from Asset** = project library items from stage runs or sidebar imports. External files → this node; generated results → asset loader.

**Q: Downstream Run fails to connect?**  
A: Ensure the socket expects `COMFYTV_IMAGE`, not native `IMAGE`. Tensors need **→ ComfyTV Image** Bridge first.

**Q: How is this different from Image Stage?**  
A: This node **does not generate** or use GPU for inference—it only registers an existing file. For AI images use **Generate → Image Stage**.

**Q: No ▶ Run button—is that normal?**  
A: Yes. Input loaders output on selection; only workflow-backed stages have Run.

## Related nodes

- **Load Image from Asset** — pick from the project asset library.
- **Load Video** / **Load Audio** — same pattern for other media.
- **Image Picker** — pick one from a batch and open the edit toolbar.
- **→ ComfyTV Image** (Bridge) — import native `IMAGE` tensors.
