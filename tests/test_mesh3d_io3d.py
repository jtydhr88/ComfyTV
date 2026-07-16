import pytest

np = pytest.importorskip("numpy")
torch = pytest.importorskip("torch")
pytest.importorskip("scipy")

from PIL import Image

from ComfyTV.mesh3d.core import pack_variable_mesh_batch
from ComfyTV.mesh3d.io3d import (
    export_obj_bytes, export_stl_bytes, load_mesh_bytes, mesh_item_to_glb_bytes, save_glb,
)
from ComfyTV.mesh3d.ops import mesh_stats, smooth_normals
from ComfyTV.mesh3d.primitives import make_primitive
from mesh3d_utils import item


@pytest.fixture()
def cube():
    return make_primitive('cube', size=1.0, segments=8)


def test_glb_roundtrip_keeps_attributes(cube):
    v, f, _, u, n = item(cube)
    colors = torch.rand(v.shape[0], 3)
    m = pack_variable_mesh_batch([v], [f], colors=[colors], uvs=[u], normals=[n])
    blob = mesh_item_to_glb_bytes(m, 0)
    assert blob[:4] == b'glTF'

    back = load_mesh_bytes(blob, 'glb')
    st = mesh_stats(back)
    assert st['faces'] == f.shape[0]
    assert back.uvs is not None and back.vertex_colors is not None and back.normals is not None
    vb, fb, cb, ub, _ = item(back)
    assert torch.allclose(vb, v, atol=1e-5)
    assert torch.allclose(cb, colors, atol=2e-3)


def test_glb_texture_roundtrip(cube):
    v, f, _, u, _ = item(cube)
    tex = torch.rand(1, 16, 16, 3)
    m = pack_variable_mesh_batch([v], [f], uvs=[u], texture=tex)
    back = load_mesh_bytes(mesh_item_to_glb_bytes(m, 0), 'glb')
    assert back.texture is not None
    assert tuple(back.texture.shape) == (1, 16, 16, 3)


def test_save_glb_validates_inputs():
    v = torch.zeros(0, 3)
    f = torch.zeros((0, 3), dtype=torch.long)
    with pytest.raises(ValueError):
        save_glb(v, f)
    v = torch.rand(3, 3)
    bad_f = torch.tensor([[0, 1, 5]], dtype=torch.long)
    with pytest.raises(ValueError):
        save_glb(v, bad_f)
    with pytest.raises(ValueError):
        save_glb(v, torch.tensor([[0, 1, 2]], dtype=torch.long), uvs=torch.rand(2, 2))


def test_obj_roundtrip_uvs_colors(cube):
    m = smooth_normals(cube, crease_angle=180.0)
    v, f, _, _, _ = item(m)
    colors = torch.rand(v.shape[0], 3)
    m2 = pack_variable_mesh_batch([v], [f], colors=[colors], uvs=[m.uvs[0, :v.shape[0]]],
                                  normals=[m.normals[0, :v.shape[0]]])
    blob = export_obj_bytes(m2, 0)
    back = load_mesh_bytes(blob, 'obj')
    assert mesh_stats(back)['faces'] == f.shape[0]
    assert back.uvs is not None and back.vertex_colors is not None
    ub, _, cb, uu, _ = item(back)
    assert torch.allclose(torch.sort(cb.reshape(-1))[0],
                          torch.sort(colors.reshape(-1))[0], atol=1e-3)


def test_stl_roundtrip(cube):
    v, f, _, _, _ = item(cube)
    blob = export_stl_bytes(cube, 0)
    back = load_mesh_bytes(blob, 'stl')
    assert mesh_stats(back)['faces'] == f.shape[0]
    assert mesh_stats(back)['vertices'] == f.shape[0] * 3


def test_export_empty_raises():
    m = pack_variable_mesh_batch([torch.rand(3, 3)], [torch.zeros((0, 3), dtype=torch.long)])
    with pytest.raises(ValueError):
        export_obj_bytes(m, 0)
    with pytest.raises(ValueError):
        export_stl_bytes(m, 0)
    assert mesh_item_to_glb_bytes(m, 0) is None


def test_load_rejects_fbx_and_unknown():
    with pytest.raises(ValueError):
        load_mesh_bytes(b'anything', 'fbx')
    with pytest.raises(ValueError):
        load_mesh_bytes(b'\x00\x01\x02\x03', 'bin')


def test_obj_negative_indices_and_quads():
    obj = (b"v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\n"
           b"f -4 -3 -2 -1\n")
    back = load_mesh_bytes(obj, 'obj')
    assert mesh_stats(back)['faces'] == 2


def test_ascii_stl():
    stl = (b"solid t\n facet normal 0 0 1\n  outer loop\n"
           b"   vertex 0 0 0\n   vertex 1 0 0\n   vertex 0 1 0\n"
           b"  endloop\n endfacet\nendsolid t\n")
    back = load_mesh_bytes(stl, 'stl')
    assert mesh_stats(back)['faces'] == 1
