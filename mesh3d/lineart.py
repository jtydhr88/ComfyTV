"""Feature-line extraction (silhouette/crease/boundary) + BVH occlusion + raster line art."""

import math

import numpy as np
import torch

import comfy.model_management

from .core import get_mesh_batch_item
from .postprocess_ops import _any_hit_rays_bvh, _build_triangle_bvh

_RAY_CHUNK = 1 << 19


def _weld_positions(v, f, eps):
    key = torch.round(v / eps).to(torch.long)
    uniq, inv = torch.unique(key, dim=0, return_inverse=True)
    pos = v.new_zeros((uniq.shape[0], 3))
    pos[inv] = v
    f2 = inv[f]
    keep = (f2[:, 0] != f2[:, 1]) & (f2[:, 1] != f2[:, 2]) & (f2[:, 0] != f2[:, 2])
    return pos, f2[keep]


def _edge_face_table(f):
    dev = f.device
    F = f.shape[0]
    e = torch.cat([f[:, [0, 1]], f[:, [1, 2]], f[:, [2, 0]]], dim=0)
    ekey, _ = torch.sort(e, dim=1)
    uniq, inv = torch.unique(ekey, dim=0, return_inverse=True)
    face_ids = torch.arange(F, device=dev).repeat(3)
    order = torch.argsort(inv, stable=True)
    sorted_faces = face_ids[order]
    counts = torch.bincount(inv[order], minlength=uniq.shape[0])
    starts = torch.cumsum(counts, 0) - counts
    f0 = sorted_faces[starts]
    f1 = torch.full_like(f0, -1)
    has2 = counts >= 2
    f1[has2] = sorted_faces[(starts + 1).clamp(max=sorted_faces.shape[0] - 1)][has2]
    return uniq, f0, f1, counts


def extract_feature_edges(v, f, cam_pos, silhouette=True, crease=True, boundary=True,
                          crease_angle_deg=60.0):
    """Feature edges on a position-welded mesh. Returns (edges [K,2] long, kind_counts dict)."""
    edges, f0, f1, counts = _edge_face_table(f)
    a, b, c = v[f[:, 0]], v[f[:, 1]], v[f[:, 2]]
    fn = torch.nn.functional.normalize(torch.cross(b - a, c - a, dim=-1), dim=-1, eps=1e-12)
    fc = (a + b + c) / 3.0

    manifold = counts == 2
    masks = {}
    if silhouette:
        front = ((cam_pos.unsqueeze(0) - fc) * fn).sum(-1) > 0
        masks['silhouette'] = manifold & (front[f0] != front[f1.clamp_min(0)])
    if crease:
        cos_thresh = math.cos(math.radians(float(crease_angle_deg)))
        cos = (fn[f0] * fn[f1.clamp_min(0)]).sum(-1)
        masks['crease'] = manifold & (cos < cos_thresh)
    if boundary:
        masks['boundary'] = counts != 2

    keep = torch.zeros(edges.shape[0], dtype=torch.bool, device=v.device)
    kind_counts = {}
    for name, m in masks.items():
        kind_counts[name] = int((m & ~keep).sum().item())
        keep |= m
    return edges[keep], kind_counts


def _project(points, cam_pos, target, fov_deg, width, height, up=None):
    dev = points.device
    if up is None:
        up = torch.tensor([0.0, 1.0, 0.0], device=dev)
    fwd = torch.nn.functional.normalize(target - cam_pos, dim=-1, eps=1e-12)
    right = torch.nn.functional.normalize(torch.cross(fwd, up, dim=-1), dim=-1, eps=1e-12)
    up2 = torch.cross(right, fwd, dim=-1)
    rel = points - cam_pos
    xv = (rel * right).sum(-1)
    yv = (rel * up2).sum(-1)
    zv = (rel * fwd).sum(-1)
    tan_half = math.tan(math.radians(float(fov_deg)) * 0.5)
    aspect = float(width) / float(height)
    z = zv.clamp_min(1e-9)
    px = (xv / (z * tan_half * aspect) + 1.0) * 0.5 * width
    py = (1.0 - yv / (z * tan_half)) * 0.5 * height
    return px, py, zv


def default_camera(v):
    lo = v.amin(0)
    hi = v.amax(0)
    center = ((lo + hi) * 0.5)
    max_dim = float((hi - lo).max().item())
    if not math.isfinite(max_dim) or max_dim <= 0:
        center = torch.zeros_like(center)
        max_dim = 2.0
    dist = max_dim * 1.8
    offset = torch.tensor([0.7, 0.55, 0.7], device=v.device) * dist
    return {'position': (center + offset).tolist(), 'target': center.tolist(), 'fov': 45.0}


