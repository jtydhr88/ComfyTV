# FX Chain

> Bake a whole chain of upstream FX stages into the video in a single transcode pass, and set the delivery format.

## What this node does

**FX Chain** is the "render" node at the end of a video FX chain. The FX stages you wire along the video wire don't each re-encode — they pass an `fx_spec` down the wire. FX Chain unpacks that chain and applies every effect in one ffmpeg transcode, then encodes to your chosen delivery settings. Press **▶ Run** to render; the output is a new `COMFYTV_VIDEO`.

The card lists the FX in the chain in order (with per-row previews where available), so you can see exactly what will be baked. FX Chain needs an upstream video *and* at least one FX stage in the chain; running with an empty chain or no video errors.

## When to use it

- Finalize a stack of FX stages (color, blur, keying, etc.) into one output without intermediate re-encodes.
- Set the final delivery resolution, frame rate, codec and quality for export.
- Produce a single clean master from a chain you've been previewing live.

## Parameters

### out_colorspace
Output color space: `bt709` (default), `bt601-6-625`, `bt2020`, `smpte170m`.

### out_size
Delivery short-side resolution: `source` (default, keep original), `2160`, `1440`, `1080`, `720`, `540`, `480`.

### out_fps
Delivery frame rate: `source` (default), `24`, `25`, `30`, `50`, `60`.

### out_codec
Output codec: `h264` (default), `hevc`, `prores`.

### out_quality
Encode quality: `draft`, `standard` (default), `high`.

## Inputs and outputs

| Slot | Type | Meaning |
|---|---|---|
| **video** (in) | `COMFYTV_VIDEO` | Upstream video carrying the FX chain (`fx_spec`) |
| **video** (out) | `COMFYTV_VIDEO` | The baked, delivered clip |

## Tips

- Keep FX Chain last on the video wire — everything upstream is a spec, and this node is where it actually renders.
- One pass means better quality and speed than re-encoding at each FX stage; the trade-off is you don't get an intermediate file between effects.
- Use `source` size/fps to preserve the original; only downscale or change frame rate here for the final deliverable.
- `prores` is for editorial/mezzanine delivery; `h264`/`hevc` for distribution.

## Types and bridges

`COMFYTV_VIDEO` is a ComfyTV project snapshot, not a native ComfyUI `VIDEO`. Use a **Bridge** (`ComfyTV/Bridge`) to interoperate with native nodes. See [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## Related nodes

- Any ComfyTV **VideoFX** stage — these build the chain that FX Chain bakes.
- **Expression** — drive an FX parameter with a per-frame expression.
