"""ComfyTV-facing geometry operations over MESH batches (ports of the pixal3d node execute bodies)."""

import copy
import logging

import numpy as np
import torch

import comfy.model_management
import comfy.utils

from .core import MESH, get_mesh_batch_item, pack_variable_mesh_batch
from .postprocess.qem_decimate import (
    QEMConfig, _compute_vertex_normals, qem_cluster_decimate, qem_decimate_simplify,
)
from .postprocess.remesh import remesh_narrow_band_dc
from .postprocess_ops import (
    _bake_ambient_occlusion,
    _bake_normal_map,
    _compute_vertex_face_normals,
    _normalize_uvs_to_unit,
    _pack_uv_meshes,
    _smooth_vertex_normals,
    _uv_render_atlas,
    _uv_unwrap,
    _vertex_tangents_for_item,
    fill_holes_v2_fn,
    weld_vertices_fn,
)


def mesh_stats(mesh: MESH) -> dict:
    """Real (unpadded) totals across the batch: {'vertices': int, 'faces': int}."""
    if mesh.vertex_counts is not None:
        return {'vertices': int(mesh.vertex_counts.sum().item()),
                'faces': int(mesh.face_counts.sum().item())}
    if isinstance(mesh.vertices, list):
        return {'vertices': sum(int(v.shape[0]) for v in mesh.vertices),
                'faces': sum(int(f.shape[0]) for f in mesh.faces)}
    v, f = mesh.vertices, mesh.faces
    if v.ndim == 2:
        return {'vertices': int(v.shape[0]), 'faces': int(f.shape[0])}
    return {'vertices': int(v.shape[0] * v.shape[1]), 'faces': int(f.shape[0] * f.shape[1])}


def _map_batch(mesh: MESH, per_item_fn) -> MESH:
    """Dispatch list/batched/single mesh, extract colors, stack results."""
    mesh = copy.deepcopy(mesh)

    def process_single(v, f, c, bar):
        v, f, c = per_item_fn(v, f, c)
        bar.update(1)
        return v, f, c

    is_list = isinstance(mesh.vertices, list)
    is_batched_tensor = not is_list and mesh.vertices.ndim == 3

    if is_list or is_batched_tensor:
        out_v, out_f, out_c = [], [], []
        bsz = len(mesh.vertices) if is_list else mesh.vertices.shape[0]
        bar = comfy.utils.ProgressBar(bsz)

        for i in range(bsz):
            v_i = mesh.vertices[i]
            f_i = mesh.faces[i]
            c_i = None
            if mesh.vertex_colors is not None:
                vc = mesh.vertex_colors
                c_i = vc[i] if (isinstance(vc, list) or vc.ndim == 3) else vc
            if not is_list and mesh.vertex_counts is not None:
                n_v = int(mesh.vertex_counts[i].item())
                n_f = int(mesh.face_counts[i].item())
                v_i, f_i = v_i[:n_v], f_i[:n_f]
                if c_i is not None:
                    c_i = c_i[:n_v]

            v_i, f_i, c_i = process_single(v_i, f_i, c_i, bar)

            out_v.append(v_i)
            out_f.append(f_i)
            if c_i is not None:
                out_c.append(c_i)

        return pack_variable_mesh_batch(
            out_v, out_f, colors=out_c if out_c else None,
            texture=mesh.texture, unlit=mesh.unlit,
            metallic_roughness=mesh.metallic_roughness,
            occlusion_in_mr=mesh.occlusion_in_mr,
            material=mesh.material, emissive=mesh.emissive)

    c = mesh.vertex_colors
    bar = comfy.utils.ProgressBar(1)
    v, f, c = process_single(mesh.vertices, mesh.faces, c, bar)
    mesh.vertices = v
    mesh.faces = f
    if c is not None:
        mesh.vertex_colors = c
    return mesh


