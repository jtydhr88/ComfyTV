"""runners/geometry.py plumbing with the mesh3d package mocked — runs on CI
without torch. Verifies URL localize/save round-trips, argument forwarding and
error paths; the real algorithms are covered by the (torch-gated) mesh3d tier."""

from __future__ import annotations

import os
import sys
import types

import pytest

np = pytest.importorskip("numpy")

from ComfyTV.runners import geometry as rg
from ComfyTV.runners.media import view_url_to_path


class FakeMesh:
    def __init__(self, uvs="yes"):
        self.uvs = uvs
        self.vertex_colors = None
        self.normals = None
        self.texture = None


class FakeMap:
    """Mimics the tensor chain bake_maps_model uses: m[0].clamp(0,1).cpu().numpy()."""

    def __getitem__(self, _):
        return self

    def clamp(self, *_):
        return self

    def cpu(self):
        return self

    def numpy(self):
        return np.zeros((8, 8, 3), dtype=np.float32)


@pytest.fixture()
def model_url():
    import folder_paths
    base = folder_paths.get_input_directory()
    os.makedirs(base, exist_ok=True)
    path = os.path.join(base, "m.glb")
    with open(path, "wb") as fh:
        fh.write(b"glTF-fake")
    return "/view?filename=m.glb&type=input"


@pytest.fixture()
def fake_mesh3d(monkeypatch):
    seen: dict = {}
    mesh = FakeMesh()

    def record(name, ret):
        def fn(*args, **kwargs):
            seen.setdefault(name, []).append({"args": args, "kwargs": kwargs})
            return ret
        return fn

    ops = types.ModuleType("ComfyTV.mesh3d.ops")
    ops.mesh_stats = record("mesh_stats", {"vertices": 3, "faces": 1})
    ops.smooth_normals = record("smooth_normals", mesh)
    ops.decimate = record("decimate", (mesh, {"faces_in": 10, "faces_out": 5}))
    ops.remesh = record("remesh", (mesh, {"faces_in": 10, "faces_out": 20}))
    ops.weld = record("weld", (mesh, {"welded": 2}))
    ops.fill_holes = record("fill_holes", (mesh, {"faces_in": 10, "faces_out": 12}))
    ops.subdivide = record("subdivide", (mesh, {"faces_in": 10, "faces_out": 40}))
    ops.unwrap = record("unwrap", (mesh, {"faces": 10}))
    ops.render_uv_atlas = record("render_uv_atlas", np.zeros((16, 16, 3), dtype=np.float32))
    ops.boolean = record("boolean", (mesh, {"faces_out": 9, "op": "union"}))
    ops.bake_normal_map = record("bake_normal_map", FakeMap())
    ops.bake_ambient_occlusion = record("bake_ambient_occlusion", FakeMap())
    ops.apply_textures = record("apply_textures", mesh)

    io3d = types.ModuleType("ComfyTV.mesh3d.io3d")
    io3d.load_mesh_bytes = record("load_mesh_bytes", mesh)
    io3d.mesh_item_to_glb_bytes = record("glb_bytes", b"glTF-out")
    io3d.export_obj_bytes = record("obj_bytes", b"# obj")
    io3d.export_stl_bytes = record("stl_bytes", b"\x00" * 84)

    prims = types.ModuleType("ComfyTV.mesh3d.primitives")
    prims.make_primitive = record("make_primitive", mesh)

    import ComfyTV.mesh3d as pkg
    for name, mod in (("ops", ops), ("io3d", io3d), ("primitives", prims)):
        monkeypatch.setitem(sys.modules, f"ComfyTV.mesh3d.{name}", mod)
        monkeypatch.setattr(pkg, name, mod, raising=False)
    seen["mesh"] = mesh
    return seen


def _out_path(url, suffix):
    p = view_url_to_path(url)
    assert p is not None and p.suffix == suffix
    return p


def test_load_model_mesh_requires_url(fake_mesh3d):
    with pytest.raises(RuntimeError):
        rg.load_model_mesh("")
    with pytest.raises(RuntimeError):
        rg.load_model_mesh("/view?filename=missing.glb&type=input")


def test_decimate_model_roundtrip(fake_mesh3d, model_url):
    payload, stats = rg.decimate_model(model_url, 500, placement_mode="qem")
    _out_path(payload, ".glb")
    assert stats["faces_out"] == 5
    assert fake_mesh3d["decimate"][0]["kwargs"]["placement_mode"] == "qem"
    assert fake_mesh3d["smooth_normals"]


