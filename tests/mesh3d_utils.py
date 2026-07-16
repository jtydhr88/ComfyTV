"""Shared helpers for the mesh3d test modules (not collected by pytest)."""
from __future__ import annotations


def boundary_edge_count(verts, faces, weld_first=True):
    import torch
    from ComfyTV.mesh3d.postprocess_ops import weld_vertices_fn

    v = verts.float()
    f = faces.long()
    if weld_first:
        v, f, _, _ = weld_vertices_fn(v, f, epsilon=None, epsilon_rel=1e-6)
        degen = ((f[:, 0] == f[:, 1]) | (f[:, 1] == f[:, 2]) | (f[:, 2] == f[:, 0]))
        f = f[~degen]
    e = torch.stack([f[:, 0], f[:, 1], f[:, 1], f[:, 2], f[:, 2], f[:, 0]], dim=1).reshape(-1, 2)
    key = torch.minimum(e[:, 0], e[:, 1]) * v.shape[0] + torch.maximum(e[:, 0], e[:, 1])
    _, counts = torch.unique(key, return_counts=True)
    return int((counts == 1).sum().item())


def item(mesh, index=0):
    from ComfyTV.mesh3d.core import get_mesh_batch_item
    return get_mesh_batch_item(mesh, index)


def offset(mesh, dx, dy, dz):
    import torch
    from ComfyTV.mesh3d.core import pack_variable_mesh_batch
    v, f, c, u, n = item(mesh)
    return pack_variable_mesh_batch(
        [v + torch.tensor([dx, dy, dz])], [f],
        colors=[c] if c is not None else None,
        uvs=[u] if u is not None else None,
        normals=[n] if n is not None else None)