def decimate(mesh: MESH, target_face_count: int, placement_mode: str = "midpoint",
             line_quadric_weight: float = 0.0, feature_edge_quadric_weight: float = 0.0,
             feature_edge_min_dihedral_deg: float = 30.0, clamp_v_to_edge: bool = True):
    """QEM simplification to a target face count."""
    if placement_mode == "qem":
        cfg = QEMConfig(
            placement_mode="qem",
            line_quadric_weight=float(line_quadric_weight),
            feature_edge_quadric_weight=float(feature_edge_quadric_weight),
            feature_edge_min_dihedral_deg=float(feature_edge_min_dihedral_deg),
            clamp_v_to_edge=bool(clamp_v_to_edge),
        )
    else:
        cfg = QEMConfig()  # midpoint defaults (cumesh-faithful)

    compute_device = comfy.model_management.get_torch_device()
    counts = {"in": 0, "out": 0}

    def _fn(v, f, c):
        counts["in"] += int(f.shape[0])
        if target_face_count > 0 and f.shape[0] > target_face_count:
            try:
                src_device = v.device
                rv, rf, rc, _rn, _rs = qem_decimate_simplify(
                    v.to(compute_device), f.to(compute_device), int(target_face_count),
                    colors=(c.to(compute_device) if c is not None else None),
                    config=cfg)
                v = rv.to(src_device)
                f = rf.to(src_device)
                if rc is not None:
                    c = rc.to(src_device)
            except Exception as e:
                comfy.model_management.raise_non_oom(e)  # surface real errors; only OOM passes through
                logging.warning(f"decimate: QEM simplify ran out of memory, passing mesh through unchanged: {e!r}")
        counts["out"] += int(f.shape[0])
        return v, f, c

    out = _map_batch(mesh, _fn)
    return out, {'faces_in': counts["in"], 'faces_out': counts["out"]}


def remesh(mesh: MESH, resolution: int = 512, sign_mode: str = "udf", qef=None,
           manifold: bool = False, drop_inverted_components: bool = False,
           drop_enclosed_components: bool = False, band: float = 1.0,
           project_back: float = 0.0, fix_poles: bool = False, smooth_iters: int = 0,
           drop_small_components: float = 0.01, precluster_max_verts: int = 8_000_000):
    """Narrow-band Dual Contouring re-extraction; qef=None follows per-mode defaults (udf: False, sdf: True)."""
    if qef is None:
        qef = (sign_mode == "sdf")

    compute_device = comfy.model_management.get_torch_device()
    counts = {"in": 0, "out": 0}

    def _fn(v, f, c):
        counts["in"] += int(f.shape[0])
        try:
            from .subdivide import split_long_edges
            src_device = v.device
            vv = v.to(compute_device).float()
            ff = f.to(compute_device).to(torch.int64)
            cc = c.to(compute_device).float() if c is not None else None

            bbox = float((vv.max(0)[0] - vv.min(0)[0]).max().item()) if vv.numel() else 0.0
            if bbox > 0:
                vv, ff, cc = split_long_edges(vv, ff, bbox / 16.0, colors=cc)

            # cluster-decimate very large inputs before field queries
            if precluster_max_verts > 0 and vv.shape[0] > precluster_max_verts:
                vv, ff, cc = qem_cluster_decimate(
                    vv, ff, target_verts=int(precluster_max_verts), colors=cc)

            # Fixed [-0.5,0.5] cube domain (matches cumesh/TRELLIS2); scale ~= 1.0 any resolution.
            rs_scale = (resolution + 3.0 * band) / resolution
            rs_center = torch.zeros(3, dtype=vv.dtype, device=compute_device)

            rv, rf, rc = remesh_narrow_band_dc(
                vv, ff,
                resolution=int(resolution),
                band=float(band), project_back=float(project_back),
                qef=bool(qef), sign_mode=sign_mode,
                manifold=bool(manifold), fix_poles=bool(fix_poles),
                smooth_iters=int(smooth_iters),
                drop_small_components=float(drop_small_components),
                drop_inverted_components=bool(drop_inverted_components),
                drop_enclosed_components=bool(drop_enclosed_components),
                scale=rs_scale, center=rs_center, colors=cc)

            v = rv.to(src_device)
            f = rf.to(src_device)
            c = rc.to(src_device) if rc is not None else None
        except Exception as e:
            comfy.model_management.raise_non_oom(e)  # surface real errors; only OOM passes through
            logging.warning(f"remesh: ran out of memory, passing mesh through unchanged: {e!r}")
        counts["out"] += int(f.shape[0])
        return v, f, c

    out = _map_batch(mesh, _fn)
    return out, {'faces_in': counts["in"], 'faces_out': counts["out"]}