def test_remesh_weld_fill_subdivide(fake_mesh3d, model_url):
    for fn, key, kwargs in (
        (rg.remesh_model, "remesh", {"resolution": 128, "sign_mode": "sdf"}),
        (rg.weld_model, "weld", {"epsilon_rel": 1e-4}),
        (rg.fill_holes_model, "fill_holes", {"max_perimeter": 0.1}),
        (rg.subdivide_model, "subdivide", {"iterations": 2}),
    ):
        payload, stats = fn(model_url, **kwargs)
        _out_path(payload, ".glb")
        assert key in fake_mesh3d


def test_smooth_normals_model(fake_mesh3d, model_url):
    payload, stats = rg.smooth_normals_model(model_url, crease_angle=45.0)
    _out_path(payload, ".glb")
    assert fake_mesh3d["smooth_normals"][0]["kwargs"]["crease_angle"] == 45.0
    assert stats == {"vertices": 3, "faces": 1}


def test_unwrap_model_writes_atlas(fake_mesh3d, model_url):
    payload, atlas_url, stats = rg.unwrap_model(model_url, resolution=512, atlas_preview=64)
    _out_path(payload, ".glb")
    _out_path(atlas_url, ".png")
    assert fake_mesh3d["unwrap"][0]["kwargs"]["resolution"] == 512


def test_unwrap_model_can_skip_atlas(fake_mesh3d, model_url):
    _, atlas_url, _ = rg.unwrap_model(model_url, atlas_preview=0)
    assert atlas_url == ""
    assert "render_uv_atlas" not in fake_mesh3d


def test_primitive_model(fake_mesh3d):
    payload, stats = rg.primitive_model("torus", size=2.0, segments=12)
    _out_path(payload, ".glb")
    assert fake_mesh3d["make_primitive"][0]["args"][0] == "torus"


def test_boolean_model_forwards_transform(fake_mesh3d, model_url):
    trs = {"position": [1, 0, 0]}
    payload, stats = rg.boolean_model(model_url, model_url, op="difference",
                                      resolution=96, transform_b=trs)
    _out_path(payload, ".glb")
    kw = fake_mesh3d["boolean"][0]["kwargs"]
    assert kw["op"] == "difference" and kw["transform_b"] == trs


@pytest.mark.parametrize("fmt,suffix,key", [
    ("glb", ".glb", "glb_bytes"),
    ("obj", ".obj", "obj_bytes"),
    ("stl", ".stl", "stl_bytes"),
])
def test_export_model_formats(fake_mesh3d, model_url, fmt, suffix, key):
    payload, _ = rg.export_model(model_url, fmt=fmt)
    _out_path(payload, suffix)
    assert key in fake_mesh3d


def test_export_model_bad_format(fake_mesh3d, model_url):
    with pytest.raises(RuntimeError):
        rg.export_model(model_url, fmt="fbx")


def test_bake_maps_model_both(fake_mesh3d, model_url):
    payload, preview, stats = rg.bake_maps_model(model_url, model_url,
                                                 resolution=128, ao_samples=8)
    _out_path(payload, ".glb")
    _out_path(preview, ".png")
    assert stats["baked"] == ["normal", "ao"]
    assert fake_mesh3d["bake_normal_map"] and fake_mesh3d["bake_ambient_occlusion"]
    assert fake_mesh3d["apply_textures"]


def test_bake_maps_model_single_and_none(fake_mesh3d, model_url):
    payload, preview, stats = rg.bake_maps_model(model_url, model_url, bake_ao=False)
    assert stats["baked"] == ["normal"]
    with pytest.raises(RuntimeError):
        rg.bake_maps_model(model_url, model_url, bake_normal=False, bake_ao=False)


def test_bake_maps_model_requires_uvs(fake_mesh3d, model_url):
    fake_mesh3d["mesh"].uvs = None
    with pytest.raises(RuntimeError):
        rg.bake_maps_model(model_url, model_url)


def test_get_model_info(fake_mesh3d, model_url):
    info = rg.get_model_info(model_url)
    assert info["faces"] == 1
    assert info["has_uvs"] is True and info["has_texture"] is False