def lineart_image(mesh, camera=None, width=1024, height=1024, thickness=2.0,
                  silhouette=True, crease=True, boundary=True, crease_angle=60.0,
                  occlusion=True, invert=False, samples_per_edge=24, supersample=2):
    from PIL import Image, ImageDraw

    dev = comfy.model_management.get_torch_device()
    v, f, _, _, _ = get_mesh_batch_item(mesh, 0)
    v = v.to(dev, torch.float32)
    f = f.to(dev, torch.long)
    if v.shape[0] == 0 or f.shape[0] == 0:
        raise RuntimeError("line art: mesh is empty")

    diag = float(torch.linalg.norm(v.amax(0) - v.amin(0)).item()) or 1.0
    v, f = _weld_positions(v, f, eps=diag * 1e-6)
    if f.shape[0] == 0:
        raise RuntimeError("line art: mesh has no valid faces")

    cam = dict(camera or {})
    fallback = default_camera(v)
    cam_pos = torch.tensor([float(x) for x in cam.get('position', fallback['position'])],
                           device=dev, dtype=torch.float32)
    target = torch.tensor([float(x) for x in cam.get('target', fallback['target'])],
                          device=dev, dtype=torch.float32)
    fov = float(cam.get('fov', fallback['fov']))

    edges, kind_counts = extract_feature_edges(
        v, f, cam_pos, silhouette=silhouette, crease=crease, boundary=boundary,
        crease_angle_deg=crease_angle)
    if edges.shape[0] == 0:
        raise RuntimeError("line art: no feature edges — enable more edge types or "
                           "lower the crease angle")

    S = max(2, int(samples_per_edge))
    t = torch.linspace(0.0, 1.0, S, device=dev).view(1, S, 1)
    p0 = v[edges[:, 0]].unsqueeze(1)
    p1 = v[edges[:, 1]].unsqueeze(1)
    pts = (p0 * (1.0 - t) + p1 * t).reshape(-1, 3)

    rel = pts - cam_pos
    dist = torch.linalg.norm(rel, dim=-1).clamp_min(1e-12)
    visible = torch.ones(pts.shape[0], dtype=torch.bool, device=dev)
    if occlusion:
        tri = v[f]
        bvh = _build_triangle_bvh(tri)
        dirs = rel / dist.unsqueeze(-1)
        origins = cam_pos.expand_as(dirs)
        bias = diag * 2e-3
        hit = torch.zeros_like(visible)
        for s in range(0, pts.shape[0], _RAY_CHUNK):
            e = min(s + _RAY_CHUNK, pts.shape[0])
            hit[s:e] = _any_hit_rays_bvh(origins[s:e].contiguous(), dirs[s:e], tri, bvh,
                                         tmin=diag * 1e-4, tmax=(dist[s:e] - bias).clamp_min(0.0))
        visible = ~hit

    ss = max(1, int(supersample))
    W2, H2 = int(width) * ss, int(height) * ss
    px, py, zv = _project(pts, cam_pos, target, fov, W2, H2)
    visible &= zv > diag * 1e-5

    vis = visible.reshape(-1, S).cpu().numpy()
    xy = torch.stack([px, py], dim=-1).reshape(-1, S, 2).cpu().numpy()

    bg, fg = (255, 0) if invert else (0, 255)
    img = Image.new('L', (W2, H2), bg)
    draw = ImageDraw.Draw(img)
    lw = max(1, round(float(thickness) * ss))
    drawn = 0
    for ei in np.flatnonzero(vis.any(axis=1)):
        row = vis[ei]
        pts2d = xy[ei]
        s = 0
        while s < S:
            if not row[s]:
                s += 1
                continue
            e = s
            while e + 1 < S and row[e + 1]:
                e += 1
            if e > s:
                draw.line([tuple(q) for q in pts2d[s:e + 1]], fill=fg, width=lw, joint='curve')
                drawn += 1
            else:
                r = lw * 0.5
                draw.ellipse([pts2d[s, 0] - r, pts2d[s, 1] - r,
                              pts2d[s, 0] + r, pts2d[s, 1] + r], fill=fg)
            s = e + 1
    if ss > 1:
        img = img.resize((int(width), int(height)), Image.LANCZOS)

    stats = {'feature_edges': int(edges.shape[0]), **kind_counts,
             'visible_ratio': round(float(vis.mean()), 4), 'polylines': int(drawn)}
    return img.convert('RGB'), stats
