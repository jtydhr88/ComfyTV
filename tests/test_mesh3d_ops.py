import math

import pytest

torch = pytest.importorskip("torch")
pytest.importorskip("scipy")

from ComfyTV.mesh3d import ops
from ComfyTV.mesh3d.core import pack_variable_mesh_batch
from ComfyTV.mesh3d.primitives import make_primitive, make_sphere
from mesh3d_utils import boundary_edge_count, item

CUBE = make_primitive('cube', size=1.0, segments=16)


def test_mesh_stats_counts():
    st = ops.mesh_stats(CUBE)
    assert st['faces'] == 6 * 2 * 2 * 2 and st['vertices'] > 0


def test_weld_merges_seam_duplicates():
    out, st = ops.weld(make_sphere(0.5, 16, 8), epsilon_rel=1e-5)
    assert st['welded'] > 0
    v_in = ops.mesh_stats(make_sphere(0.5, 16, 8))['vertices']
    assert ops.mesh_stats(out)['vertices'] < v_in


def test_fill_holes_closes_missing_face():
    v, f, _, _, _ = item(CUBE)
    holed = pack_variable_mesh_batch([v], [f[1:]])
    out, st = ops.fill_holes(holed, max_perimeter=2.0)
    vo, fo, _, _, _ = item(out)
    assert boundary_edge_count(vo, fo) == 0
    assert st['faces_out'] >= st['faces_in']


def test_smooth_normals_fully_smooth_and_crease():
    out = ops.smooth_normals(CUBE, crease_angle=180.0)
    assert out.normals is not None
    v, _, _, _, n = item(out)
    assert torch.allclose(n.norm(dim=-1), torch.ones(n.shape[0]), atol=1e-4)

    creased = ops.smooth_normals(CUBE, crease_angle=30.0)
    assert ops.mesh_stats(creased)['vertices'] >= ops.mesh_stats(out)['vertices']


def test_decimate_hits_target():
    out, st = ops.decimate(CUBE, target_face_count=100)
    assert 0 < st['faces_out'] <= 100
    assert st['faces_in'] == ops.mesh_stats(CUBE)['faces']
    same, st2 = ops.decimate(CUBE, target_face_count=10_000_000)
    assert st2['faces_out'] == st2['faces_in']


def test_decimate_qem_mode():
    out, st = ops.decimate(CUBE, target_face_count=80, placement_mode='qem',
                           feature_edge_quadric_weight=10.0)
    assert 0 < st['faces_out'] <= 80


def test_remesh_produces_closed_surface():
    out, st = ops.remesh(CUBE, resolution=64, sign_mode='udf')
    assert st['faces_out'] > 0
    vo, fo, _, _, _ = item(out)
    assert torch.isfinite(vo).all()


def test_subdivide_wrapper_carries_uvs():
    out, st = ops.subdivide(CUBE, iterations=1)
    assert st['faces_out'] == 4 * st['faces_in']
    assert out.uvs is not None


def test_unwrap_and_atlas():
    small, _ = ops.decimate(CUBE, target_face_count=60)
    out, st = ops.unwrap(small, segmenter='pec', resolution=256, padding=1)
    assert out.uvs is not None and st['faces'] > 0
    n = int(out.vertex_counts[0]) if out.vertex_counts is not None else out.uvs.shape[1]
    u = out.uvs[0, :n]
    assert float(u.min()) >= -1e-4 and float(u.max()) <= 1.0 + 1e-4

    img = ops.render_uv_atlas(out, resolution=64)
    assert img.shape == (64, 64, 3)

    v, f, _, _, _ = item(CUBE)
    with pytest.raises(RuntimeError):
        ops.render_uv_atlas(pack_variable_mesh_batch([v], [f]), resolution=64)


def test_apply_trs_matches_three_compose():
    p = ops.apply_trs(torch.tensor([[1.0, 0.0, 0.0]]),
                      {'quaternion': [0, 0, math.sin(math.pi / 4), math.cos(math.pi / 4)],
                       'position': [0, 0, 1], 'scale': [2, 2, 2]})
    assert torch.allclose(p, torch.tensor([[0.0, 2.0, 1.0]]), atol=1e-5)
    ident = ops.apply_trs(torch.tensor([[1.0, 2.0, 3.0]]), {})
    assert torch.allclose(ident, torch.tensor([[1.0, 2.0, 3.0]]))
