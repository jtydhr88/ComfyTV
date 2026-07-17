import math

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


def test_open_ended_cylinder_drops_caps():
    rs, h = 16, 1
    closed = mesh_stats(make_cylinder(0.5, 0.5, 1.0, rs, h))['faces']
    opened = make_cylinder(0.5, 0.5, 1.0, rs, h, open_ended=True)
    assert mesh_stats(opened)['faces'] == rs * h * 2
    assert closed == rs * h * 2 + rs * 2
    v, f, _, _, _ = item(opened)
    assert boundary_edge_count(v, f) > 0


def test_partial_torus_is_open():
    v, f, _, _, _ = item(make_torus(0.5, 0.2, 8, 16, arc=math.pi))
    assert boundary_edge_count(v, f) > 0


def test_partial_sphere_is_open_but_normals_stay_unit():
    m = make_sphere(0.5, 16, 8, theta_start=0.0, theta_length=math.pi / 2)
    v, f, _, _, n = item(m)
    assert boundary_edge_count(v, f) > 0
    assert torch.allclose(n.norm(dim=-1), torch.ones(n.shape[0]), atol=1e-4)
    assert float(v[:, 1].min()) >= -1e-4


def test_full_sphere_stays_closed_with_explicit_full_ranges():
    m = make_sphere(0.5, 24, 12, phi_length=2 * math.pi, theta_length=math.pi)
    v, f, _, _, _ = item(m)
    assert boundary_edge_count(v, f) == 0


def test_recipe_box_honours_per_axis_dims():
    v, _, _, _, _ = item(make_primitive('cube', width=2.0, height=1.0, depth=0.5))
    assert float(v[:, 0].max()) == pytest.approx(1.0)
    assert float(v[:, 1].max()) == pytest.approx(0.5)
    assert float(v[:, 2].max()) == pytest.approx(0.25)


def test_recipe_matches_direct_builder_call():
    recipe = make_primitive('cylinder', radiusTop=0.0, radiusBottom=1.0, height=2.0,
                            radialSegments=16, heightSegments=1)
    direct = make_cylinder(0.0, 1.0, 2.0, 16, 1)
    assert mesh_stats(recipe)['faces'] == mesh_stats(direct)['faces']


def test_recipe_cone_maps_radius_to_bottom():
    cone = make_primitive('cone', radius=0.5, height=1.0, radialSegments=24)
    v, _, _, _, _ = item(cone)
    assert float(v[:, 1].max()) == pytest.approx(0.5)
    assert float(v[:, 0].abs().max()) == pytest.approx(0.5, abs=1e-3)


def test_recipe_unknown_kind_raises():
    with pytest.raises(ValueError):
        make_primitive('teapot', width=1.0)
