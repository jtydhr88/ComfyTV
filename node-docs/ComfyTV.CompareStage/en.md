> Drag a **before/after slider** to compare two images—visual QA only, no new output.

## What this node does

**Compare** is a **display-only Compose** stage. It takes two `COMFYTV_IMAGE` inputs: **image_a** (usually original / before) and **image_b** (after / new workflow result). The node body shows a **split slider**—drag the vertical handle to reveal left vs right and inspect Inpaint seams, Upscale sharpening, Relight color shift, etc.

There are **no output sockets**—nothing flows downstream, nothing new enters the asset library. When satisfied, wire the version you want to keep from the **edit stage or Image Picker**.

User docs: [compose.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/compose.md)

## When to use it

- Before/after **Upscale**—extra detail vs artifacts.
- **Inpaint / Erase** seam check.
- **Relight / Image Edit** vs Picker original.
- Two **Image Stage** seeds (pick singles via Picker, then compare).

## How it works (why ComfyTV is designed this way)

- **No ▶ Run**: Browser renders the slider instantly; rewiring refreshes from latest snapshot URLs.
- **No snapshot output**: Compare doesn't emit a new COMFYTV type; upstream snapshots stay separate.
- **Why COMFYTV_IMAGE**: Both inputs must be loadable URL snapshots; native `IMAGE` tensors need **→ ComfyTV Image** Bridge.
- **vs Image Picker**: Picker **chooses one** to continue the pipeline; Compare **looks only**—doesn't replace Picker.

## Types (COMFYTV_* vs native ComfyUI)

| ComfyTV type | What it is | vs ComfyUI native |
|---|---|---|
| `COMFYTV_IMAGE` | Single-image URL | Both **image_a** and **image_b** |
| Native `IMAGE` | Tensor | **→ ComfyTV Image** each, then Compare |
| Output | None | Cannot wire Video Stage etc. |

Details: [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## UI and parameters

### image_a (before / left)

- **What**: Optional `COMFYTV_IMAGE`; slider **left** baseline.
- **Wire**: Picker original, Loader output, pre-edit branch.
- **Effect**: Reference side; empty → only image_b shows.

### image_b (after / right)

- **What**: Optional `COMFYTV_IMAGE`; **right** reveal side.
- **Wire**: Upscale / Inpaint / Relight **image** outputs.
- **Effect**: Slides against image_a.
- **Mistake**: Swapping a/b works visually but confuses before/after semantics.

### Slider UI

- **Drag horizontally** inside the node body; no extra parameters.
- May inherit global preview zoom/pan on hover where supported.

## Outputs

**No output sockets.** Compare doesn't merge images or pick a "winner"—wire your preferred branch downstream manually.

## Step by step for beginners

1. Get an original via **Image Picker** or **Load Image** (`COMFYTV_IMAGE`).
2. Branch to **Upscale** (or another edit); **▶ Run** for the after image.
3. Add **Compare**.
4. Original → **image_a**; Upscale **image** → **image_b**.
5. **Drag the slider** in the node body.
6. Continue downstream from Upscale (or original); leave Compare on canvas for reference.

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

**Q: Why no outputs?**  
A: By design—a **viewer** only; avoids piping a "comparison blend" downstream. Wire the edit stage you prefer.

**Q: Slider shows one image?**  
A: Wire both **image_a** and **image_b**; upstream must have Run snapshots. Very different sizes may letterbox.

**Q: Native IMAGE?**  
A: **→ ComfyTV Image** Bridge first.

**Q: Redundant with Picker toolbar?**  
A: Picker selects + spawns edits; Compare is **pixel-level before/after**, no toolbar.

**Q: Load vs generate?**  
A: Compare neither loads nor generates—it **compares** two existing snapshots from loaders or generators.

## Related nodes

- **Upscale** / **Inpaint** / **Relight** / **Erase** — common image_b sources.
- **Image Picker** — common image_a source.
- **Load Image** / **Load Image from Asset** — originals.
- **→ ComfyTV Image** — import native tensors.
- **Image Stage** — generate candidates, then Picker + Compare branches.
