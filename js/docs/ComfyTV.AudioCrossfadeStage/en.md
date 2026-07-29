# Audio Crossfade

> Blend the tail of one clip into the head of the next so cuts don't sound abrupt.

## What this node does

**Audio Crossfade** joins two audio sources (A then B) with an overlapping fade: A fades out while B fades in over a set **duration**, giving a smooth transition instead of a hard cut. It is the audio equivalent of a dissolve between two shots.

Each side accepts a `COMFYTV_AUDIO` snapshot, or a `COMFYTV_VIDEO` whose audio track is used (audio input takes priority when both are wired). It outputs a single `COMFYTV_AUDIO` snapshot and has a ▶ **Run** (FFmpeg does the blend).

To feed native ComfyUI `AUDIO` in or out, insert a **Bridge** — see [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## When to use it

- Stitch two takes or songs together without a jarring seam.
- Crossfade a music bed into the next section for a DJ-style transition.
- Smooth over an edit point between two dialogue recordings.

## Parameters

### duration
Length of the fade, in seconds. Range **0.01 to 60**, default **1.0**. Longer gives a more gradual blend.

### curve1 / curve2
Fade shape for the out-fade of A (`curve1`) and the in-fade of B (`curve2`). Default **`tri`** (linear triangular). Options are the FFmpeg `afade` curves: `tri`, `qsin`, `hsin`, `esin`, `log`, `ipar`, `qua`, `cub`, `squ`, `cbr`, `par`, `exp`, `iqsin`, `ihsin`, `dese`, `desi`, `losi`, `sinc`, `isinc`, `nofade`. `qsin`/`hsin` sound more natural on music; `tri` is a safe default.

### overlap
When **on** (default), the two clips overlap during the fade (a true crossfade), so total length is roughly A + B − duration. When **off**, A fades out and B fades in back-to-back without overlap.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **audio** | `COMFYTV_AUDIO` | The two clips joined with the crossfade |

## Tips

- Keep **duration** shorter than either clip — you can't overlap more audio than exists.
- For music, try `qsin` or `hsin` on both curves; the linear `tri` can dip in perceived loudness at the midpoint.

## Related nodes

- **Audio Mix** — layer up to four tracks at once with gain and pan, rather than joining two in sequence.
- **Audio Split Export** — the inverse: cut one track into multiple segments.