def weld(mesh: MESH, epsilon_rel: float = 1e-5, epsilon_abs: float = 0.0):
    """Merge coincident vertices (L_inf grid quantization)."""
    eps = epsilon_abs if epsilon_abs > 0 else None
    welded = {"n": 0}

    def _fn(v, f, c):
        v, f, c, n = weld_vertices_fn(v, f, epsilon=eps, epsilon_rel=epsilon_rel, colors=c)
        welded["n"] += int(n)
        return v, f, c

    out = _map_batch(mesh, _fn)
    return out, {'welded': welded["n"]}


def fill_holes(mesh: MESH, max_perimeter: float = 0.03, weld_epsilon_rel: float = 1e-5,
               max_verts: int = 16, fill_chains: bool = False):
    """Fill boundary holes up to a max perimeter."""
    counts = {"in": 0, "out": 0}

    def _fn(v, f, c):
        counts["in"] += int(f.shape[0])
        if max_perimeter > 0:
            v, f, c = fill_holes_v2_fn(
                v, f, max_perimeter=max_perimeter, colors=c,
                weld_epsilon_rel=weld_epsilon_rel,
                fill_chains=fill_chains,
                max_verts=max_verts,
            )
        counts["out"] += int(f.shape[0])
        return v, f, c

    out = _map_batch(mesh, _fn)
    return out, {'faces_in': counts["in"], 'faces_out': counts["out"]}


def smooth_normals(mesh: MESH, crease_angle: float = 180.0) -> MESH:
    """Attach smooth per-vertex normals; crease_angle < 180 splits hard edges."""
    crease = None if crease_angle >= 180.0 else float(crease_angle)
    batch_size = mesh.vertices.shape[0]

    if crease is None:
        # Fully smooth: topology unchanged; attach normals matching the (possibly
        # zero-padded) vertex layout and keep every other field.
        normals_padded = torch.zeros_like(mesh.vertices)
        for i in range(batch_size):
            v_i, f_i, _, _, _ = get_mesh_batch_item(mesh, i)
            if v_i.shape[0] == 0 or f_i.shape[0] == 0:
                continue
            n_i = _smooth_vertex_normals(v_i.cpu().numpy().astype(np.float32),
                                         f_i.cpu().numpy().astype(np.int64))
            normals_padded[i, :n_i.shape[0]] = torch.from_numpy(n_i).to(mesh.vertices)
        out = copy.copy(mesh)
        out.normals = normals_padded
        return out

    # Crease split changes per-item vertex counts -> rebuild as a variable-size batch.
    tangents_b = mesh.tangents
    v_list, f_list, n_list = [], [], []
    c_list = [] if mesh.vertex_colors is not None else None
    u_list = [] if mesh.uvs is not None else None
    t_list = [] if tangents_b is not None else None
    for i in range(batch_size):
        v_i, f_i, c_i, u_i, _ = get_mesh_batch_item(mesh, i)
        if v_i.shape[0] == 0 or f_i.shape[0] == 0:
            continue
        dev = v_i.device
        vo, fo, no, remap = _compute_vertex_face_normals(
            v_i.cpu().numpy().astype(np.float32),
            f_i.cpu().numpy().astype(np.int64), crease)
        remap_t = torch.from_numpy(remap)
        v_list.append(torch.from_numpy(vo).to(dev, mesh.vertices.dtype))
        f_list.append(torch.from_numpy(fo.astype(np.int64)).to(dev, mesh.faces.dtype))
        n_list.append(torch.from_numpy(no).to(dev, mesh.vertices.dtype))
        if c_list is not None:
            c_list.append(c_i[remap_t.to(c_i.device)])
        if u_list is not None:
            u_list.append(u_i[remap_t.to(u_i.device)])
        if t_list is not None:
            # Remap (not recompute) so TANGENT keeps the baked basis; split verts copy theirs.
            t_i = tangents_b[i, :v_i.shape[0]]
            t_list.append(t_i[remap_t.to(t_i.device)])
    if not v_list:
        return mesh
    return pack_variable_mesh_batch(
        v_list, f_list, colors=c_list, uvs=u_list,
        texture=mesh.texture, unlit=mesh.unlit,
        normals=n_list, metallic_roughness=mesh.metallic_roughness,
        tangents=t_list, normal_map=mesh.normal_map,
        occlusion_in_mr=mesh.occlusion_in_mr,
        material=mesh.material, emissive=mesh.emissive)


