"""SDF-grid mesh boolean via narrow-band Dual Contouring (OpenVDB CSG semantics:
union = min, intersect = max, difference = max(a, -b); inputs are pre-split for
sound kNN distance queries and closed meshes are signed by ray-crossing parity)."""

import logging

import torch

import comfy.utils

from .postprocess.remesh import (
    _build_centroid_tree,
    _build_narrow_band_voxels,
    _dual_contour,
    _filter_components,
    _taubin_smooth,
    _udf_exact,
)
from .subdivide import split_long_edges

BOOLEAN_OPS = ('union', 'difference', 'intersect')

_log = logging.getLogger(__name__)


def _face_normals(verts: torch.Tensor, faces: torch.Tensor) -> torch.Tensor:
    tv = verts[faces.long()]
    return torch.nn.functional.normalize(
        torch.cross(tv[:, 1] - tv[:, 0], tv[:, 2] - tv[:, 0], dim=-1),
        p=2, dim=-1, eps=1e-12)


def _is_closed(verts: torch.Tensor, faces: torch.Tensor) -> bool:
    """Geometric closedness: weld coincident positions, then tolerate negligible boundary length."""
    from .postprocess_ops import weld_vertices_fn
    wv, wf, _, _ = weld_vertices_fn(verts, faces, epsilon=None, epsilon_rel=1e-6)
    if wf.numel() == 0:
        return False
    degen = ((wf[:, 0] == wf[:, 1]) | (wf[:, 1] == wf[:, 2]) | (wf[:, 2] == wf[:, 0]))
    wf = wf[~degen]
    e = torch.stack([wf[:, 0], wf[:, 1], wf[:, 1], wf[:, 2],
                     wf[:, 2], wf[:, 0]], dim=1).reshape(-1, 2)
    key = torch.minimum(e[:, 0], e[:, 1]) * wv.shape[0] + torch.maximum(e[:, 0], e[:, 1])
    uniq, counts = torch.unique(key, return_counts=True)
    bkey = uniq[counts == 1]
    if bkey.numel() == 0:
        return True
    blen = (wv[bkey // wv.shape[0]] - wv[bkey % wv.shape[0]]).norm(dim=-1).sum()
    diag = (verts.max(0)[0] - verts.min(0)[0]).norm()
    return bool((blen < 1e-4 * diag).item())


def _column_parity_inside(corner_int: torch.Tensor, verts: torch.Tensor, faces: torch.Tensor,
                          resolution: int, scale: float, center: torch.Tensor) -> torch.Tensor:
    """Inside test for grid corners via +z ray-crossing parity along jittered grid columns."""
    device = verts.device
    R1 = resolution + 1
    cell = scale / resolution
    jx = 0.1234567 * cell
    jy = 0.0765432 * cell
    cx, cy = float(center[0]), float(center[1])

    tri = verts[faces].double()                                     # (F, 3, 3)
    ax, ay, az = tri[:, 0, 0], tri[:, 0, 1], tri[:, 0, 2]
    bx, by, bz = tri[:, 1, 0], tri[:, 1, 1], tri[:, 1, 2]
    cx3, cy3, cz3 = tri[:, 2, 0], tri[:, 2, 1], tri[:, 2, 2]
    denom = (by - cy3) * (ax - cx3) + (cx3 - bx) * (ay - cy3)
    ok = denom.abs() > 1e-18

    def to_ix(x):
        return (x - cx - jx) / scale * resolution + resolution / 2.0

    def to_iy(y):
        return (y - cy - jy) / scale * resolution + resolution / 2.0

    ix_lo = torch.ceil(to_ix(torch.minimum(torch.minimum(ax, bx), cx3))).clamp(0, resolution).long()
    ix_hi = torch.floor(to_ix(torch.maximum(torch.maximum(ax, bx), cx3))).clamp(-1, resolution).long()
    iy_lo = torch.ceil(to_iy(torch.minimum(torch.minimum(ay, by), cy3))).clamp(0, resolution).long()
    iy_hi = torch.floor(to_iy(torch.maximum(torch.maximum(ay, by), cy3))).clamp(-1, resolution).long()
    nx = (ix_hi - ix_lo + 1).clamp(min=0)
    ny = (iy_hi - iy_lo + 1).clamp(min=0)
    n_cols = torch.where(ok, nx * ny, torch.zeros_like(nx))
    total = int(n_cols.sum().item())

    keys_list = []
    zs_list = []
    if total > 0:
        rep = torch.repeat_interleave(torch.arange(faces.shape[0], device=device), n_cols)
        cum = torch.cat([torch.zeros(1, dtype=n_cols.dtype, device=device), n_cols.cumsum(0)[:-1]])
        local = torch.arange(total, device=device) - cum[rep]
        lx = local % nx[rep].clamp(min=1)
        ly = local // nx[rep].clamp(min=1)
        gix = ix_lo[rep] + lx
        giy = iy_lo[rep] + ly

        px = (gix.double() / resolution - 0.5) * scale + cx + jx
        py = (giy.double() / resolution - 0.5) * scale + cy + jy
        r = rep
        b0 = ((by[r] - cy3[r]) * (px - cx3[r]) + (cx3[r] - bx[r]) * (py - cy3[r])) / denom[r]
        b1 = ((cy3[r] - ay[r]) * (px - cx3[r]) + (ax[r] - cx3[r]) * (py - cy3[r])) / denom[r]
        b2 = 1.0 - b0 - b1
        inside_tri = (b0 >= 0) & (b1 >= 0) & (b2 >= 0)
        if inside_tri.any():
            keys_list.append((gix[inside_tri] * R1 + giy[inside_tri]))
            zs_list.append(b0[inside_tri] * az[r][inside_tri]
                           + b1[inside_tri] * bz[r][inside_tri]
                           + b2[inside_tri] * cz3[r][inside_tri])

    n_corners = corner_int.shape[0]
    if not keys_list:
        return torch.zeros(n_corners, dtype=torch.bool, device=device)
    keys = torch.cat(keys_list)
    zs = torch.cat(zs_list)

    z_lo = float(zs.min().item())
    z_span = max(float(zs.max().item()) - z_lo, 1e-12) * (1.0 + 1e-9)
    comp = keys.double() + (zs - z_lo) / z_span
    comp, order = comp.sort()
    keys_sorted = keys[order]

    ckey = (corner_int[:, 0] * R1 + corner_int[:, 1]).long()
    corner_z = ((corner_int[:, 2].double() / resolution - 0.5) * scale + float(center[2]))
    corner_comp = ckey.double() + ((corner_z - z_lo) / z_span).clamp(0.0, 1.0 - 1e-12)
    below = torch.searchsorted(comp, corner_comp)
    col_start = torch.searchsorted(keys_sorted.contiguous(), ckey)
    return ((below - col_start) % 2) == 1


def _signed_field(corner_int: torch.Tensor, corner_world: torch.Tensor,
                  verts: torch.Tensor, faces: torch.Tensor,
                  resolution: int, scale: float, center: torch.Tensor,
                  label: str) -> torch.Tensor:
    tri_verts = verts[faces]
    tree = _build_centroid_tree(tri_verts)
    udf, closest, tri = _udf_exact(corner_world, tri_verts, tree=tree)
    if _is_closed(verts, faces):
        inside = _column_parity_inside(corner_int, verts, faces, resolution, scale, center)
    else:
        _log.warning("boolean: %s mesh is open — falling back to normal-based inside test", label)
        n = _face_normals(verts, faces)[tri.clamp(min=0)]
        inside = ((corner_world - closest) * n).sum(-1) < 0
    return torch.where(inside, -udf, udf)


def boolean_narrow_band_dc(va: torch.Tensor, fa: torch.Tensor,
                           vb: torch.Tensor, fb: torch.Tensor,
                           op: str = 'union', resolution: int = 256, band: float = 1.0,
                           qef: bool = True, smooth_iters: int = 0,
                           drop_small_components: float = 0.0,
                           colors_a: torch.Tensor = None, colors_b: torch.Tensor = None):
    """Returns (verts, faces, colors); colors None unless either input carries them."""
    if op not in BOOLEAN_OPS:
        raise ValueError(f"op must be one of {BOOLEAN_OPS}, got {op!r}")
    device = va.device
    va = va.float()
    vb = vb.to(device).float()
    fa = fa.long()
    fb = fb.to(device).long()

    bbox_all = torch.cat([va, vb])
    center = 0.5 * (bbox_all.max(dim=0)[0] + bbox_all.min(dim=0)[0])
    bbox = bbox_all.max(dim=0)[0] - bbox_all.min(dim=0)[0]
    scale = float(bbox.max().item()) * 1.1
    eps = band * scale / resolution

    max_edge = scale / 16.0
    va, fa, colors_a = split_long_edges(va, fa, max_edge, colors=colors_a)
    vb, fb, colors_b = split_long_edges(vb, fb, max_edge, colors=colors_b)

    all_v = torch.cat([va, vb])
    all_f = torch.cat([fa, fb + va.shape[0]])

    n_levels, _b = 1, resolution
    while _b > 32 and _b % 2 == 0:
        _b //= 2
    while _b < resolution:
        _b *= 2
        n_levels += 1
    pbar = comfy.utils.ProgressBar(n_levels + 2 + int(smooth_iters))

    voxel_coords, tree_all = _build_narrow_band_voxels(
        all_v, all_f, center, scale, resolution, eps,
        progress_callback=lambda: pbar.update(1))
    empty = (torch.empty((0, 3), dtype=va.dtype, device=device),
             torch.empty((0, 3), dtype=fa.dtype, device=device), None)
    if voxel_coords.numel() == 0:
        return empty

    CORNER_OFFS = torch.tensor([
        [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
        [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
    ], dtype=torch.long, device=device)
    corners = (voxel_coords.unsqueeze(1) + CORNER_OFFS.unsqueeze(0)).reshape(-1, 3)
    R1 = resolution + 1
    corner_keys = (corners[:, 0] * R1 + corners[:, 1]) * R1 + corners[:, 2]
    unique_corner_keys, corner_inv = torch.unique(corner_keys, return_inverse=True)
    unique_corners = torch.zeros((unique_corner_keys.shape[0], 3), dtype=torch.long, device=device)
    unique_corners[corner_inv] = corners
    corner_world = (unique_corners.float() / resolution - 0.5) * scale + center.unsqueeze(0)

    sa = _signed_field(unique_corners, corner_world, va, fa, resolution, scale, center, 'A')
    sb = _signed_field(unique_corners, corner_world, vb, fb, resolution, scale, center, 'B')
    if op == 'union':
        sdf = torch.minimum(sa, sb)
    elif op == 'intersect':
        sdf = torch.maximum(sa, sb)
    else:
        sdf = torch.maximum(sa, -sb)
    pbar.update(1)

    tri_verts_all = all_v[all_f]
    if qef:
        tri_face_normals = _face_normals(all_v, all_f)

        def _qef_query(pts):
            return _udf_exact(pts, tri_verts_all, tree=tree_all)
    else:
        tri_face_normals = None
        _qef_query = None

    dual_verts, new_faces = _dual_contour(
        voxel_coords, sdf, unique_corner_keys,
        resolution, scale, center,
        tri_face_normals=tri_face_normals, qef_query=_qef_query,
        corner_valid=None)
    pbar.update(1)
    if dual_verts.numel() == 0 or new_faces.numel() == 0:
        return empty

    out_colors = None
    if colors_a is not None or colors_b is not None:
        ca = colors_a.to(device).float() if colors_a is not None else va.new_ones((va.shape[0], 3))
        cb = colors_b.to(device).float() if colors_b is not None else vb.new_ones((vb.shape[0], 3))
        if ca.shape[1] != cb.shape[1]:
            ch = min(ca.shape[1], cb.shape[1])
            ca, cb = ca[:, :ch], cb[:, :ch]
        colors_all = torch.cat([ca, cb])
        _, closest_pts, closest_tri = _udf_exact(dual_verts, tri_verts_all, tree=tree_all)
        tri_v_idx = all_f[closest_tri]
        tri_v = all_v[tri_v_idx]
        e0 = tri_v[:, 1] - tri_v[:, 0]
        e1 = tri_v[:, 2] - tri_v[:, 0]
        e2 = closest_pts - tri_v[:, 0]
        d00 = (e0 * e0).sum(-1)
        d01 = (e0 * e1).sum(-1)
        d11 = (e1 * e1).sum(-1)
        d20 = (e2 * e0).sum(-1)
        d21 = (e2 * e1).sum(-1)
        denom = d00 * d11 - d01 * d01 + 1e-20
        bv = ((d11 * d20 - d01 * d21) / denom).clamp(0.0, 1.0)
        bw = ((d00 * d21 - d01 * d20) / denom).clamp(0.0, 1.0)
        bu = (1.0 - bv - bw).clamp(0.0, 1.0)
        tri_c = colors_all[tri_v_idx]
        out_colors = (bu.unsqueeze(-1) * tri_c[:, 0]
                      + bv.unsqueeze(-1) * tri_c[:, 1]
                      + bw.unsqueeze(-1) * tri_c[:, 2])

    if drop_small_components > 0:
        new_faces = _filter_components(
            dual_verts, new_faces,
            min_fraction=drop_small_components,
            drop_inverted=False, drop_enclosed=False)

    if smooth_iters > 0:
        dual_verts = _taubin_smooth(dual_verts, new_faces, iters=int(smooth_iters),
                                    progress_callback=lambda: pbar.update(1))

    used = torch.zeros(dual_verts.shape[0], dtype=torch.bool, device=device)
    used[new_faces[:, 0]] = True
    used[new_faces[:, 1]] = True
    used[new_faces[:, 2]] = True
    remap = used.long().cumsum(0) - 1
    dual_verts = dual_verts[used]
    new_faces = remap[new_faces.long()]
    if out_colors is not None:
        out_colors = out_colors[used]

    return dual_verts, new_faces.to(fa.dtype), out_colors
