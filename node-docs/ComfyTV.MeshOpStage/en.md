# Mesh Ops

> One node, many mesh operations — decimate, remesh, weld, fill holes, smooth normals, subdivide, UV-unwrap, or export — chosen from a dropdown, with its own parameters shown on the card.

## What this node does

Mesh Ops takes an upstream `COMFYTV_MODEL` and runs one geometry operation on it, returning a new model. Pick the `operation` and the card reveals only that operation's parameters; the rest stay hidden. It runs the vendored mesh3d backend (▶ Run), so heavy operations like remesh or unwrap take a moment.

You must wire a model into the `model` input — the stage errors if it's empty. The card also carries a 3D preview whose snapshot becomes the `image` output. When you run `unwrap`, the UV atlas preview replaces that snapshot so you can inspect the layout.

The eight operations:

- **decimate** — reduce face count via QEM edge collapse.
- **remesh** — rebuild the surface on a voxel grid (repairs messy/non-manifold input).
- **weld** — merge coincident vertices within a tolerance.
- **fill_holes** — close small open boundaries.
- **smooth_normals** — recompute shading normals with a crease threshold.
- **subdivide** — split every triangle into four, optionally smoothed.
- **unwrap** — generate a UV atlas (produces a UV preview image).
- **export** — re-encode the mesh to glb / obj / stl.

Outputs are ComfyTV snapshots, not native tensors — insert a **Bridge** to feed native ComfyUI nodes ([bridges docs](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)).

## When to use it

- Bring a dense mesh under a face budget (**decimate**) before shipping or baking.
- Clean up scanned / booleaned / imported geometry that has holes, doubles, or non-manifold edges (**remesh**, **weld**, **fill_holes**).
- Prepare a model for texturing by generating UVs (**unwrap**), then bake onto it with **Mesh Bake Maps**.
- Add or smooth detail (**subdivide**, **smooth_normals**), or convert formats (**export**).

## Parameters

Which parameters apply depends on `operation`.

### operation
The operation to run: `decimate`, `remesh`, `weld`, `fill_holes`, `smooth_normals`, `subdivide`, `unwrap`, `export` (default `decimate`). The card shows only the selected operation's controls.

### decimate parameters

- **target_face_count** — target maximum face count via QEM edge collapse. Default `50000`, range `100`–`5000000`.
- **placement_mode** — `midpoint` (robust, preserves thin features) or `qem` (QEM-optimal placement, sharper hard surfaces). Default `midpoint`.
- **feature_edge_quadric_weight** — extra quadric weight on dihedral feature edges (qem mode). Default `0.0` (off), up to `1000.0`.
- **feature_edge_min_dihedral_deg** — minimum dihedral angle (°) for an edge to count as a feature. Default `30.0`, range `0`–`180`.

### remesh parameters

- **resolution** — voxel grid resolution. Default `256` (≈100k faces; 512 ≈ 1M), range `32`–`1024`.
- **sign_mode** — `udf` (robust to messy input) or `sdf` (clean single surface). Default `udf`.
- **project_back** — lerp the rebuilt vertices back toward the original surface. Default `0.0`, range `0`–`1`.
- **smooth_iters** — Taubin smoothing iterations. Default `0`, up to `20`. (Also used by **subdivide**.)

### weld parameters

- **epsilon_rel** — merge tolerance as a fraction of the bounding-box diagonal. Default `1e-5`, up to `0.01`.

### fill_holes parameters

- **max_perimeter** — largest hole perimeter to fill, in mesh units. Default `0.03`, up to `10.0`.
- **max_verts** — cap on boundary vertices per hole. Default `16`, range `3`–`1024`.

### smooth_normals parameters

- **crease_angle** — edges sharper than this stay hard. Default `180.0` (fully smooth), range `0`–`180`.

### subdivide parameters

- **iterations** — each iteration splits every triangle into four. Default `1`, range `1`–`4`.
- **smooth_iters** — Taubin smoothing after subdividing (shared with remesh). Default `0`.

### unwrap parameters

- **segmenter** — `pec` (fast GPU chart segmentation) or `adaptive` (CPU). Default `pec`.
- **atlas_resolution** — target atlas resolution for texel-density auto-scale. Default `1024`, range `256`–`8192` (step 256).
- **padding** — texel padding between charts. Default `1`, range `0`–`16`.

### export parameters

- **format** — `glb` (keeps everything), `obj` (keeps UVs/normals/colors), or `stl` (bare triangles). Default `glb`.

### model
The `COMFYTV_MODEL` to operate on (optional socket, but required at run time — the stage errors without it).

### captured_image
Internal (hidden). The 3D preview snapshot URL that becomes the `image` output. For `unwrap`, the UV atlas preview is used instead.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **model** | `COMFYTV_MODEL` | The processed mesh (GLB) |
| **image** | `COMFYTV_IMAGE` | Preview snapshot, or the UV atlas after `unwrap` |

## Tips

- Typical low-poly pipeline: primitive/import → **remesh** or **weld** to clean → **decimate** to a budget → **unwrap** → **Mesh Bake Maps** (feed the pre-decimation mesh as high-poly).
- `remesh` with `sdf` wants a watertight input; use `udf` for open or messy meshes. Turn up `resolution` for a sharper result, then decimate to the exact count you need.
- After **Mesh Boolean**, run **decimate** to trim the extra faces the SDF cut produced.

## Related nodes

- **Mesh Primitive** — generate a clean base mesh to feed in.
- **Mesh Boolean** — CSG combine before or after cleanup ops.
- **Mesh Bake Maps** — bake normal/AO after unwrapping and decimating.
- **Line Art** — render the processed mesh to line art.
