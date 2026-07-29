# Mask Cleanup (ComfyTV)

> Removes stray specks and fills pinholes in a mask so downstream cutouts, keys, and inpaints have clean, solid edges.

## What this node does

Mask Cleanup takes a native ComfyUI `MASK` and tidies it up: it deletes tiny disconnected islands (little white blobs floating away from your subject) and fills small holes (little black pinholes inside a solid area). It keeps the largest region intact and only removes/fills things that are smaller than a size threshold you set.

This is a plain, instant CPU operation (it uses `scipy` connected-component labeling) — there is no ▶ Run or GPU pass. Because it works on the native ComfyUI `MASK` type, it usually sits between a mask-producing node (a matte, a segmentation, a threshold) and a mask-consuming node, often reached through a **Bridge** ([bridges docs](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)).

## When to use it

- After chroma keying or background removal, when the alpha has confetti-like specks around the edges.
- After a segmentation/matte model that leaves pinholes inside a solid subject.
- Before inpainting or compositing, when you want one clean blob instead of a noisy binary mask.

## Parameters

### min_region_frac
Float, default `0.01`, range `0.0`–`0.2`, step `0.001`. Islands and holes smaller than this fraction of the mask's **largest** region are removed (islands) or filled (holes). At `0.01`, anything under 1% of the main blob's area is cleaned up. Raise it to be more aggressive (remove larger stray bits); lower it to touch only the tiniest noise. There is an absolute floor of **64 px**, so very small regions are always eligible for cleanup even at `0.0`. The largest region is never removed, and holes that touch the image border are left open (they are treated as background, not enclosed holes).

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **mask** | `MASK` | The cleaned mask, same size and batch as the input |

## Tips

- The mask is thresholded at 0.5 internally, so the output is effectively binary (hard 0/1) — soft/feathered gradients are not preserved. Feather or blur *after* cleanup if you need soft edges.
- If `scipy` is not installed, the node logs a warning and passes the mask through unchanged.
- Border-touching black regions are intentionally kept open, so a hole that opens onto the edge of the frame will not be filled.

## Related nodes

- **Cutout** — produces a subject cutout whose alpha you may want to clean first.
- **Bridge (to/from Mask)** — convert between ComfyTV media and the native `MASK` this node consumes.
