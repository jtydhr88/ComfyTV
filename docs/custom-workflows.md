**English** | [简体中文](custom-workflows.zh.md)

# Custom workflows

Every option in a ComfyTV stage's **workflow** dropdown is a JSON file under `custom_nodes/ComfyTV/workflows/<kind>/`. Drop your file in, restart ComfyUI, done. **No Python edits.**

```
workflows/
  image/                                ← Image Stage
    my-workflow.json                    GUI workflow export
    my-workflow_preset.json             optional preset (shipped defaults)
  image-edit/   inpaint/   erase/   outpaint/   upscale/   multiangle/
  relight/   cutout/   multiview/   sequence/
  video/        text/       audio/      audio-vocal/    audio-bg/
  shot-images/  storyboard/  panorama/  timeline/
```

The full list of kinds: `text, image, shot-images, video, audio, storyboard, panorama, timeline, upscale, outpaint, inpaint, erase, image-edit, multiangle, relight, cutout, multiview, sequence, audio-vocal, audio-bg`.

**The folder decides the kind.** Each shipped kind has a `README.md` next to its JSONs documenting the run-time inputs and the nodes a workflow typically needs. Read the relevant per-kind README first:

- [`workflows/audio/README.md`](../workflows/audio/README.md)
- [`workflows/image/README.md`](../workflows/image/README.md)
- [`workflows/image-edit/README.md`](../workflows/image-edit/README.md)
- [`workflows/inpaint/README.md`](../workflows/inpaint/README.md)
- [`workflows/outpaint/README.md`](../workflows/outpaint/README.md)
- [`workflows/upscale/README.md`](../workflows/upscale/README.md)
- [`workflows/cutout/README.md`](../workflows/cutout/README.md)
- [`workflows/erase/README.md`](../workflows/erase/README.md)
- [`workflows/relight/README.md`](../workflows/relight/README.md)
- [`workflows/multiangle/README.md`](../workflows/multiangle/README.md)
- [`workflows/multiview/README.md`](../workflows/multiview/README.md)
- [`workflows/sequence/README.md`](../workflows/sequence/README.md)
- [`workflows/panorama/README.md`](../workflows/panorama/README.md)
- [`workflows/text/README.md`](../workflows/text/README.md)
- [`workflows/video/README.md`](../workflows/video/README.md)
- [`workflows/shot-images/README.md`](../workflows/shot-images/README.md)
- [`workflows/storyboard/README.md`](../workflows/storyboard/README.md)

---

## How to add a custom workflow

1. **Workflow → Save** in ComfyUI (the default GUI format, **not** "Save (API Format)").
2. Save as `workflows/<kind>/<name>.json`.
3. **Restart ComfyUI**. Your new workflow appears in the dropdown.

ComfyTV will humanize the filename for the combo label (`my-workflow` → "My Workflow"), register the workflow under the folder's kind, and auto-detect a `SaveImage` / `SaveVideo` / `PreviewImage` node as the result endpoint.

---

## Wiring stage inputs

Once the workflow is in, you usually need to tell ComfyTV which node receives the stage's prompt, which `LoadImage` takes the upstream image, where the seed comes from, etc.

**Use the sidebar**: click a stage on the canvas, fill in each widget in the **ComfyTV** sidebar on the left. Changes apply immediately, no restart. See [sidebar-config-editor.md](sidebar-config-editor.md) for the editor UI.

**To share with someone else**: the sidebar has an **⇩ Export preset.json** button at the bottom. It packages the current bindings as `<name>_preset.json`. Ship that alongside the workflow JSON; on the recipient's first load the bindings apply automatically.

> You usually **don't write `_preset.json` by hand** — configure in the sidebar, export to share. If you want the raw JSON shape, look at the shipped examples: `workflows/inpaint/flux-fill-inpaint_preset.json`, `workflows/video/local-ltx-2.3-t2v_preset.json`.

---

## Updating after re-export

When you re-export the workflow from ComfyUI (bumped a model version, added a step), **just overwrite `workflows/<kind>/<name>.json`**. ComfyTV detects the file modification time has changed; the next time a stage uses this workflow it re-reads the file.

Bindings keep working as long as the node IDs they reference still exist. If you renamed or removed a node, the runner errors:

> `inputs references missing workflow node "X" — did the API workflow get re-exported with different node ids?`

Open the sidebar and update the binding to point at the new ID.
