"""Parametric primitive generators — numpy ports of the three.js src/geometries builders."""

import math

import numpy as np
import torch

from .core import MESH, pack_variable_mesh_batch


def _pack(verts, faces, uvs, normals) -> MESH:
    return pack_variable_mesh_batch(
        [torch.from_numpy(np.ascontiguousarray(verts, dtype=np.float32))],
        [torch.from_numpy(np.ascontiguousarray(faces, dtype=np.int64))],
        uvs=[torch.from_numpy(np.ascontiguousarray(uvs, dtype=np.float32))],
        normals=[torch.from_numpy(np.ascontiguousarray(normals, dtype=np.float32))],
    )


def make_plane(width=1.0, height=1.0, width_segments=1, height_segments=1) -> MESH:
    """three.js PlaneGeometry (XY plane, +Z normal)."""
    gx = max(1, int(width_segments))
    gy = max(1, int(height_segments))
    ix = np.arange(gx + 1, dtype=np.float32)
    iy = np.arange(gy + 1, dtype=np.float32)
    xx, yy = np.meshgrid(ix, iy)
    x = xx * (width / gx) - width / 2
    y = yy * (height / gy) - height / 2
    verts = np.stack([x, -y, np.zeros_like(x)], axis=-1).reshape(-1, 3)
    normals = np.tile(np.array([0.0, 0.0, 1.0], dtype=np.float32), (verts.shape[0], 1))
    uvs = np.stack([xx / gx, 1.0 - yy / gy], axis=-1).reshape(-1, 2)

    gx1 = gx + 1
    jy, jx = np.meshgrid(np.arange(gy), np.arange(gx), indexing='ij')
    a = jx + gx1 * jy
    b = jx + gx1 * (jy + 1)
    c = (jx + 1) + gx1 * (jy + 1)
    d = (jx + 1) + gx1 * jy
    faces = np.concatenate([
        np.stack([a, b, d], axis=-1).reshape(-1, 3),
        np.stack([b, c, d], axis=-1).reshape(-1, 3),
    ])
    return _pack(verts, faces, uvs, normals)


def make_box(width=1.0, height=1.0, depth=1.0, width_segments=1, height_segments=1, depth_segments=1) -> MESH:
    """three.js BoxGeometry (six buildPlane calls, per-face verts/normals/UVs)."""
    ws = max(1, int(width_segments))
    hs = max(1, int(height_segments))
    ds = max(1, int(depth_segments))
    AX = {'x': 0, 'y': 1, 'z': 2}

    verts_l, norms_l, uvs_l, faces_l = [], [], [], []
    n_verts = 0

    def build_plane(u, v, w, udir, vdir, pw, ph, pd, grid_x, grid_y):
        nonlocal n_verts
        gx1, gy1 = grid_x + 1, grid_y + 1
        ix = np.arange(gx1, dtype=np.float32)
        iy = np.arange(gy1, dtype=np.float32)
        xx, yy = np.meshgrid(ix, iy)
        x = (xx * (pw / grid_x) - pw / 2) * udir
        y = (yy * (ph / grid_y) - ph / 2) * vdir

        pos = np.zeros((gy1, gx1, 3), dtype=np.float32)
        pos[..., AX[u]] = x
        pos[..., AX[v]] = y
        pos[..., AX[w]] = pd / 2
        nrm = np.zeros((gy1, gx1, 3), dtype=np.float32)
        nrm[..., AX[w]] = 1.0 if pd > 0 else -1.0
        uv = np.stack([xx / grid_x, 1.0 - yy / grid_y], axis=-1)

        jy, jx = np.meshgrid(np.arange(grid_y), np.arange(grid_x), indexing='ij')
        a = n_verts + jx + gx1 * jy
        b = n_verts + jx + gx1 * (jy + 1)
        c = n_verts + (jx + 1) + gx1 * (jy + 1)
        d = n_verts + (jx + 1) + gx1 * jy
        faces_l.append(np.stack([a, b, d], axis=-1).reshape(-1, 3))
        faces_l.append(np.stack([b, c, d], axis=-1).reshape(-1, 3))

        verts_l.append(pos.reshape(-1, 3))
        norms_l.append(nrm.reshape(-1, 3))
        uvs_l.append(uv.reshape(-1, 2))
        n_verts += gy1 * gx1

    build_plane('z', 'y', 'x', -1, -1, depth, height, width, ds, hs)
    build_plane('z', 'y', 'x', 1, -1, depth, height, -width, ds, hs)
    build_plane('x', 'z', 'y', 1, 1, width, depth, height, ws, ds)
    build_plane('x', 'z', 'y', 1, -1, width, depth, -height, ws, ds)
    build_plane('x', 'y', 'z', 1, -1, width, height, depth, ws, hs)
    build_plane('x', 'y', 'z', -1, -1, width, height, -depth, ws, hs)

    return _pack(np.concatenate(verts_l), np.concatenate(faces_l),
                 np.concatenate(uvs_l), np.concatenate(norms_l))


