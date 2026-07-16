import pytest

torch = pytest.importorskip("torch")
pytest.importorskip("scipy")

from ComfyTV.mesh3d.subdivide import max_edge_length, split_long_edges, subdivide_midpoint


def _quad():
    v = torch.tensor([[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [1.0, 1.0, 0.0], [0.0, 1.0, 0.0]])
    f = torch.tensor([[0, 1, 2], [0, 2, 3]], dtype=torch.long)
    return v, f


def test_midpoint_split_quadruples_faces_and_shares_midpoints():
    v, f = _quad()
    vo, fo, _, _ = subdivide_midpoint(v, f, iterations=1)
    assert fo.shape[0] == 4 * f.shape[0]
    # 4 originals + 5 unique edge midpoints (the diagonal is shared)
    assert vo.shape[0] == 4 + 5
    assert max_edge_length(vo, fo) == pytest.approx(max_edge_length(v, f) / 2, rel=1e-5)


def test_attributes_average_at_midpoints():
    v, f = _quad()
    colors = torch.tensor([[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0], [1.0, 1.0, 0.0]])
    uvs = v[:, :2].clone()
    vo, fo, co, uo = subdivide_midpoint(v, f, iterations=1, colors=colors, uvs=uvs)
    assert co.shape[0] == vo.shape[0] and uo.shape[0] == vo.shape[0]
    assert torch.allclose(uo, vo[:, :2], atol=1e-6)


def test_iterations_compound():
    v, f = _quad()
    _, fo, _, _ = subdivide_midpoint(v, f, iterations=2)
    assert fo.shape[0] == 16 * f.shape[0]


def test_smooth_iters_runs_and_keeps_topology():
    v, f = _quad()
    vo, fo, _, _ = subdivide_midpoint(v, f, iterations=2, smooth_iters=3)
    assert fo.shape[0] == 16 * f.shape[0]
    assert torch.isfinite(vo).all()


def test_split_long_edges_threshold():
    v, f = _quad()
    vo, fo, _ = split_long_edges(v, f, max_edge=0.4)
    assert max_edge_length(vo, fo) <= 0.4
    v2, f2, _ = split_long_edges(v, f, max_edge=10.0)
    assert f2.shape[0] == f.shape[0]


def test_split_long_edges_respects_max_iters():
    v, f = _quad()
    vo, fo, _ = split_long_edges(v, f, max_edge=1e-6, max_iters=2)
    assert fo.shape[0] == 16 * f.shape[0]


def test_split_carries_colors():
    v, f = _quad()
    colors = torch.rand(4, 3)
    _, fo, co = split_long_edges(v, f, max_edge=0.4, colors=colors)
    assert co is not None and co.shape[0] > 4
