# Extract Frames

> Grab still frames from a clip at timestamps you mark, and get them back as an image batch.

## What this node does

**Extract Frames** pulls one or more still frames out of a clip at the timestamps you set with
the marker strip in the node body. On **▶ Run** the server (PyAV / ffmpeg) decodes those frames
and returns them as a `COMFYTV_IMAGES` batch saved as a project snapshot. Input is
`COMFYTV_VIDEO`.

The marker strip drives a hidden **marks** field (a JSON list of seconds) — you don't type the
list by hand. You need at least one mark, and the backend caps the batch (up to a few dozen
frames per run).

## When to use it

- Pull key stills from a clip to use as reference or thumbnails.
- Grab a first/last/middle frame to seed an image-generation or edit step.
- Sample several moments from a shot to compare composition.

## Parameters

### marks (hidden)
A JSON list of timestamps in seconds, one per frame to extract. Driven by the marker strip in
the node body — add marks on the clip preview rather than editing text. Duplicate and negative
times are cleaned up; if no valid marks are set, the run errors out.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **images** | `COMFYTV_IMAGES` | The extracted frames as an image batch, saved as a snapshot. |

## Tips

- This is the multi-frame tool; for a single frame with first/last/middle presets, use
  **Extract Frame** instead.
- There is an upper limit on how many frames one run extracts — mark the moments you actually
  need rather than sampling densely.

## Bridge note

`COMFYTV_VIDEO` and `COMFYTV_IMAGES` are project snapshot references, not native ComfyUI
tensors. To move between ComfyTV and native ComfyUI nodes, insert a **Bridge**
(`ComfyTV/Bridge`). See <https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md>.

## Related nodes

- **Extract Frame** — grab a single frame (first / last / middle / custom time).
- **Image Picker** — choose one image from the extracted batch.
