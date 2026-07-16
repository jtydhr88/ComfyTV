import pytest

torch = pytest.importorskip("torch")
pytest.importorskip("scipy")

from ComfyTV.mesh3d.ops import mesh_stats
from ComfyTV.mesh3d.primitives import (
    make_box, make_cylinder, make_plane, make_primitive, make_sphere, make_torus,
)
from mesh3d_utils import boundary_edge_count, item

KINDS = ('cube', 'sphere', 'cylinder', 'cone', 'plane', 'torus')


@pytest.mark.parametrize('kind', KINDS)
def test_primitive_basics(kind):
    m = make_primitive(kind, size=1.0, segments=24)
    v, f, _, u, n = item(m)
    assert f.shape[0] > 0
    assert u is not None and n is not None
    assert torch.allclose(n.norm(dim=-1), torch.ones(n.shape[0]), atol=1e-4)
    # three.js sphere pole rows carry a +-0.5/widthSegments u offset
    assert float(u.min()) >= -0.5 / 24 - 1e-6
    assert float(u.max()) <= 1.0 + 0.5 / 24 + 1e-6
    assert int(f.max()) < v.shape[0]


@pytest.mark.parametrize('kind', ('cube', 'sphere', 'cylinder', 'cone', 'torus'))
def test_solid_primitives_are_closed(kind):
    m = make_primitive(kind, size=1.0, segments=24)
    v, f, _, _, _ = item(m)
    assert boundary_edge_count(v, f) == 0


def test_face_counts_match_threejs_formulas():
    ws, hs = 16, 8
    assert mesh_stats(make_sphere(0.5, ws, hs))['faces'] == ws * (2 * hs - 2)

    s = 3
    assert mesh_stats(make_box(1, 1, 1, s, s, s))['faces'] == 6 * s * s * 2
    assert mesh_stats(make_plane(1, 1, s, s))['faces'] == s * s * 2

    rs, h = 16, 2
    assert mesh_stats(make_cylinder(0.5, 0.5, 1.0, rs, h))['faces'] == rs * h * 2 + rs * 2
    assert mesh_stats(make_cylinder(0.0, 0.5, 1.0, rs, 1))['faces'] == rs + rs

    r, t = 8, 16
    assert mesh_stats(make_torus(0.5, 0.2, r, t))['faces'] == r * t * 2


def test_cone_apex_and_sphere_poles_are_exact():
    v, _, _, _, _ = item(make_sphere(0.5, 12, 6))
    top = v[v[:, 1] > 0.499]
    assert torch.allclose(top[:, 0].abs().max(), torch.tensor(0.0))
    assert torch.allclose(top[:, 2].abs().max(), torch.tensor(0.0))


def test_size_scales_bbox():
    v, _, _, _, _ = item(make_primitive('cube', size=2.0, segments=8))
    assert float(v.max()) == pytest.approx(1.0)
    assert float(v.min()) == pytest.approx(-1.0)


def test_unknown_kind_raises():
    with pytest.raises(ValueError):
        make_primitive('teapot')
