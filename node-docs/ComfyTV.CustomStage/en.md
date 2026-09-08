# Custom Stage

> Turn any ComfyUI workflow into a ComfyTV card: you decide which of its nodes' inputs and outputs the card exposes.

## What this node does

**Custom Stage** wraps a workflow from the `custom/` library. Instead of a fixed contract (prompt + image → image), you open **Expose I/O** on the card and tick the native nodes you want on the outside:

- **Inputs** — `LoadImage` / `LoadVideo` / `LoadAudio` / `Load3D` file pickers become `image` / `video` / `audio` / `model` sockets; `STRING` widgets become `text` sockets with an editable box on the card; `INT` / `FLOAT` / `BOOLEAN` / combo widgets become parameters edited on the card.
- **Outputs** — `SaveImage` / `SaveVideo` / `SaveAudio` / `SaveGLB` and text-preview nodes become the `image` (or `images` batch) / `video` / `audio` / `model` / `text` outputs. The first exposed output is the card's preview.

Each exposed item gets a label you choose; labels show on the sockets and in the card. Media inputs can be marked required.

## How it runs

- ▶ Run executes only this workflow. Wired sockets are injected into the chosen nodes; exposed text and parameters come from the card (a wired `text` socket overrides the typed value).
- All exposed outputs are collected in one run and land on their sockets; the primary one is stored as the stage's snapshot so it survives reload.
- The exposure definition belongs to the **workflow**, so every Custom Stage that picks the same workflow shares it. Parameter values are per card.

## Notes

- V2 skin only. Enable it in ComfyTV settings.
- One output per type. Toggle an image output to **Batch** to expose it as `images`.
- The library folder is `user/comfytv/workflows/custom/`; **🔗 Link workflow** in the footer adds one from ComfyUI's own workflow library.
