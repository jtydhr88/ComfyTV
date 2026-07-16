"""MeshOpStage dispatch + the primitive/boolean/bake stages, with the runner
functions mocked — runs on CI without torch (the algorithm tier lives in the
test_mesh3d_* modules and skips when torch is absent)."""

from __future__ import annotations

import json

import pytest

from ComfyTV.nodes.stages import geometry

MODEL_URL = "/view?filename=m.glb&type=input"


@pytest.fixture()
def calls(monkeypatch):
    seen: dict = {}

    def record(name, payload="/view?filename=out.glb&type=output", extra=None):
        def fn(*args, **kwargs):
            seen[name] = {"args": args, "kwargs": kwargs}
            if extra is not None:
                return (payload, *extra)
            return payload, {"faces_out": 7}
        return fn

    monkeypatch.setattr(geometry, "decimate_model", record("decimate"))
    monkeypatch.setattr(geometry, "remesh_model", record("remesh"))
    monkeypatch.setattr(geometry, "weld_model", record("weld"))
    monkeypatch.setattr(geometry, "fill_holes_model", record("fill_holes"))
    monkeypatch.setattr(geometry, "smooth_normals_model", record("smooth_normals"))
    monkeypatch.setattr(geometry, "subdivide_model", record("subdivide"))
    monkeypatch.setattr(geometry, "export_model", record("export"))
    monkeypatch.setattr(geometry, "unwrap_model",
                        record("unwrap", extra=("/view?filename=atlas.png&type=output",
                                                {"faces": 7})))
    monkeypatch.setattr(geometry, "primitive_model", record("primitive"))
    monkeypatch.setattr(geometry, "boolean_model", record("boolean"))
    monkeypatch.setattr(geometry, "bake_maps_model",
                        record("bake", extra=("/view?filename=maps.png&type=output",
                                              {"baked": ["normal", "ao"]})))
    return seen


class TestSchemas:
    @pytest.mark.parametrize("cls_name", [
        "MeshOpStage", "MeshPrimitiveStage", "MeshBooleanStage", "MeshBakeMapsStage",
    ])
    def test_define_schema(self, cls_name):
        cls = getattr(geometry, cls_name)
        schema = cls.define_schema()
        assert "node_id" in schema.kw

    def test_operation_options_match_dispatch(self):
        assert set(geometry.MESH_OPERATIONS) == {
            'decimate', 'remesh', 'weld', 'fill_holes', 'smooth_normals',
            'subdivide', 'unwrap', 'export',
        }


class TestMeshOpDispatch:
    @pytest.mark.parametrize("operation", geometry.MESH_OPERATIONS)
    def test_each_operation_calls_its_runner(self, reset_db, calls, operation):
        out = geometry.MeshOpStage.execute(project_id="default",
                                           operation=operation, model=MODEL_URL)
        assert operation in calls
        assert "out.glb" in out.values[0]

    def test_decimate_passes_params(self, reset_db, calls):
        geometry.MeshOpStage.execute(project_id="default", operation="decimate",
                                     model=MODEL_URL, target_face_count=1234,
                                     placement_mode="qem",
                                     feature_edge_quadric_weight=5.0)
        kw = calls["decimate"]["kwargs"]
        args = calls["decimate"]["args"]
        assert args[1] == 1234
        assert kw["placement_mode"] == "qem"
        assert kw["feature_edge_quadric_weight"] == 5.0

    def test_unwrap_emits_atlas_as_picked(self, reset_db, calls):
        out = geometry.MeshOpStage.execute(project_id="default", operation="unwrap",
                                           model=MODEL_URL, atlas_resolution=512,
                                           captured_image="/view?filename=cap.png")
        assert calls["unwrap"]["kwargs"]["resolution"] == 512
        assert "atlas.png" in out.values[1]

    def test_other_ops_emit_captured_image(self, reset_db, calls):
        out = geometry.MeshOpStage.execute(project_id="default", operation="weld",
                                           model=MODEL_URL,
                                           captured_image="/view?filename=cap.png")
        assert "cap.png" in out.values[1]

    def test_export_passes_format(self, reset_db, calls):
        geometry.MeshOpStage.execute(project_id="default", operation="export",
                                     model=MODEL_URL, format="stl")
        assert calls["export"]["kwargs"]["fmt"] == "stl"

    def test_missing_model_raises(self, reset_db, calls):
        with pytest.raises(RuntimeError):
            geometry.MeshOpStage.execute(project_id="default", operation="decimate",
                                         model="")
        assert not calls

    def test_unknown_operation_raises(self, reset_db, calls):
        with pytest.raises(RuntimeError):
            geometry.MeshOpStage.execute(project_id="default", operation="teleport",
                                         model=MODEL_URL)


class TestPrimitiveStage:
    def test_execute(self, reset_db, calls):
        out = geometry.MeshPrimitiveStage.execute(project_id="default", kind="torus",
                                                  size=2.0, segments=16)
        assert calls["primitive"]["args"][0] == "torus"
        assert calls["primitive"]["kwargs"] == {"size": 2.0, "segments": 16}
        assert "out.glb" in out.values[0]


class TestBooleanStage:
    def test_execute_passes_transform(self, reset_db, calls):
        trs = {"position": [1, 2, 3], "quaternion": [0, 0, 0, 1], "scale": [1, 1, 1]}
        geometry.MeshBooleanStage.execute(project_id="default", operation="difference",
                                          model=MODEL_URL, model_b=MODEL_URL,
                                          resolution=128,
                                          transform_b=json.dumps(trs))
        kw = calls["boolean"]["kwargs"]
        assert kw["op"] == "difference"
        assert kw["resolution"] == 128
        assert kw["transform_b"] == trs

    def test_bad_transform_json_is_ignored(self, reset_db, calls):
        geometry.MeshBooleanStage.execute(project_id="default", operation="union",
                                          model=MODEL_URL, model_b=MODEL_URL,
                                          transform_b="{not json")
        assert calls["boolean"]["kwargs"]["transform_b"] is None

    def test_missing_second_model_raises(self, reset_db, calls):
        with pytest.raises(RuntimeError):
            geometry.MeshBooleanStage.execute(project_id="default", operation="union",
                                              model=MODEL_URL, model_b="")


class TestBakeStage:
    def test_execute(self, reset_db, calls):
        out = geometry.MeshBakeMapsStage.execute(project_id="default", model=MODEL_URL,
                                                 high_poly=MODEL_URL, resolution=512,
                                                 bake_ao=False)
        kw = calls["bake"]["kwargs"]
        assert kw["bake_ao"] is False and kw["resolution"] == 512
        assert "maps.png" in out.values[1]

    def test_missing_high_poly_raises(self, reset_db, calls):
        with pytest.raises(RuntimeError):
            geometry.MeshBakeMapsStage.execute(project_id="default", model=MODEL_URL,
                                               high_poly="")
