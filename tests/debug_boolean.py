"""Repro + visual debug for the SDF boolean: cube+cylinder, render results, mesh diagnostics.

Not collected by pytest; run manually with ComfyUI's python env.
"""
import math
import sys
from pathlib import Path

_REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_REPO.parent.parent))
sys.path.insert(0, str(_REPO))

import numpy as np
import torch
from PIL import Image

from mesh3d import ops
from mesh3d.core import get_mesh_batch_item, pack_variable_mesh_batch
from mesh3d.primitives import make_primitive
from mesh3d.postprocess_ops import _build_triangle_bvh, _render_view

OUT = str(_REPO / 'tests' / '_debug_boolean')
import os
os.makedirs(OUT, exist_ok=True)


def render(mesh, path, yaw_deg=35.0, pitch_deg=25.0, H=512, W=512):
    v, f, _, _, _ = get_mesh_batch_item(mesh, 0)
    dev = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    v = v.to(dev).float()
    f = f.to(dev).long()
    tri = v[f]
    bvh = _build_triangle_bvh(tri)
    center = 0.5 * (v.max(0)[0] + v.min(0)[0])
    radius = float((v - center).norm(dim=-1).max().item())
    yaw, pitch = math.radians(yaw_deg), math.radians(pitch_deg)
    eye = center + radius * 2.6 * torch.tensor([
        math.cos(pitch) * math.sin(yaw), math.sin(pitch), math.cos(pitch) * math.cos(yaw)],
        device=dev)
    fwd = torch.nn.functional.normalize(center - eye, dim=-1)
    right = torch.nn.functional.normalize(torch.cross(fwd, torch.tensor([0., 1., 0.], device=dev), dim=-1), dim=-1)
    up = torch.cross(right, fwd, dim=-1)
    img, _, _ = _render_view(tri, bvh, None, f, None, eye, fwd, right, up, math.radians(45), H, W)
    Image.fromarray((img.clamp(0, 1).cpu().numpy() * 255).astype(np.uint8)).save(path)
    print(f"saved {path}")


def diagnostics(mesh, label):
    v, f, _, _, _ = get_mesh_batch_item(mesh, 0)
    f = f.long()
    V = v.shape[0]
    e = torch.stack([f[:, 0], f[:, 1], f[:, 1], f[:, 2], f[:, 2], f[:, 0]], dim=1).reshape(-1, 2)
    lo = torch.minimum(e[:, 0], e[:, 1])
    hi = torch.maximum(e[:, 0], e[:, 1])
    key = lo * V + hi
    uniq, counts = torch.unique(key, return_counts=True)
    boundary = int((counts == 1).sum())
    nonmanifold = int((counts > 2).sum())
    tri = v[f]
    area2 = torch.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0], dim=-1).norm(dim=-1)
    degen = int((area2 < 1e-12).sum())
    print(f"[{label}] verts={V} faces={f.shape[0]} boundary_edges={boundary} "
          f"nonmanifold_edges={nonmanifold} degenerate={degen}")


def offset_mesh(mesh, dx, dy, dz):
    v, f, _, _, _ = get_mesh_batch_item(mesh, 0)
    return pack_variable_mesh_batch([v + torch.tensor([dx, dy, dz])], [f])


cube = make_primitive('cube', size=1.0, segments=32)
cyl = make_primitive('cylinder', size=0.8, segments=32)
cyl = offset_mesh(cyl, 0.3, 0.3, 0.0)

render(cube, f'{OUT}/input_cube.png')
render(cyl, f'{OUT}/input_cyl.png')

for op_name in ('union', 'difference', 'intersect'):
    out, st = ops.boolean(cube, cyl, op=op_name, resolution=256)
    diagnostics(out, f'boolean {op_name} r256')
    out_n = ops.smooth_normals(out, crease_angle=180.0)
    render(out_n, f'{OUT}/bool_{op_name}.png')
    render(out_n, f'{OUT}/bool_{op_name}_back.png', yaw_deg=215.0, pitch_deg=-20.0)

print("DONE")