def unwrap(mesh: MESH, segmenter: str = "pec", resolution: int = 1024,
           padding: int = 1, weld_distance: float = 0.0):
    """Generate a UV atlas (segment -> parameterize -> pack); seam verts are duplicated, normals dropped."""
    compute_device = comfy.model_management.get_torch_device()
    seg_device = compute_device if segmenter == "pec" else torch.device("cpu")

    is_list = isinstance(mesh.vertices, list)
    is_batched = not is_list and mesh.vertices.ndim == 3
    bsz = len(mesh.vertices) if is_list else (mesh.vertices.shape[0] if is_batched else 1)
    bar = comfy.utils.ProgressBar(bsz)

    out_v, out_f, out_uv, out_c = [], [], [], []
    for i in range(bsz):
        if is_list:
            vi, fi = mesh.vertices[i], mesh.faces[i]
            ci = None
            vc = mesh.vertex_colors
            if vc is not None:
                ci = vc[i] if (isinstance(vc, list) or vc.ndim == 3) else vc
        elif is_batched:
            vi, fi, ci, _, _ = get_mesh_batch_item(mesh, i)
        else:
            vi, fi = mesh.vertices, mesh.faces
            ci = mesh.vertex_colors

        src_device = vi.device
        vnp = vi.detach().cpu().numpy().astype(np.float32)
        extent = float(np.linalg.norm(vnp.max(0) - vnp.min(0))) if vnp.shape[0] else 0.0
        weld_abs = weld_distance * extent if weld_distance > 0.0 else 0.0

        vmapping, indices, uvs = _uv_unwrap(
            vi.to(seg_device).float(), fi.to(seg_device).long(),
            segmenter, int(resolution), int(padding), weld_abs)
        uvs = uvs.copy()
        uvs[:, 1] = 1.0 - uvs[:, 1]                       # UV y flipped vs trimesh

        out_v.append(torch.from_numpy(vnp[vmapping]).to(src_device))
        out_f.append(torch.from_numpy(indices).to(device=src_device, dtype=torch.long))
        out_uv.append(torch.from_numpy(uvs.astype(np.float32)).to(src_device))
        if ci is not None:
            cnp = ci.detach().cpu().numpy()
            out_c.append(torch.from_numpy(np.ascontiguousarray(cnp[vmapping])).to(src_device))
        bar.update(1)

    out_mesh = _pack_uv_meshes(out_v, out_f, out_uv, out_c if out_c else None)
    if mesh.texture is not None:
        out_mesh.texture = mesh.texture

    stats = {'vertices': int(out_v[0].shape[0]), 'faces': int(out_f[0].shape[0]),
             'atlas_resolution': int(resolution)}
    return out_mesh, stats


