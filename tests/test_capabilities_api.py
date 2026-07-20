from __future__ import annotations

import tomllib
from pathlib import Path

import pytest
from aiohttp import FormData, web
from aiohttp.test_utils import TestClient, TestServer


@pytest.fixture()
def input_dir(tmp_path, monkeypatch):
    import folder_paths
    d = tmp_path / "input"
    d.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(folder_paths, "get_input_directory", lambda: str(d))
    return d


@pytest.fixture()
async def client(reset_db, input_dir):
    from ComfyTV import api  # noqa: F401 — registers routes on the stub PromptServer
    import server
    app = web.Application()
    app.router.add_routes(server.PromptServer.instance.routes)
    test_server = TestServer(app)
    test_client = TestClient(test_server)
    await test_client.start_server()
    yield test_client
    await test_client.close()


async def _caps(client) -> dict:
    resp = await client.get("/comfytv/capabilities")
    assert resp.status == 200
    return await resp.json()


async def _upload_lut(client, filename: str, payload: bytes = b"LUT_3D_SIZE 2\n") -> dict:
    fd = FormData()
    fd.add_field("kind", "lut")
    fd.add_field("file", payload, filename=filename)
    resp = await client.post("/comfytv/resources", data=fd)
    assert resp.status == 200
    return (await resp.json())["resource"]


class TestCapabilitiesEndpoint:
    async def test_shape(self, client):
        data = await _caps(client)
        assert set(data) == {"version", "node_ids", "resources", "resource_fields"}
        assert isinstance(data["version"], str) and data["version"]
        assert data["version"] != "unknown"
        assert data["node_ids"] == sorted(data["node_ids"])
        assert "ComfyTV.VideoColorStage" in data["node_ids"]
        assert "ComfyTV.VideoLUTStage" in data["node_ids"]
        assert set(data["resources"]) == {"lut", "font"}
        assert data["resources"]["lut"] == []
        assert data["resources"]["font"] == []
        assert data["resource_fields"]["ComfyTV.VideoLUTStage"] == {"lut_file": "lut"}

    async def test_version_matches_pyproject(self, client):
        import ComfyTV
        text = (Path(ComfyTV.__file__).resolve().parent / "pyproject.toml") \
            .read_text(encoding="utf-8")
        expected = tomllib.loads(text)["project"]["version"]
        assert (await _caps(client))["version"] == expected

    async def test_resources_reflect_registered_file(self, client, input_dir):
        row = await _upload_lut(client, "warm.cube")
        data = await _caps(client)
        assert data["resources"]["lut"] == [
            {"filename": "warm.cube", "sha256": row["sha256"]},
        ]
        assert data["resources"]["font"] == []

    async def test_missing_files_are_excluded(self, client, input_dir):
        await _upload_lut(client, "gone.cube")
        (input_dir / "comfytv/luts" / "gone.cube").unlink()
        data = await _caps(client)
        assert data["resources"]["lut"] == []


class TestResourceFieldsRegistry:
    async def test_widgets_exist_and_are_socketless(self, reset_db):
        from ComfyTV.api.presets import (
            _input_field, _input_name, _schema_field, _stage_class_map,
        )
        from ComfyTV.api.resources import RESOURCE_KIND_DIRS
        from ComfyTV.nodes.stages.common.resource_fields import RESOURCE_FIELDS
        assert RESOURCE_FIELDS
        mapping = await _stage_class_map()
        for node_id, fields in RESOURCE_FIELDS.items():
            cls = mapping.get(node_id)
            assert cls is not None, node_id
            assert fields
            inputs = {
                _input_name(i): i
                for i in _schema_field(cls.define_schema(), "inputs") or []
            }
            for widget, kind in fields.items():
                assert kind in RESOURCE_KIND_DIRS, f"{node_id}.{widget}"
                assert widget in inputs, f"{node_id}.{widget}"
                assert _input_field(inputs[widget], "socketless") is True