def make_sphere(radius=0.5, width_segments=32, height_segments=16) -> MESH:
    """three.js SphereGeometry (full sphere; pole rows keep degenerate-free index layout)."""
    ws = max(3, int(width_segments))
    hs = max(2, int(height_segments))

    iy = np.arange(hs + 1, dtype=np.float32)[:, None]
    ix = np.arange(ws + 1, dtype=np.float32)[None, :]
    v = iy / hs
    u = ix / ws
    theta = v * math.pi
    phi = u * 2.0 * math.pi

    sin_theta = np.sin(theta)
    sin_theta[0] = 0.0
    sin_theta[-1] = 0.0
    x = -radius * np.cos(phi) * sin_theta
    y = radius * np.cos(theta) * np.ones_like(phi)
    z = radius * np.sin(phi) * sin_theta
    verts = np.stack(np.broadcast_arrays(x, y, z), axis=-1).reshape(-1, 3)
    normals = verts / max(radius, 1e-12)

    u_offset = np.zeros((hs + 1, 1), dtype=np.float32)
    u_offset[0] = 0.5 / ws
    u_offset[hs] = -0.5 / ws
    uvs = np.stack(np.broadcast_arrays(u + u_offset, 1.0 - v * np.ones_like(u)), axis=-1).reshape(-1, 2)

    grid = np.arange((hs + 1) * (ws + 1)).reshape(hs + 1, ws + 1)
    faces = []
    for row in range(hs):
        a = grid[row, 1:]
        b = grid[row, :-1]
        c = grid[row + 1, :-1]
        d = grid[row + 1, 1:]
        if row != 0:
            faces.append(np.stack([a, b, d], axis=-1))
        if row != hs - 1:
            faces.append(np.stack([b, c, d], axis=-1))
    return _pack(verts, np.concatenate(faces).reshape(-1, 3), uvs, normals)


def make_cylinder(radius_top=0.5, radius_bottom=0.5, height=1.0,
                  radial_segments=32, height_segments=1) -> MESH:
    """three.js CylinderGeometry (capped torso; cone = radius_top 0, ConeGeometry style)."""
    rs = max(3, int(radial_segments))
    hs = max(1, int(height_segments))
    half = height / 2
    slope = (radius_bottom - radius_top) / height

    verts_l, norms_l, uvs_l, faces_l = [], [], [], []
    index = 0

    yy = np.arange(hs + 1, dtype=np.float32)[:, None] / hs
    xx = np.arange(rs + 1, dtype=np.float32)[None, :] / rs
    theta = xx * 2.0 * math.pi
    sin_t, cos_t = np.sin(theta), np.cos(theta)
    row_r = yy * (radius_bottom - radius_top) + radius_top

    px = row_r * sin_t
    py = (-yy * height + half) * np.ones_like(sin_t)
    pz = row_r * cos_t
    verts_l.append(np.stack(np.broadcast_arrays(px, py, pz), axis=-1).reshape(-1, 3))
    nrm = np.stack(np.broadcast_arrays(sin_t, np.full_like(sin_t, slope), cos_t), axis=-1)
    nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True).clip(1e-12)
    norms_l.append(np.tile(nrm, (hs + 1, 1, 1)).reshape(-1, 3))
    uvs_l.append(np.stack(np.broadcast_arrays(xx * np.ones_like(yy), 1.0 - yy * np.ones_like(xx)),
                          axis=-1).reshape(-1, 2))

    grid = np.arange((hs + 1) * (rs + 1)).reshape(hs + 1, rs + 1)
    for row in range(hs):
        a = grid[row, :-1]
        b = grid[row + 1, :-1]
        c = grid[row + 1, 1:]
        d = grid[row, 1:]
        if radius_top > 0 or row != 0:
            faces_l.append(np.stack([a, b, d], axis=-1))
        if radius_bottom > 0 or row != hs - 1:
            faces_l.append(np.stack([b, c, d], axis=-1))
    index = (hs + 1) * (rs + 1)

    def cap(top: bool):
        nonlocal index
        radius = radius_top if top else radius_bottom
        sign = 1.0 if top else -1.0
        center_start = index
        verts_l.append(np.tile(np.array([[0.0, half * sign, 0.0]], dtype=np.float32), (rs, 1)))
        norms_l.append(np.tile(np.array([[0.0, sign, 0.0]], dtype=np.float32), (rs, 1)))
        uvs_l.append(np.full((rs, 2), 0.5, dtype=np.float32))
        index += rs
        center_end = index

        t = (np.arange(rs + 1, dtype=np.float32) / rs) * 2.0 * math.pi
        ct, st = np.cos(t), np.sin(t)
        verts_l.append(np.stack([radius * st, np.full_like(st, half * sign), radius * ct], axis=-1))
        norms_l.append(np.tile(np.array([[0.0, sign, 0.0]], dtype=np.float32), (rs + 1, 1)))
        uvs_l.append(np.stack([ct * 0.5 + 0.5, st * 0.5 * sign + 0.5], axis=-1))
        index += rs + 1

        k = np.arange(rs)
        cc = center_start + k
        ii = center_end + k
        if top:
            faces_l.append(np.stack([ii, ii + 1, cc], axis=-1))
        else:
            faces_l.append(np.stack([ii + 1, ii, cc], axis=-1))

    if radius_top > 0:
        cap(True)
    if radius_bottom > 0:
        cap(False)

    return _pack(np.concatenate([v.reshape(-1, 3) for v in verts_l]),
                 np.concatenate([f.reshape(-1, 3) for f in faces_l]),
                 np.concatenate([u.reshape(-1, 2) for u in uvs_l]),
                 np.concatenate([n.reshape(-1, 3) for n in norms_l]))


