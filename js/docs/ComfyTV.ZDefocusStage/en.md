# Z Defocus

> Depth-based defocus — blur your footage by distance using a depth map, so foreground or background goes soft with real bokeh discs.

## What this node does

This node uses a **depth map** to blur each part of the frame according to how far it is from a chosen focus distance, producing true depth-of-field with shaped bokeh rather than a flat blur. Pixels near the focus depth stay sharp; pixels far from it blur, more so the farther they are. Highlights can be boosted so bright points bloom into bokeh shapes.

It requires a depth map — wire either a `depth_image` or a `depth_video` (for example from a Depth Anything workflow). If neither is connected it raises an error. It has a ▶ Run (the defocus is computed on the backend). The main input and output are `COMFYTV_VIDEO`. To interoperate with native ComfyUI nodes, insert a **Bridge** — see the [bridge note](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## When to use it

- Add cinematic shallow depth of field to flat/deep-focus footage.
- Rack focus a shot in post by animating the focus depth.
- Turn bright background points into stylized bokeh discs or hexagons.

## Parameters

### focus_depth
The depth value that stays in focus, 0.0 to 1.0 (default 0.5), where 0 and 1 are the near/far ends of the depth map. Set this to whatever depth your subject sits at.

### focus_range
How wide the in-focus band is around `focus_depth`, 0.0 to 1.0 (default 0.15). Wider keeps more of the scene sharp; narrower makes the falloff to blur more aggressive.

### max_radius
Maximum blur radius in pixels for the most-out-of-focus areas, integer 1 to 48 (default 16). Higher = stronger, softer background blur (and slower).

### layers
Number of depth slices used to build the effect, integer 3 to 12 (default 8). More layers = smoother transitions between focus and blur, at higher cost.

### shape
Bokeh aperture shape: `disc` (round) or `hex` (six-sided). Default `disc`. `hex` mimics a bladed aperture.

### highlight_boost
Extra brightness pushed into highlights before blurring, 0.0 to 3.0 (default 0.0). Raise it to make bright points bloom into visible bokeh shapes.

### invert_depth
Boolean (default off). Flip the meaning of the depth map if near/far are reversed relative to what the effect expects.

### depth_image / depth_video
The depth map source — one is required. `depth_image` is a single `COMFYTV_IMAGE` depth frame; `depth_video` is a `COMFYTV_VIDEO` depth sequence (use this when depth changes over time). If both are present, the video is used.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | The defocused clip |

## Tips

- The result is only as good as the depth map — a clean, temporally stable depth video avoids flickering blur.
- If foreground and background blur are swapped from what you want, toggle `invert_depth`.
- Push `highlight_boost` when the shot has bright specular points or lights you want to bloom into bokeh.
- Higher `max_radius` and `layers` look better but run slower; tune down for previews.

## Related nodes

- A depth-estimation workflow (e.g. Depth Anything) upstream to produce the depth map.
- **Card 3D** — another way to add depth/perspective, by transforming the frame in 3D.
