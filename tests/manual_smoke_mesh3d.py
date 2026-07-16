"""Standalone smoke test for the vendored mesh3d package.

Not collected by pytest; run manually with ComfyUI's python env from anywhere:
    python custom_nodes/ComfyTV/tests/manual_smoke_mesh3d.py
Paths derive from this file's location (ComfyTV/tests -> custom_nodes -> ComfyUI root).
"""
import sys
import time
from pathlib import Path

_REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_REPO.parent.parent))
sys.path.insert(0, str(_REPO))

import numpy as np
import torch

t0 = time.perf_counter()
from mesh3d import ops
from mesh3d.io3d import load_mesh_bytes, mesh_item_to_glb_bytes
from mesh3d.core import pack_variable_mesh_batch
print(f"[ok] imports ({time.perf_counter() - t0:.1f}s)")


def make_sphere(n_lat=64, n_lon=64, radius=0.4):
    """Lat-long UV sphere with duplicated ring verts (unwelded on the seam)."""
    lat = np.linspace(0.0, np.pi, n_lat + 1)
    lon = np.linspace(0.0, 2 * np.pi, n_lon + 1)
    ll, tt = np.meshgrid(lon, lat)
    x = radius * np.sin(tt) * np.cos(ll)
    y = radius * np.cos(tt)
    z = radius * np.sin(tt) * np.sin(ll)
    v = np.stack([x, y, z], axis=-1).reshape(-1, 3).astype(np.float32)
    idx = np.arange((n_lat + 1) * (n_lon + 1)).reshape(n_lat + 1, n_lon + 1)
    a = idx[:-1, :-1].ravel(); b = idx[1:, :-1].ravel()
    c = idx[1:, 1:].ravel();  d = idx[:-1, 1:].ravel()
    f = np.concatenate([np.stack([a, b, c], -1), np.stack([a, c, d], -1)]).astype(np.int64)
    return v, f


v, f = make_sphere()
colors = np.tile(np.array([[0.8, 0.4, 0.2]], dtype=np.float32), (v.shape[0], 1))
mesh = pack_variable_mesh_batch(
    [torch.from_numpy(v)], [torch.from_numpy(f)], colors=[torch.from_numpy(colors)])
print(f"[ok] sphere: {ops.mesh_stats(mesh)}")

m, st = ops.weld(mesh, epsilon_rel=1e-5)
print(f"[ok] weld: merged {st['welded']}, now {ops.mesh_stats(m)}")
assert st['welded'] > 0, "seam verts should have welded"

m, st = ops.fill_holes(m, max_perimeter=0.03)
print(f"[ok] fill_holes: {st}")

m2 = ops.smooth_normals(m, crease_angle=180.0)
assert m2.normals is not None
print(f"[ok] smooth_normals(180): normals {tuple(m2.normals.shape)}")

m3 = ops.smooth_normals(m, crease_angle=30.0)
assert m3.normals is not None
print(f"[ok] smooth_normals(30, crease split): {ops.mesh_stats(m3)}")

md, st = ops.decimate(m, target_face_count=800)
print(f"[ok] decimate: {st['faces_in']} -> {st['faces_out']}")
assert 0 < st['faces_out'] <= 800

mr, st = ops.remesh(m, resolution=96, sign_mode='udf')
print(f"[ok] remesh(96, udf): {st['faces_in']} -> {st['faces_out']}")
assert st['faces_out'] > 0

mu, st = ops.unwrap(md, segmenter='pec', resolution=512, padding=1)
assert mu.uvs is not None
print(f"[ok] unwrap: {st}")

atlas = ops.render_uv_atlas(mu, resolution=256)
assert atlas.shape == (256, 256, 3)
print(f"[ok] uv atlas: {atlas.shape}, mean {atlas.mean():.3f}")

mu2 = ops.smooth_normals(mu, crease_angle=180.0)
glb = mesh_item_to_glb_bytes(mu2, 0)
assert glb[:4] == b'glTF'
print(f"[ok] glb export: {len(glb)} bytes")

back = load_mesh_bytes(glb, 'glb')
print(f"[ok] glb re-parse: {ops.mesh_stats(back)}, uvs={back.uvs is not None}, "
      f"colors={back.vertex_colors is not None}, normals={back.normals is not None}")

