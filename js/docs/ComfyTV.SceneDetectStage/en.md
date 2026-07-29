# Scene Detect

> Find the cuts in a video and split it into per-shot thumbnails or ready-to-use clips.

## What this node does

**Scene Detect** analyzes a `COMFYTV_VIDEO`, finds scene-change points, and gives you back either one thumbnail per shot or one trimmed clip per shot. You set a detection threshold and minimum gap, choose the **output** mode, then press **▶ Run** (an ffmpeg/analysis pass on the server). The card shows the detected thumbnails, and in **clips** mode a scrollable pool of clips you can click to pick one.

In **clips** mode the node also emits a picked clip based on **selected_index**, and its clip results are cached (up to 8 recent settings) so re-picking a different clip is fast. If no cuts are found it errors and asks you to lower the threshold.

## When to use it

- Break a long take or screen recording into individual shots.
- Pull one representative frame per scene for a storyboard or contact sheet.
- Auto-split footage into clips and pick the one you want to keep editing.

## Parameters

### threshold
Cut-detection sensitivity, 0.05–1.0, default 0.4. Lower = more sensitive (finds more cuts); raise it if it splits too eagerly.

### min_gap_s
Minimum seconds between two detected cuts, 0–30, default 1.0. Prevents rapid double-cuts on flicker or fast motion.

### output
`frames` (default) returns a thumbnail per shot; `clips` returns a trimmed clip per shot (and enables clip picking).

### cut_mode
Only used in **clips** mode: `fast` (default) or `precise`. `fast` cuts on keyframes (quicker); `precise` re-encodes for exact boundaries.

### selected_index
1-based index of the clip to emit on the **clips** output in **clips** mode. Also driven by clicking a clip in the card. Clamped to the number of clips.

## Inputs and outputs

| Slot | Type | Meaning |
|---|---|---|
| **video** (in) | `COMFYTV_VIDEO` | Clip to analyze (required) |
| **images** (out) | `COMFYTV_IMAGES` | One thumbnail per shot (first frame + each cut point) |
| **clips** (out) | `COMFYTV_VIDEO` | The picked per-shot clip (clips mode) |

## Tips

- Start at threshold 0.4; if a hard cut is missed, lower it; if a pan/zoom triggers false cuts, raise `min_gap_s`.
- Use `fast` cut mode for quick review; switch to `precise` only when frame-exact clip boundaries matter.
- Clip results are cached per (source, threshold, gap, cut_mode) — clicking through different clips does not re-run detection.

## Types and bridges

`COMFYTV_VIDEO` / `COMFYTV_IMAGES` are ComfyTV project snapshots, not native ComfyUI types. Use a **Bridge** (`ComfyTV/Bridge`) to interoperate with native nodes. See [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## Related nodes

- **Contact Sheet** — arrange sampled frames into a single grid image.
- **Video Scopes** — inspect a single frame's waveform/vectorscope.
