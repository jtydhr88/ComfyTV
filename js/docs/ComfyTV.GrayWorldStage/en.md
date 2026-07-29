# Auto White Balance

> One-click neutral color — removes a color cast automatically using the gray-world assumption.

## What this node does

**Auto White Balance** corrects a clip's color cast with no controls at all. It uses the classic **gray-world** algorithm: assume the average color of a scene should be neutral gray, then scale the channels so that holds. Feed in footage that's too orange, too blue, or off-white and it pulls the whole frame back toward neutral.

It takes `COMFYTV_VIDEO` in and out and renders through ffmpeg's `grayworld` filter, so it has a **▶ Run** with a live preview on the card. There are no parameters — it always runs the balance when you Run it.

To send the corrected clip into native ComfyUI nodes, add a **Bridge** (see the [Bridge guide](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)).

## When to use it

- Quickly fix a wrong white balance without dialing in a temperature
- Neutralize a mixed-lighting cast as a starting point
- Batch-normalize clips before a consistent creative grade

## Parameters

This node has no adjustable parameters — it applies gray-world white balance directly on Run.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | The white-balanced clip snapshot |

## Tips

- Gray-world assumes the average scene is neutral, so shots dominated by one strong color (a red sunset, a green field) can over-correct — check the result and fall back to **Video Color**'s manual temperature if it looks off.
- Use it as a first pass, then do creative grading (temperature, wheels, LUT) on top.

## Related nodes

- **Video Color** — manual white balance via temperature when gray-world guesses wrong
- **Histogram Equalize** — the other automatic one-knob corrector (contrast)
- **CDL Grade** — a portable numeric primary grade
