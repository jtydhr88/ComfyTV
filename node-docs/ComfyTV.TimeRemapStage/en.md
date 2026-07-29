# Time Remap

> Variable-speed retiming and freeze-frames — ramp a clip from slow-mo to fast, or hold on a single frame.

## What this node does

Time Remap changes the *timing* of a single `COMFYTV_VIDEO`, not just its constant speed. In **speed** mode you author speed keyframes (speed multiplier over output time) so the clip can ramp between slow motion and fast motion. In **hold** mode it freezes on a chosen frame, optionally advancing by a small increment each output frame for a stutter/step effect.

It runs on **▶ Run**. Input and output are `COMFYTV_VIDEO`. In `speed` mode the node errors if no speed keyframes are set — for a plain constant speed, use Video Speed instead.

To hand the result to a native ComfyUI node, insert a **Bridge** (`ComfyTV/Bridge`). See <https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md>.

## When to use it

- Speed-ramp a shot: ease into slow motion, then whip back to full speed.
- Hold a freeze-frame on a key moment.
- Create a stepped / stutter look by holding with a small increment.

## Parameters

### mode
`speed` (variable-speed retime from keyframes) or `hold` (freeze on a frame). Default `speed`.

### speed_keys
`speed` mode only. JSON array `[{t (output s), v (speed ×), interp}]` — the speed multiplier over output time. Authored via the node's curve UI. Required in `speed` mode.

### smooth_fps
`speed` mode only. Integer `0`–`120`, default `0`. `0` = off; a value above 0 pre-interpolates the source to that fps before retiming, for smoother slow motion (slower to render).

### hold_frame
`hold` mode only. Integer `0`–`100000`, default `0`. The source frame index to freeze on.

### hold_increment
`hold` mode only. Integer `0`–`1000`, default `0`. How many source frames to advance per output frame; `0` is a true freeze, small values give a stepped/stutter motion.

### video (input, optional)
The `COMFYTV_VIDEO` to retime. Required.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | The retimed (or held) clip. |

## Tips

- For a single fixed speed (e.g. always 2×), reach for Video Speed — Time Remap is specifically for *varying* speed and will error without keyframes.
- `smooth_fps` helps very slow ramps look fluid, but it interpolates the source first and is noticeably slower; leave it at 0 unless you see judder.

## Related nodes

- **Sequence** — assemble retimed clips into an edit.
- **Video Transition** / **Luma Wipe** — blend between two clips over time.