def apply_trs(verts: torch.Tensor, transform: dict) -> torch.Tensor:
    """Apply a three.js-convention TRS dict (position, quaternion xyzw, scale; M = T*R*S)."""
    s = transform.get('scale') or [1.0, 1.0, 1.0]
    q = transform.get('quaternion') or [0.0, 0.0, 0.0, 1.0]
    t = transform.get('position') or [0.0, 0.0, 0.0]
    v = verts.float() * verts.new_tensor(s)
    qn = np.array(q, dtype=np.float64)
    x, y, z, w = qn / max(float(np.linalg.norm(qn)), 1e-12)
    rot = verts.new_tensor([
        [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
        [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
        [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)],
    ])
    return v @ rot.T + verts.new_tensor(t)


def boolean(mesh_a: MESH, mesh_b: MESH, op: str = 'union', resolution: int = 256,
            smooth_iters: int = 0, drop_small_components: float = 0.0,
            transform_a: dict = None, transform_b: dict = None):
    """CSG of two meshes (batch item 0 each) via the SDF narrow-band DC route."""
    from .boolean import boolean_narrow_band_dc
    va, fa, ca, _, _ = get_mesh_batch_item(mesh_a, 0)
    vb, fb, cb, _, _ = get_mesh_batch_item(mesh_b, 0)
    if fa.numel() == 0 or fb.numel() == 0:
        raise ValueError("boolean: both inputs need triangles")
    if transform_a:
        va = apply_trs(va, transform_a)
    if transform_b:
        vb = apply_trs(vb, transform_b)
    dev = comfy.model_management.get_torch_device()
    v, f, c = boolean_narrow_band_dc(
        va.to(dev), fa.to(dev), vb.to(dev), fb.to(dev), op=op,
        resolution=int(resolution), smooth_iters=int(smooth_iters),
        drop_small_components=float(drop_small_components),
        colors_a=ca.to(dev) if ca is not None else None,
        colors_b=cb.to(dev) if cb is not None else None)
    if f.numel() == 0:
        raise RuntimeError(
            f"boolean: '{op}' produced an empty mesh — the inputs may not overlap "
            "(or windings are inconsistent)")
    out = pack_variable_mesh_batch(
        [v.cpu()], [f.cpu()],
        colors=[c.cpu()] if c is not None else None)
    stats = {'faces_in': int(fa.shape[0] + fb.shape[0]), 'faces_out': int(f.shape[0]), 'op': op}
    return out, stats


def subdivide(mesh: MESH, iterations: int = 1, smooth_iters: int = 0):
    """Midpoint 1-to-4 subdivision per batch item, carrying colors/UVs/texture."""
    from .subdivide import subdivide_midpoint
    B = int(mesh.vertices.shape[0]) if not isinstance(mesh.vertices, list) else len(mesh.vertices)
    counts = {"in": 0, "out": 0}
    v_list, f_list = [], []
    c_list = [] if mesh.vertex_colors is not None else None
    u_list = [] if mesh.uvs is not None else None
    for i in range(B):
        v_i, f_i, c_i, u_i, _ = get_mesh_batch_item(mesh, i)
        counts["in"] += int(f_i.shape[0])
        v_o, f_o, c_o, u_o = subdivide_midpoint(
            v_i, f_i, iterations=int(iterations), colors=c_i, uvs=u_i,
            smooth_iters=int(smooth_iters))
        counts["out"] += int(f_o.shape[0])
        v_list.append(v_o)
        f_list.append(f_o)
        if c_list is not None:
            c_list.append(c_o)
        if u_list is not None:
            u_list.append(u_o)
    out = pack_variable_mesh_batch(
        v_list, f_list, colors=c_list, uvs=u_list,
        texture=mesh.texture, unlit=mesh.unlit,
        metallic_roughness=mesh.metallic_roughness,
        occlusion_in_mr=mesh.occlusion_in_mr,
        material=mesh.material, emissive=mesh.emissive)
    return out, {'faces_in': counts["in"], 'faces_out': counts["out"]}


def bake_normal_map(low_mesh: MESH, high_mesh: MESH, resolution: int = 1024,
                    cage_distance: float = 0.05, ignore_backfaces: bool = True) -> torch.Tensor:
    """Bake a tangent-space normal map (glTF/OpenGL +Y) from high_mesh into low_mesh's UVs; (B, H, W, 3) in [0, 1]."""
    low_uvs = low_mesh.uvs
    if low_uvs is None:
        raise ValueError(
            "bake_normal_map: low mesh has no UVs — run UV unwrap first; this bakes "
            "onto existing UVs and never unwraps.")
    dev = comfy.model_management.get_torch_device()

    low_n_attr = low_mesh.normals
    high_n_attr = high_mesh.normals
    B = int(low_mesh.vertices.shape[0])
    h_batch = int(high_mesh.vertices.shape[0])

    imgs = []
    for i in range(B):
        v_i, f_i, *_ = get_mesh_batch_item(low_mesh, i)
        n = int(v_i.shape[0])
        if f_i.numel() == 0:
            logging.warning(f"bake_normal_map: skipping batch {i} (empty mesh)")
            imgs.append(torch.full((int(resolution), int(resolution), 3), 0.5))
            continue

        uv_i = low_uvs[i, :n] if low_uvs.ndim == 3 else low_uvs[:n]
        uv_np = _normalize_uvs_to_unit(uv_i.detach().cpu().numpy(), log_prefix="[bake_normal_map]  ")

        lv = v_i.to(dev).float()
        lf = f_i.to(dev).long()
        # Tangents build the per-texel TBN; apply_textures recomputes the same basis on export.
        n_attr_i = low_n_attr[i, :n] if low_n_attr is not None else None
        low_n, tangents = _vertex_tangents_for_item(lv, lf, torch.from_numpy(uv_np).to(dev), n_attr_i, dev)

        hv_i, hf_i, *_ = get_mesh_batch_item(high_mesh, i if h_batch > 1 else 0)
        hv = hv_i.to(dev).float()
        hf = hf_i.to(dev).long()
        high_n = (high_n_attr[i, :hv.shape[0]].to(dev).float() if high_n_attr is not None
                  else _compute_vertex_normals(hv, hf))

        img = _bake_normal_map(
            hv, hf, high_n,
            lv.detach().cpu().numpy(), lf.detach().cpu().numpy().astype(np.uint32), uv_np,
            low_n, tangents, resolution, cage_distance=float(cage_distance),
            ignore_backfaces=bool(ignore_backfaces),
        )
        imgs.append(torch.from_numpy(np.ascontiguousarray(img)).float())

    return torch.stack([t.clamp(0.0, 1.0) for t in imgs], dim=0)


def bake_ambient_occlusion(low_mesh: MESH, high_mesh: MESH, resolution: int = 1024,
                           samples: int = 64, max_distance: float = 0.5,
                           strength: float = 1.0, bias: float = 0.01) -> torch.Tensor:
    """Bake an AO map from high_mesh into low_mesh's UVs (white = open, dark = crevices); (B, H, W, 3) in [0, 1]."""
    low_uvs = low_mesh.uvs
    if low_uvs is None:
        raise ValueError(
            "bake_ambient_occlusion: low mesh has no UVs — run UV unwrap first; this "
            "bakes onto existing UVs and never unwraps.")
    dev = comfy.model_management.get_torch_device()
    low_n_attr = low_mesh.normals
    B = int(low_mesh.vertices.shape[0])
    h_batch = int(high_mesh.vertices.shape[0])

    pbar = comfy.utils.ProgressBar(max(1, B))   # one tick per batch item
    imgs = []
    for i in range(B):
        v_i, f_i, *_ = get_mesh_batch_item(low_mesh, i)
        n = int(v_i.shape[0])
        if f_i.numel() == 0:
            logging.warning(f"bake_ambient_occlusion: skipping batch {i} (empty mesh)")
            imgs.append(torch.ones((int(resolution), int(resolution), 3)))
            pbar.update(1)
            continue

        uv_i = low_uvs[i, :n] if low_uvs.ndim == 3 else low_uvs[:n]
        uv_np = _normalize_uvs_to_unit(uv_i.detach().cpu().numpy(), log_prefix="[bake_ambient_occlusion]  ")
        lv = v_i.to(dev).float()
        lf = f_i.to(dev).long()
        low_n = (low_n_attr[i, :n].to(dev).float() if low_n_attr is not None
                 else _compute_vertex_normals(lv, lf))

        hv_i, hf_i, *_ = get_mesh_batch_item(high_mesh, i if h_batch > 1 else 0)
        img = _bake_ambient_occlusion(
            hv_i.to(dev).float(), hf_i.to(dev).long(),
            lv.detach().cpu().numpy(), lf.detach().cpu().numpy().astype(np.uint32), uv_np,
            low_n, resolution, num_samples=int(samples),
            max_distance=float(max_distance), strength=float(strength), bias=float(bias),
        )
        imgs.append(torch.from_numpy(np.ascontiguousarray(img)).float())
        pbar.update(1)

    return torch.stack([t.clamp(0.0, 1.0) for t in imgs], dim=0)


def apply_textures(mesh: MESH, base_color: torch.Tensor | None = None,
                   metallic: torch.Tensor | None = None,
                   roughness: torch.Tensor | None = None,
                   occlusion: torch.Tensor | None = None,
                   normal_map: torch.Tensor | None = None) -> MESH:
    """Attach baked texture images (B, H, W, C) to the mesh's UV layout; base_color=None keeps the existing texture."""
    mesh_uvs = mesh.uvs
    if mesh_uvs is None:
        raise ValueError(
            "apply_textures: mesh has no UVs — run UV unwrap first (the same mesh the "
            "maps were baked for).")

    # Re-derive the exact UVs the bake used (shared _normalize_uvs_to_unit), per item.
    if mesh_uvs.ndim == 3:
        new_uvs = mesh_uvs.clone()
        for i in range(mesh_uvs.shape[0]):
            v_i, _f_i, *_ = get_mesh_batch_item(mesh, i)
            n = v_i.shape[0]
            norm = _normalize_uvs_to_unit(mesh_uvs[i, :n].detach().cpu().numpy())
            new_uvs[i, :n] = torch.from_numpy(norm).to(new_uvs)
    else:
        norm = _normalize_uvs_to_unit(mesh_uvs.detach().cpu().numpy())
        new_uvs = torch.from_numpy(norm).to(mesh_uvs)

    out_mesh = copy.copy(mesh)
    out_mesh.uvs = new_uvs
    if base_color is not None:
        out_mesh.texture = base_color.float().clamp(0.0, 1.0).cpu()
    if normal_map is not None:
        # Recompute tangents (shared helper, same normalized UVs -> same basis as the bake)
        # and export the smooth normals the TBN was built on — without a NORMAL attribute the
        # viewer shades flat and the tangent-space detail fights the faceting.
        dev = comfy.model_management.get_torch_device()
        low_n_attr = mesh.normals
        B = int(mesh.vertices.shape[0])
        Nmax = int(mesh.vertices.shape[1]) if mesh.vertices.ndim == 3 else int(mesh.vertices.shape[0])
        tangents_padded = torch.zeros((B, Nmax, 4), dtype=torch.float32)
        normals_padded = torch.zeros((B, Nmax, 3), dtype=torch.float32)
        for i in range(B):
            v_i, f_i, *_ = get_mesh_batch_item(mesh, i)
            n = int(v_i.shape[0])
            if f_i.numel() == 0:
                continue
            lv, lf = v_i.to(dev).float(), f_i.to(dev).long()
            uv_i = new_uvs[i, :n] if new_uvs.ndim == 3 else new_uvs[:n]
            n_attr_i = low_n_attr[i, :n] if low_n_attr is not None else None
            low_n, tangents = _vertex_tangents_for_item(lv, lf, uv_i, n_attr_i, dev)
            tangents_padded[i, :n] = tangents.cpu()
            normals_padded[i, :n] = low_n.cpu()
        out_mesh.normal_map = normal_map.float().clamp(0.0, 1.0).cpu()
        out_mesh.tangents = tangents_padded
        out_mesh.normals = normals_padded
    if metallic is not None or roughness is not None or occlusion is not None:
        # Pack glTF ORM (R=occlusion, G=roughness, B=metallic); missing -> 1/1/0. Maps may
        # arrive at different resolutions, so resize each channel to a common HxW first.
        provided = [x for x in (metallic, roughness, occlusion) if x is not None]
        B = int(provided[0].shape[0])
        H = max(int(x.shape[1]) for x in provided)
        W = max(int(x.shape[2]) for x in provided)

        def _chan(img, default):
            if img is None:
                return torch.full((B, H, W, 1), float(default))
            t = img.float().clamp(0.0, 1.0).cpu()[..., 0:1]
            if int(t.shape[1]) != H or int(t.shape[2]) != W:
                t = torch.nn.functional.interpolate(t.permute(0, 3, 1, 2), size=(H, W),
                                                    mode="bilinear", align_corners=False).permute(0, 2, 3, 1)
            return t

        out_mesh.metallic_roughness = torch.cat(
            [_chan(occlusion, 1.0), _chan(roughness, 1.0), _chan(metallic, 0.0)], dim=-1)
        if occlusion is not None:
            # Tells save_glb to also point occlusionTexture at the MR image (R = AO).
            out_mesh.occlusion_in_mr = True
    return out_mesh


def render_uv_atlas(mesh: MESH, resolution: int = 1024) -> np.ndarray:
    """Rasterize the UV layout of batch item 0 (charts colored, borders outlined) to (H, W, 3) float32."""
    uvs_t = mesh.uvs
    if uvs_t is None:
        raise RuntimeError("mesh has no UVs to render — run unwrap first")
    uvs_np = uvs_t.detach().cpu().numpy()
    if uvs_np.ndim == 3:
        uvs_np = uvs_np[0]
    f = mesh.faces
    if torch.is_tensor(f):
        f = f.detach().cpu().numpy()
    if f.ndim == 3:
        f = f[0]
    if mesh.vertex_counts is not None:
        uvs_np = uvs_np[:int(mesh.vertex_counts[0].item())]
        f = f[:int(mesh.face_counts[0].item())]
    f = np.ascontiguousarray(f, dtype=np.int64)
    uvs_np = np.ascontiguousarray(uvs_np, dtype=np.float32)
    device = comfy.model_management.get_torch_device()
    img = _uv_render_atlas(uvs_np, f, int(resolution), device)
    return img.detach().cpu().numpy()
