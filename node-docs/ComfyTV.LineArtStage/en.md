# Line Art

> Render a 3D model to clean line art — silhouettes, creases, and open borders, with hidden-line removal — ready as a ControlNet lineart image.

## What this node does

Line Art renders a `COMFYTV_MODEL` into a 2D line drawing instead of a shaded image. It traces the mesh's feature edges — the silhouette (where the surface turns away from camera), creases (sharp dihedral edges), and boundary (open-mesh borders) — and can hide the lines that fall behind the surface using a BVH ray test, so you get a true visible-line drawing rather than a see-through wireframe.

You aim it with the on-card view camera (or leave it empty to auto-frame the model). It runs the vendored mesh3d backend (▶ Run) and outputs a single `COMFYTV_IMAGE` — the line-art render. This node has **no model output**; it is a render, not a geometry op.

Requires a model on the `model` input — the stage errors if it's empty. By default it produces white lines on black, the convention ControlNet lineart expects.

Outputs are ComfyTV snapshots, not native tensors — insert a **Bridge** to feed native ComfyUI nodes ([bridges docs](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)).

## When to use it

- Generate a ControlNet lineart map from a 3D model to drive an image workflow with exact shape control.
- Produce a technical / blueprint-style line drawing of a mesh.
- Get an inked outline of a model for a comic or storyboard panel.

## Parameters

### width / height
Output resolution in pixels. Both default `1024`, range `256`–`4096` (step 64).

### thickness
Line width in output pixels. Default `2.0`, range `0.5`–`8.0` (step 0.5).

### silhouette
Draw silhouette edges — where the surface turns away from the camera. Default `on`.

### crease
Draw crease edges — sharp edges whose dihedral angle exceeds `crease_angle`. Default `on`.

### boundary
Draw boundary edges — the border edges of an open mesh. Default `on`.

### crease_angle
The angle (°) between adjacent face normals above which an edge counts as a crease. Default `60.0`, range `1`–`179`. Lower it to catch softer edges, raise it to keep only very sharp ones.

### occlusion
Hide lines that fall behind the surface, via a BVH ray test. Default `on`. Turn it off for a wireframe-style see-through drawing where back edges show through.

### invert
`off` (default) = white lines on black, the ControlNet lineart convention. `on` = black lines on white (ink-on-paper look).

### camera
Internal (hidden). The view camera (position / target / fov JSON) set by the node body. Empty = the model is auto-framed.

### model
The `COMFYTV_MODEL` to render. Required — the stage errors without it.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **image** | `COMFYTV_IMAGE` | The line-art render |

## Tips

- For ControlNet lineart, leave `invert` off (white on black); flip it on only when you want a printable ink look.
- If the drawing is cluttered with interior lines, keep `occlusion` on and raise `crease_angle` so only genuinely sharp edges are inked.
- Boundary lines only appear on open meshes; a watertight solid draws its outline from silhouette and crease edges.
- Set the view with the on-card camera before running — an auto-frame may not pick the angle you want.

## Related nodes

- **Mesh Primitive** / **Mesh Ops** / **Mesh Boolean** — build and clean the model you render.
- **Bridge** — pass the lineart image to a native ComfyUI ControlNet node.
