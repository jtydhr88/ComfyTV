import json

import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

from ComfyTV.runners import workflow_db as wdb
from ComfyTV.runners.workflow_db import convert as conv
from ComfyTV.runners.vendor.workflow_to_api import WorkflowConversionError


class _Gen:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": ("STRING", {"multiline": True, "default": ""}),
                "steps": ("INT", {"default": 20}),
            }
        }


class _Save:
    OUTPUT_NODE = True

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"images": ("IMAGE",)}}


class _Broken:
    @classmethod
    def INPUT_TYPES(cls):
        raise RuntimeError("boom")


class _V3Style:
    @classmethod
    def GET_NODE_INFO_V1(cls):
        return {
            "input": {"required": {"value": ("INT", {"default": 1})}},
            "input_order": {"required": ["value"]},
            "output_node": False,
        }


GUI_DOC = {
    "nodes": [
        {
            "id": 1, "type": "Gen",
            "widgets_values": ["hello", 30],
            "inputs": [],
            "outputs": [{"name": "IMAGE", "type": "IMAGE", "links": [7]}],
        },
        {
            "id": 2, "type": "Save",
            "inputs": [{"name": "images", "type": "IMAGE", "link": 7}],
            "outputs": [],
        },
    ],
    "links": [[7, 1, 0, 2, 0, "IMAGE"]],
}


@pytest.fixture()
def registry(comfy_nodes):
    comfy_nodes.NODE_CLASS_MAPPINGS.update({
        "Gen": _Gen, "Save": _Save, "Broken": _Broken, "V3Style": _V3Style,
    })
    return comfy_nodes


class TestBuildObjectInfo:
    def test_builds_schema_from_input_types(self, registry):
        info = conv.build_object_info()
        assert info["Gen"]["input"] == _Gen.INPUT_TYPES()
        assert info["Gen"]["input_order"] == {"required": ["text", "steps"]}
        assert info["Gen"]["output_node"] is False
        assert info["Save"]["output_node"] is True

    def test_skips_class_whose_input_types_raises(self, registry):
        info = conv.build_object_info()
        assert "Broken" not in info
        assert "Gen" in info

    def test_prefers_get_node_info_v1(self, registry):
        info = conv.build_object_info()
        assert info["V3Style"]["input"]["required"]["value"] == ("INT", {"default": 1})

    def test_empty_registry(self, comfy_nodes):
        assert conv.build_object_info() == {}


class TestConvertGuiToApi:
    def test_maps_widgets_and_links(self, registry):
        api = conv.convert_gui_to_api(GUI_DOC)
        assert api["1"]["class_type"] == "Gen"
        assert api["1"]["inputs"]["text"] == "hello"
        assert api["1"]["inputs"]["steps"] == 30
        assert api["2"]["inputs"]["images"] == ["1", 0]

    def test_api_format_passes_through(self, registry):
        prompt = {"3": {"class_type": "Gen", "inputs": {"steps": 5}}}
        assert conv.convert_gui_to_api(prompt) == prompt

    def test_malformed_raises(self, registry):
        with pytest.raises(WorkflowConversionError):
            conv.convert_gui_to_api({"nodes": "nope"})


def _seed_gui_workflow(tmp_path, monkeypatch, doc=GUI_DOC, name="sd15"):
    from pathlib import Path
    kind_dir = tmp_path / "workflows" / "image"
    kind_dir.mkdir(parents=True, exist_ok=True)
    (kind_dir / f"{name}.json").write_text(json.dumps(doc))
    monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(tmp_path / "workflows"))
    wdb.seed_workflows_from_disk(("image",))
    return name


class TestConvertWorkflow:
    def test_happy_path_persists_api_json(self, reset_db, tmp_path, monkeypatch, registry):
        label = _seed_gui_workflow(tmp_path, monkeypatch)
        result = conv.convert_workflow("image", label)
        assert result["node_count"] == 2
        assert result["api_json"]["1"]["class_type"] == "Gen"
        assert result["file_mtime"] > 0
        cfg = wdb.get_workflow_config("image", label)
        assert cfg["has_api"] is True
        assert cfg["api_json"]["2"]["inputs"]["images"] == ["1", 0]

    def test_unknown_workflow_raises(self, reset_db):
        with pytest.raises(FileNotFoundError, match="not found"):
            conv.convert_workflow("image", "Nope")

    def test_missing_file_raises(self, reset_db, tmp_path):
        from ComfyTV import db
        with db.get_session() as s:
            s.add(db.Workflow(kind="image", label="Ghost",
                              file_path=str(tmp_path / "gone.json"), order_=100))
            s.commit()
        with pytest.raises(FileNotFoundError, match="file missing"):
            conv.convert_workflow("image", "Ghost")

    def test_empty_conversion_raises_and_saves_nothing(
            self, reset_db, tmp_path, monkeypatch, registry):
        label = _seed_gui_workflow(
            tmp_path, monkeypatch, doc={"nodes": [], "links": []}, name="empty")
        with pytest.raises(WorkflowConversionError, match="0 nodes"):
            conv.convert_workflow("image", label)
        assert wdb.get_workflow_config("image", label)["has_api"] is False


class TestInvokeAutoConvert:
    def test_invoke_converts_when_api_json_missing(
            self, reset_db, tmp_path, monkeypatch, registry):
        label = _seed_gui_workflow(tmp_path, monkeypatch)
        cfg = wdb.get_workflow_for_invoke("image", label)
        assert cfg["api_json"]["1"]["inputs"]["text"] == "hello"
        assert wdb.get_workflow_config("image", label)["has_api"] is True

    def test_invoke_wraps_conversion_failure(
            self, reset_db, tmp_path, monkeypatch, registry):
        label = _seed_gui_workflow(
            tmp_path, monkeypatch, doc={"nodes": []}, name="broken")
        with pytest.raises(RuntimeError, match="could not be converted"):
            wdb.get_workflow_for_invoke("image", label)


@pytest.fixture()
async def client(reset_db, monkeypatch):
    from ComfyTV import api  # noqa: F401 — registers routes on the stub PromptServer

    import server
    app = web.Application()
    app.router.add_routes(server.PromptServer.instance.routes)

    test_server = TestServer(app)
    test_client = TestClient(test_server)
    await test_client.start_server()
    yield test_client
    await test_client.close()


class TestConvertEndpoint:
    async def test_convert_route_happy_path(
            self, client, tmp_path, monkeypatch, registry):
        label = _seed_gui_workflow(tmp_path, monkeypatch)
        resp = await client.post(
            "/comfytv/workflows/convert", json={"kind": "image", "label": label})
        assert resp.status == 200
        data = await resp.json()
        assert data["ok"] is True
        assert data["node_count"] == 2
        assert data["api_json"]["1"]["class_type"] == "Gen"

    async def test_convert_route_unknown_workflow(self, client):
        resp = await client.post(
            "/comfytv/workflows/convert", json={"kind": "image", "label": "Nope"})
        assert resp.status == 404

    async def test_convert_route_conversion_error(
            self, client, tmp_path, monkeypatch, registry):
        label = _seed_gui_workflow(
            tmp_path, monkeypatch, doc={"nodes": [], "links": []}, name="empty")
        resp = await client.post(
            "/comfytv/workflows/convert", json={"kind": "image", "label": label})
        assert resp.status == 422
        data = await resp.json()
        assert "0 nodes" in data["error"]

    async def test_convert_route_missing_args(self, client):
        resp = await client.post("/comfytv/workflows/convert", json={"kind": "image"})
        assert resp.status == 400