# bake: high = original welded sphere, low = unwrapped decimated sphere
nm = ops.bake_normal_map(mu2, m, resolution=256, cage_distance=0.05)
assert nm.shape == (1, 256, 256, 3)
print(f"[ok] bake normal map: {tuple(nm.shape)}, mean {nm.mean():.3f}")

ao = ops.bake_ambient_occlusion(mu2, m, resolution=256, samples=16)
assert ao.shape == (1, 256, 256, 3)
print(f"[ok] bake AO: {tuple(ao.shape)}, mean {ao.mean():.3f}")

baked = ops.apply_textures(mu2, occlusion=ao, normal_map=nm)
assert baked.normal_map is not None and baked.tangents is not None
assert baked.metallic_roughness is not None and baked.occlusion_in_mr
glb2 = mesh_item_to_glb_bytes(baked, 0)
assert glb2[:4] == b'glTF'
print(f"[ok] baked glb export: {len(glb2)} bytes")

# export round-trips
from mesh3d.io3d import export_obj_bytes, export_stl_bytes
obj_bytes = export_obj_bytes(mu2, 0)
obj_back = load_mesh_bytes(obj_bytes, 'obj')
st = ops.mesh_stats(obj_back)
assert st['faces'] == ops.mesh_stats(mu2)['faces']
print(f"[ok] obj export+reparse: {len(obj_bytes)} bytes, {st}, uvs={obj_back.uvs is not None}, "
      f"colors={obj_back.vertex_colors is not None}")

stl_bytes = export_stl_bytes(mu2, 0)
stl_back = load_mesh_bytes(stl_bytes, 'stl')
assert ops.mesh_stats(stl_back)['faces'] == ops.mesh_stats(mu2)['faces']
print(f"[ok] stl export+reparse: {len(stl_bytes)} bytes, {ops.mesh_stats(stl_back)}")

# primitives
from mesh3d.primitives import make_primitive
for kind in ('cube', 'sphere', 'cylinder', 'cone', 'plane', 'torus'):
    prim = make_primitive(kind, size=1.0, segments=24)
    st = ops.mesh_stats(prim)
    assert st['faces'] > 0 and prim.uvs is not None and prim.normals is not None
    glb_p = mesh_item_to_glb_bytes(prim, 0)
    assert glb_p[:4] == b'glTF'
    print(f"[ok] primitive {kind}: {st}")

# subdivide: 4x faces per iteration, uvs carried
msub, st = ops.subdivide(mu2, iterations=1)
assert st['faces_out'] == 4 * st['faces_in'] and msub.uvs is not None
print(f"[ok] subdivide: {st}")

# boolean: cube vs corner-offset sphere
from mesh3d.core import get_mesh_batch_item
cube = make_primitive('cube', size=1.0, segments=8)
sph = make_primitive('sphere', size=1.2, segments=24)
sv, sf, _, _, _ = get_mesh_batch_item(sph, 0)
sph_shift = pack_variable_mesh_batch([sv + torch.tensor([0.5, 0.5, 0.5])], [sf])
for op_name in ('union', 'difference', 'intersect'):
    bout, st = ops.boolean(cube, sph_shift, op=op_name, resolution=96)
    assert st['faces_out'] > 0
    glb_b = mesh_item_to_glb_bytes(ops.smooth_normals(bout, 180.0), 0)
    assert glb_b[:4] == b'glTF'
    print(f"[ok] boolean {op_name}: {st}")

# transform_b: gizmo TRS applied to B before CSG (same offset via transform instead of baked verts)
trs = {'position': [0.5, 0.5, 0.5], 'quaternion': [0, 0, 0, 1], 'scale': [1, 1, 1]}
bt, st_t = ops.boolean(cube, sph, op='difference', resolution=96, transform_b=trs)
bs, st_s = ops.boolean(cube, sph_shift, op='difference', resolution=96)
assert abs(st_t['faces_out'] - st_s['faces_out']) < st_s['faces_out'] * 0.02
p = ops.apply_trs(torch.tensor([[1.0, 0.0, 0.0]]),
                  {'quaternion': [0, 0, 0.7071068, 0.7071068], 'position': [0, 0, 1]})
assert torch.allclose(p, torch.tensor([[0.0, 1.0, 1.0]]), atol=1e-5)
print(f"[ok] boolean transform_b: {st_t['faces_out']} vs baked {st_s['faces_out']}; quat rotate ok")

print("ALL OK")
