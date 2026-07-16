import pytest

torch = pytest.importorskip("torch")
pytest.importorskip("scipy")

from ComfyTV.mesh3d import ops
from ComfyTV.mesh3d.core import pack_variable_mesh_batch
from ComfyTV.mesh3d.primitives import make_primitive
from mesh3d_utils import item

CUBE = make_primitive('cube', size=1.0, segments=16)


def _no_uv_mesh():
    v, f, _, _, _ = item(CUBE)
    return pack_variable_mesh_batch([v], [f])


@pytest.fixture(scope="module")
def unwrapped():
    small, _ = ops.decimate(CUBE, target_face_count=60)
    out, _ = ops.unwrap(small, segmenter='pec', resolution=256, padding=1)
    return ops.smooth_normals(out, crease_angle=180.0)


def test_bake_normal_map_shape_and_range(unwrapped):
    img = ops.bake_normal_map(unwrapped, CUBE, resolution=64, cage_distance=0.05)
    assert tuple(img.shape) == (1, 64, 64, 3)
    assert float(img.min()) >= 0.0 and float(img.max()) <= 1.0
    assert float(img[..., 2].mean()) > 0.5


def test_bake_ao_shape_and_range(unwrapped):
    img = ops.bake_ambient_occlusion(unwrapped, CUBE, resolution=64, samples=8)
    assert tuple(img.shape) == (1, 64, 64, 3)
    assert float(img.min()) >= 0.0 and float(img.max()) <= 1.0


def test_bake_requires_uvs():
    bare = _no_uv_mesh()
    with pytest.raises(ValueError):
        ops.bake_normal_map(bare, CUBE, resolution=32)
    with pytest.raises(ValueError):
        ops.bake_ambient_occlusion(bare, CUBE, resolution=32)


def test_apply_textures_attaches_maps(unwrapped):
    nm = torch.full((1, 32, 32, 3), 0.5)
    ao = torch.ones((1, 32, 32, 3))
    out = ops.apply_textures(unwrapped, occlusion=ao, normal_map=nm)
    assert out.normal_map is not None and out.tangents is not None
    assert out.metallic_roughness is not None and out.occlusion_in_mr
    assert tuple(out.metallic_roughness.shape[-1:]) == (3,)


def test_apply_textures_requires_uvs():
    with pytest.raises(ValueError):
        ops.apply_textures(_no_uv_mesh(), normal_map=torch.rand(1, 8, 8, 3))
