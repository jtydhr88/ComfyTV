# Load Image from Asset

> Pick an image from the ComfyTV **project asset library** as pipeline input—ideal for reusing generated, edited, or imported results in the current project, not raw `input/` files.

## What this node does

**Load Image from Asset** is an **Input** stage with an embedded **asset picker**: category tabs, search, and a thumbnail grid. Clicking a thumbnail immediately outputs a `COMFYTV_IMAGE` snapshot.

The library holds media from stage runs in the **current ComfyTV project** and items imported via the **Assets** sidebar. Each entry has lineage (source stage) so you can trace where an image came from.

vs **Load Image** (ComfyUI `input/` folder): external files → Load Image; in-project results → this node.

## When to use it

- After **Image Stage**, branch off and pick another image from the library for editing.
- Reuse one shot from **Shot Images** without regenerating the whole storyboard batch.
- Use **Load as asset node** from an image hover menu for a pre-filled picker node.
- Share artifacts across branches in one project without re-running upstream stages.

## How it works (why ComfyTV is designed this way)

- **Stage vs Run**: **No ▶ Run**—click a thumbnail to register a snapshot; no workflow, no full-graph queue.
- **Snapshots**: The asset payload URL is stored in the project; downstream Runs read it. Picking another image updates the snapshot.
- **Library vs input/**: `input/` is ComfyUI-global; the asset library is scoped by **Project** and holds ComfyTV stage outputs plus explicit imports.
- **No workflow**: Selection only—not `workflows/image/`.

## Types (COMFYTV_* vs native ComfyUI)

| ComfyTV type | What it is | vs ComfyUI native |
|---|---|---|
| `COMFYTV_IMAGE` | Single-image URL snapshot | Not `IMAGE` tensor |
| `COMFYTV_IMAGES` | Multi-image JSON batch | Image Picker splits batches to one image |
| Native `IMAGE` | In-memory tensor | Needs **→ ComfyTV Image** Bridge first |

Details: [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## UI and parameters

### Asset picker (node body)

- **What**: Scrollable thumbnails, **category** tabs (`all` or custom), **search**.
- **How**: Click to select; populate the library by running generators or sidebar import first.
- **Effect**: Defines the output `COMFYTV_IMAGE`.
- **Common mistake**: Empty category ≠ broken—switch back to `all`.

### asset_url / asset_id / category (hidden)

- **asset_url**: Internal payload URL written by the UI—the actual output.
- **asset_id**: Library id for lineage/debug.
- **category**: Last category filter, persisted when reopening workflows.

### project_id / parent_output_id (internal)

- Tied to **Project**; libraries are project-scoped.

## Outputs

| Output | Type | Meaning | Typical downstream |
|---|---|---|---|
| **image** | `COMFYTV_IMAGE` | Selected asset snapshot | Image Picker, image edit stages, Video Stage (I2V), Compare |

## Step by step for beginners

1. Add **Project** and name your project (assets are per-project).
2. Run an image stage (e.g. **Image Stage**) or import via **Assets** sidebar to **fill the library**.
3. **Add Node → ComfyTV → Input → Load Image from Asset**.
4. Browse thumbnails; filter/search as needed.
5. **Click** the target image—preview updates; **no Run**.
6. Wire **image** downstream and **▶ Run** there.

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

**Q: Empty asset library?**  
A: Run a generator under the same **Project**, or import from the sidebar. Confirm Project matches the canvas.

**Q: vs Load Image (input/)?**  
A: **External/raw files** → **Load Image**. **Project generated/imported** → **Load Image from Asset**. Loaders **reuse**; generators **create** (Image Stage).

**Q: Native plugin images?**  
A: Run **→ ComfyTV Image** Bridge first so the result enters the library.

**Q: Click does nothing?**  
A: Refresh the page; verify asset URLs are still valid.

## Related nodes

- **Load Image** — raw `input/` files.
- **Load Video from Asset** / **Load Audio from Asset** — same pattern for other media.
- **Image Stage** — writes new images to the library.
- **Image Picker** — pick from wired upstream batches (live), complementary to library browsing here.
