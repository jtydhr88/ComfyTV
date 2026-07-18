import logging

import pytest

torch = pytest.importorskip("torch")
pytest.importorskip("scipy")

from ComfyTV.mesh3d import ops
from ComfyTV.mesh3d.primitives import make_primitive
from mesh3d_utils import boundary_edge_count, item, offset

RES = 64
CUBE = make_primitive('cube', size=1.0, segments=8)
SPHERE = offset(make_primitive('sphere', size=1.2, segments=16), 0.5, 0.5, 0.5)


@pytest.mark.parametrize('op', ('union', 'difference', 'intersect'))
def test_boolean_ops_produce_clean_meshes(op):
    out, st = ops.boolean(CUBE, SPHERE, op=op, resolution=RES)
    assert st['faces_out'] > 0
    v, f, _, _, _ = item(out)
    assert boundary_edge_count(v, f, weld_first=False) <= 12


def test_boolean_volume_ordering():
    faces = {}
    for op in ('union', 'difference', 'intersect'):
        _, st = ops.boolean(CUBE, SPHERE, op=op, resolution=RES)
        faces[op] = st['faces_out']
    assert faces['union'] > faces['difference'] > faces['intersect']


def test_transform_b_equivalent_to_baked_verts():
    sphere0 = make_primitive('sphere', size=1.2, segments=16)
    trs = {'position': [0.5, 0.5, 0.5], 'quaternion': [0, 0, 0, 1], 'scale': [1, 1, 1]}
    a, st_a = ops.boolean(CUBE, sphere0, op='difference', resolution=RES, transform_b=trs)
    b, st_b = ops.boolean(CUBE, SPHERE, op='difference', resolution=RES)
    assert st_a['faces_out'] == st_b['faces_out']


def test_transform_a_equivalent_to_baked_verts():
    sphere0 = make_primitive('sphere', size=1.2, segments=16)
    trs = {'position': [0.5, 0.5, 0.5], 'quaternion': [0, 0, 0, 1], 'scale': [1, 1, 1]}
    a, st_a = ops.boolean(sphere0, CUBE, op='difference', resolution=RES, transform_a=trs)
    b, st_b = ops.boolean(SPHERE, CUBE, op='difference', resolution=RES)
    assert st_a['faces_out'] == st_b['faces_out']


def test_disjoint_intersect_raises():
    far = offset(make_primitive('sphere', size=0.5, segments=12), 10.0, 0.0, 0.0)
    with pytest.raises(RuntimeError):
        ops.boolean(CUBE, far, op='intersect', resolution=RES)


def test_invalid_op_raises():
    with pytest.raises(ValueError):
        ops.boolean(CUBE, SPHERE, op='xor', resolution=RES)


def test_open_mesh_falls_back_to_normal_sign(caplog):
    plane = offset(make_primitive('plane', size=1.5, segments=8), 0.0, 0.0, 0.2)
    with caplog.at_level(logging.WARNING):
        out, st = ops.boolean(CUBE, plane, op='union', resolution=RES)
    assert st['faces_out'] > 0
    assert any('open' in r.message for r in caplog.records)


def test_vertex_colors_carry_through():
    v, f, _, _, _ = item(CUBE)
    from ComfyTV.mesh3d.core import pack_variable_mesh_batch
    red = pack_variable_mesh_batch([v], [f], colors=[torch.tensor([[1.0, 0.0, 0.0]]).repeat(v.shape[0], 1)])
    out, _ = ops.boolean(red, SPHERE, op='difference', resolution=RES)
    assert out.vertex_colors is not None
    _, _, c, _, _ = item(out)
    assert float(c[:, 0].mean()) > 0.5
