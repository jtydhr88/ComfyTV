# Load 3D Model from Asset

> Pick a 3D model from your project's asset library and bring it into the pipeline—no upload, no generation.

## What this node does

**Load 3D Model from Asset** is an **Input** stage (`ComfyTV/Input`). It has **no ▶ Run**: you pick a model in the node body from the ComfyTV **asset library**, and its snapshot immediately becomes the output. Unlike **Load 3D Model** (which reads raw files from ComfyUI's `input/3d` folder), this node draws from items already registered in the project library—results of stage runs or sidebar imports.

It emits two outputs: the `COMFYTV_MODEL` itself and a `COMFYTV_IMAGE` snapshot captured from the in-body 3D preview viewport (handy as a thumbnail).

Media flows as ComfyTV project snapshots, not native ComfyUI tensors. To interoperate with native ComfyUI 3D nodes, insert a **Bridge** — see [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## When to use it

- Reuse a model you generated earlier (via **3D Model Stage**) without re-generating.
- Pull in a model you imported into the asset library from the sidebar.
- Keep a stable library reference that survives with the project.

## Parameters

### asset picker (node body)

You select a model in the node body; the pick drives the hidden fields below. A category filter narrows the library view and is remembered.

### asset_url (internal)

Hidden. The payload URL of the picked asset; it becomes this stage's **model** output.

### asset_id (internal)

Hidden. The library id of the picked asset, kept for lineage / debugging only.

### category (internal)

Hidden. The last-selected category filter, persisted so the node remembers it.

### captured_image (internal)

Hidden. The `/view?` URL of the preview-viewport snapshot, written by the 3D preview in the node body; it becomes the **image** output.

### project_id / parent_output_id (internal)

Hidden; maintained by the **Project** node and graph wiring. You rarely touch these.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **model** | `COMFYTV_MODEL` | The selected model snapshot |
| **image** | `COMFYTV_IMAGE` | Snapshot captured from the preview viewport |

## Tips

- Nothing here uploads or generates—if your file lives in ComfyUI's `input/3d` folder instead of the library, use **Load 3D Model**.
- Orbit the preview to frame a good angle before relying on the captured **image** output.

## Related nodes

- **Load 3D Model** — load a raw model file from ComfyUI's `input/3d` folder (with material binding).
- **3D Model Stage** — generate a new model; its results can land in the asset library.
- **Load Image from Asset** / **Load Video from Asset** / **Load Audio from Asset** — same library pattern for other media.
