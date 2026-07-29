# Glitch FX

> Datamosh-style digital glitch — block shifts and RGB channel splits, in one ▶ Run.

## What this node does

**Glitch FX** damages a `COMFYTV_VIDEO` clip on purpose with horizontal block displacement and chromatic (RGB) channel offsets, then writes a new snapshot on **▶ Run**. The corruption is randomized per frame from a **seed**, so the result is repeatable.

In and out are both `COMFYTV_VIDEO`. To feed native ComfyUI nodes, insert a **Bridge** — see the [bridge guide](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## When to use it

- Fake a corrupted-signal / broken-transmission look for a transition or accent.
- Add VHS/datamosh grunge to a music-video or title card.
- Punch up a beat drop with an occasional torn-frame flash (low **chance**).

## Parameters

### chance
Probability that a given frame gets glitched, `0.0`–`1.0`, default `0.5`. At `0` the node passes the clip through untouched (identity). Lower for rare, punctuated glitches; `1.0` glitches every frame.

### block_h
Glitch block height as a fraction of the frame, `0.01`–`1.0`, default `0.2`. Smaller = thin torn slivers; larger = big displaced bands.

### shift
Horizontal displacement amount, `0.01`–`1.0`, default `0.2`. How far glitched blocks slide sideways.

### color_intensity
RGB channel-split strength, `0`–`4`, default `3`. `0` = no chromatic separation; higher pulls the red/green/blue channels further apart.

### seed
Random seed, `0`–`99999`, default `7`. Same seed = same glitch pattern; change it to reroll.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | The glitched clip as a new project snapshot |

## Tips

- Set **chance** to `0` to A/B against the untouched clip without unwiring.
- Keep **chance** low and **shift** high for sparse but violent hits; keep **chance** high and **shift** low for a constant shimmer.

## Related nodes

- **Strobe** — flash/hold frames on an interval for a different kind of jolt.
- **Art FX** — stylized looks instead of digital damage.
