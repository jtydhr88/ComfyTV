import pytest

torch = pytest.importorskip("torch")

from ComfyTV.mesh3d.core import MESH, get_mesh_batch_item, pack_variable_mesh_batch


def _tri(n_offset=0.0):
    v = torch.tensor([[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0]]) + n_offset
    f = torch.tensor([[0, 1, 2]], dtype=torch.long)
    return v, f


def test_pack_single_item_counts():
    v, f = _tri()
    m = pack_variable_mesh_batch([v], [f])
    assert isinstance(m, MESH)
    assert m.vertices.shape == (1, 3, 3)
    assert m.faces.shape == (1, 1, 3)
    assert int(m.vertex_counts[0]) == 3
    assert int(m.face_counts[0]) == 1


def test_pack_variable_sizes_pads_and_slices():
    v1, f1 = _tri()
    v2 = torch.cat([v1, torch.tensor([[1.0, 1.0, 0.0]])])
    f2 = torch.tensor([[0, 1, 2], [1, 3, 2]], dtype=torch.long)
    c1 = torch.rand(3, 3)
    c2 = torch.rand(4, 3)
    u1 = torch.rand(3, 2)
    u2 = torch.rand(4, 2)
    m = pack_variable_mesh_batch([v1, v2], [f1, f2], colors=[c1, c2], uvs=[u1, u2])
    assert m.vertices.shape == (2, 4, 3)
    assert m.faces.shape == (2, 2, 3)

    va, fa, ca, ua, na = get_mesh_batch_item(m, 0)
    assert va.shape == (3, 3) and fa.shape == (1, 3)
    assert torch.allclose(va, v1) and torch.allclose(ca, c1) and torch.allclose(ua, u1)
    assert na is None

    vb, fb, cb, ub, _ = get_mesh_batch_item(m, 1)
    assert vb.shape == (4, 3) and fb.shape == (2, 3)
    assert torch.allclose(cb, c2) and torch.allclose(ub, u2)


def test_pack_normals_and_tangents():
    v, f = _tri()
    n = torch.nn.functional.normalize(torch.rand(3, 3), dim=-1)
    t = torch.rand(3, 4)
    m = pack_variable_mesh_batch([v], [f], normals=[n], tangents=[t])
    _, _, _, _, ni = get_mesh_batch_item(m, 0)
    assert torch.allclose(ni, n)
    assert m.tangents.shape == (1, 3, 4)


def test_pack_mismatched_attr_raises():
    v, f = _tri()
    with pytest.raises(AssertionError):
        pack_variable_mesh_batch([v], [f], colors=[torch.rand(2, 3)])


def test_get_item_without_counts():
    v, f = _tri()
    m = MESH(v.unsqueeze(0), f.unsqueeze(0))
    va, fa, ca, ua, na = get_mesh_batch_item(m, 0)
    assert va.shape == (3, 3) and fa.shape == (1, 3)
    assert ca is None and ua is None and na is None
