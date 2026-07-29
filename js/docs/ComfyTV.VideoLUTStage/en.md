# Video LUT

> Apply a finished color look to a clip from a `.cube` 3D LUT in your library.

## What this node does

**Video LUT** runs your clip through a 3D lookup table — the industry-standard way to ship a fixed "look" (a film emulation, a show LUT, a creative grade). Pick a LUT file from your ComfyTV LUT library and it's applied to every frame.

It takes `COMFYTV_VIDEO` in and out and renders through ffmpeg's `lut3d` filter. Because it re-encodes, it has a **▶ Run**. The chosen file is resolved against the LUT resource library by name; if the name isn't found the node raises an error rather than silently doing nothing. Leaving the file empty passes the clip through unchanged.

To send the graded clip into native ComfyUI nodes, add a **Bridge** (see the [Bridge guide](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)).

## When to use it

- Apply a consistent creative look across many shots
- Emulate a film stock or camera-to-Rec.709 transform
- Deliver a client's supplied show LUT
- Bake a finished grade into an output for review

## Parameters

### lut_file
The LUT file name to load from the ComfyTV LUT library (only the base file name is used). It must resolve to a real file in the library, otherwise the node errors out. Hald `.png` LUTs are **not** supported here — they need a second input; convert to `.cube` (or another `lut3d`-compatible format) instead, and the node will raise a clear error if you feed it a `.png`.

### interp
Interpolation method used to sample the 3D LUT between its grid points. Default `tetrahedral`. Options: `tetrahedral`, `trilinear`, `nearest`, `pyramid`, `prism`. `tetrahedral` is the usual high-quality default; `nearest` is fastest but blockiest.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | The clip with the LUT applied |

## Tips

- Manage LUTs from the ComfyTV resources/LUT library; this node only references files by name from there.
- If you get a "not found" error, confirm the exact file name exists in the LUT library.
- LUTs assume a specific input color space — a Rec.709 look LUT on log footage (or vice-versa) will look wrong. Match the LUT to your footage.

## Related nodes

- **Video Color** — build a primary grade before or instead of a LUT
- **Video Curves** — hand-shape tones when no LUT fits
- **CDL Grade** — a portable slope/offset/power grade that travels as numbers, not a table
