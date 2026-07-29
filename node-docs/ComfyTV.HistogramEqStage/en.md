# Histogram Equalize

> Redistribute tones to expand contrast in flat footage — with a strength dial and optional CLAHE-style clipping to tame noise.

## What this node does

**Histogram Equalize** spreads a clip's tonal values more evenly across the range, pulling detail out of flat, low-contrast, or hazy footage. Classic histogram equalization can look harsh, so this node adds a **strength** blend (mix between original and fully equalized) and a **clip_limit** that caps how much any single tone can be stretched — the idea behind CLAHE — to keep noise and skies from blowing out.

It takes `COMFYTV_VIDEO` in and out and renders on a torch backend (`histeq`), so it has a **▶ Run** with a live preview on the card. With strength at 0 the clip passes through unchanged.

To interoperate with native ComfyUI nodes, add a **Bridge** (see the [Bridge guide](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)).

## When to use it

- Rescue flat, low-contrast, or foggy shots
- Bring out shadow/highlight detail before further grading
- Boost local contrast in a controlled way (with clip_limit)

## Parameters

### strength
How far to push equalization, default 0.5, range 0.0…1.0. It's a blend: 0.0 is the untouched clip (the node becomes a pass-through), 1.0 is full equalization. Start around 0.4–0.6 and back off if it looks harsh.

### clip_limit
Caps the fraction any single histogram bin can hold, default 0.0, range 0.0…0.1 (step 0.005). `0` means off (plain equalization). Small positive values (this is the CLAHE-style contrast limit) prevent over-amplifying noise in flat regions like skies. Raise it gently if equalization is amplifying grain.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | The contrast-equalized clip snapshot |

## Tips

- At strength 0 the node does nothing — turn it up to see any effect.
- If equalizing makes noise or banding worse, add a little `clip_limit` rather than lowering strength all the way.
- This maximizes contrast rather than matching a look — follow it with **Video Color** or a **Video LUT** for the final grade.

## Related nodes

- **Auto White Balance** — the other one-knob automatic corrector (neutral color)
- **Video Color** — manual exposure, levels, and grading
- **Video Curves** — hand-shaped contrast when you want precise control