def make_torus(radius=0.5, tube=0.2, radial_segments=12, tubular_segments=48) -> MESH:
    """three.js TorusGeometry (full ring)."""
    rs = max(3, int(radial_segments))
    ts = max(3, int(tubular_segments))

    j = np.arange(rs + 1, dtype=np.float32)[:, None]
    i = np.arange(ts + 1, dtype=np.float32)[None, :]
    v = (j / rs) * 2.0 * math.pi
    u = (i / ts) * 2.0 * math.pi

    x = (radius + tube * np.cos(v)) * np.cos(u)
    y = (radius + tube * np.cos(v)) * np.sin(u)
    z = tube * np.sin(v) * np.ones_like(u)
    verts = np.stack(np.broadcast_arrays(x, y, z), axis=-1).reshape(-1, 3)

    cx = radius * np.cos(u) * np.ones_like(v)
    cy = radius * np.sin(u) * np.ones_like(v)
    center = np.stack(np.broadcast_arrays(cx, cy, np.zeros_like(x)), axis=-1).reshape(-1, 3)
    normals = verts - center
    normals /= np.linalg.norm(normals, axis=-1, keepdims=True).clip(1e-12)

    uvs = np.stack(np.broadcast_arrays(i / ts * np.ones_like(j), j / rs * np.ones_like(i)),
                   axis=-1).reshape(-1, 2)

    jj, ii = np.meshgrid(np.arange(1, rs + 1), np.arange(1, ts + 1), indexing='ij')
    a = (ts + 1) * jj + ii - 1
    b = (ts + 1) * (jj - 1) + ii - 1
    c = (ts + 1) * (jj - 1) + ii
    d = (ts + 1) * jj + ii
    faces = np.concatenate([
        np.stack([a, b, d], axis=-1).reshape(-1, 3),
        np.stack([b, c, d], axis=-1).reshape(-1, 3),
    ])
    return _pack(verts, faces, uvs, normals)


def make_primitive(kind: str, size: float = 1.0, segments: int = 32) -> MESH:
    """Dispatch by kind: cube / sphere / cylinder / cone / plane / torus."""
    kind = (kind or 'cube').lower()
    seg = max(1, int(segments))
    if kind == 'cube':
        s = max(1, seg // 8)
        return make_box(size, size, size, s, s, s)
    if kind == 'sphere':
        return make_sphere(size * 0.5, seg, max(2, seg // 2))
    if kind == 'cylinder':
        return make_cylinder(size * 0.5, size * 0.5, size, seg, 1)
    if kind == 'cone':
        return make_cylinder(0.0, size * 0.5, size, seg, 1)
    if kind == 'plane':
        s = max(1, seg // 8)
        return make_plane(size, size, s, s)
    if kind == 'torus':
        return make_torus(size * 0.5, size * 0.2, max(3, seg // 2), seg)
    raise ValueError(f"unknown primitive '{kind}' (cube/sphere/cylinder/cone/plane/torus)")
