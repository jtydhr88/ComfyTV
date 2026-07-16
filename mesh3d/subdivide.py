"""Midpoint 1-to-4 triangle subdivision (bmesh subdivide_edges / three.js TessellateModifier
semantics: split every edge at its midpoint, no repositioning) with optional Taubin smoothing."""

import torch

from .postprocess.remesh import _taubin_smooth


def subdivide_midpoint(verts: torch.Tensor, faces: torch.Tensor, iterations: int = 1,
                       colors: torch.Tensor = None, uvs: torch.Tensor = None,
                       smooth_iters: int = 0):
    """Returns (verts, faces, colors, uvs); per-vertex attrs are averaged at edge midpoints."""
    verts = verts.float()
    faces = faces.long()
    for _ in range(max(0, int(iterations))):
        V = verts.shape[0]
        e = torch.stack([
            faces[:, 0], faces[:, 1],
            faces[:, 1], faces[:, 2],
            faces[:, 2], faces[:, 0],
        ], dim=1).reshape(-1, 2)
        lo = torch.minimum(e[:, 0], e[:, 1])
        hi = torch.maximum(e[:, 0], e[:, 1])
        key = lo * V + hi
        uniq, inv = torch.unique(key, return_inverse=True)
        u_lo = uniq // V
        u_hi = uniq % V

        mid = 0.5 * (verts[u_lo] + verts[u_hi])
        mid_idx = (V + inv).reshape(-1, 3)
        m01, m12, m20 = mid_idx[:, 0], mid_idx[:, 1], mid_idx[:, 2]
        v0, v1, v2 = faces[:, 0], faces[:, 1], faces[:, 2]

        verts = torch.cat([verts, mid])
        faces = torch.cat([
            torch.stack([v0, m01, m20], dim=1),
            torch.stack([v1, m12, m01], dim=1),
            torch.stack([v2, m20, m12], dim=1),
            torch.stack([m01, m12, m20], dim=1),
        ])
        if colors is not None:
            colors = torch.cat([colors, 0.5 * (colors[u_lo] + colors[u_hi])])
        if uvs is not None:
            uvs = torch.cat([uvs, 0.5 * (uvs[u_lo] + uvs[u_hi])])

    if smooth_iters > 0:
        verts = _taubin_smooth(verts, faces, iters=int(smooth_iters))

    return verts, faces, colors, uvs


def max_edge_length(verts: torch.Tensor, faces: torch.Tensor) -> float:
    tri = verts[faces.long()]
    return float(torch.stack([
        (tri[:, 0] - tri[:, 1]).norm(dim=-1),
        (tri[:, 1] - tri[:, 2]).norm(dim=-1),
        (tri[:, 2] - tri[:, 0]).norm(dim=-1)]).max().item())


def split_long_edges(verts: torch.Tensor, faces: torch.Tensor, max_edge: float,
                     colors: torch.Tensor = None, max_iters: int = 6):
    """Midpoint-split until no edge exceeds max_edge; required before field-based ops
    (remesh, boolean) — long thin triangles defeat _udf_exact's centroid kNN."""
    verts = verts.float()
    faces = faces.long()
    for _ in range(max_iters):
        if faces.numel() == 0 or max_edge_length(verts, faces) <= max_edge:
            break
        verts, faces, colors, _ = subdivide_midpoint(verts, faces, iterations=1, colors=colors)
    return verts, faces, colors
