from __future__ import annotations

import json
from pathlib import Path

import pytest


class _FakeKSampler:
    CATEGORY = "sampling"
    DESCRIPTION = "Denoise latent images with a sampler"
    RETURN_TYPES = ("LATENT",)
    RETURN_NAMES = ("latent",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model": ("MODEL",),
                "seed": ("INT", {"default": 0, "min": 0, "max": 99}),
                "sampler_name": ([f"sampler-{i}" for i in range(40)],),
            },
            "optional": {
                "denoise": ("FLOAT", {"default": 1.0}),
            },
        }


class _FakeSaveImage:
    CATEGORY = "image"
    OUTPUT_NODE = True
    RETURN_TYPES = ()

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"images": ("IMAGE",)}}


@pytest.fixture()
def node_registry(comfy_nodes):
    comfy_nodes.NODE_CLASS_MAPPINGS.update({
        "KSampler": _FakeKSampler,
        "SaveImage": _FakeSaveImage,
    })
    return comfy_nodes


class TestNodeInfo:
    async def test_search_matches_all_tokens(self, node_registry):
        from ComfyTV.api.mcp_tools import _node_info
        out = await _node_info({"action": "search", "query": "sampler denoise"})
        assert out["total"] == 1
        assert out["nodes"][0]["name"] == "KSampler"
        assert out["nodes"][0]["category"] == "sampling"

    async def test_search_requires_query(self, node_registry):
        from ComfyTV.api.mcp_tools import _node_info
        with pytest.raises(ValueError, match="query is required"):
            await _node_info({"action": "search"})

    async def test_get_returns_slim_schema(self, node_registry):
        from ComfyTV.api.mcp_tools import _node_info
        out = await _node_info({"action": "get", "name": "KSampler"})
        assert out["name"] == "KSampler"
        req = out["inputs"]["required"]
        assert req["model"] == {"type": "MODEL"}
        assert req["seed"]["type"] == "INT"
        assert req["seed"]["default"] == 0
        combo = req["sampler_name"]
        assert combo["type"] == "COMBO"
        assert len(combo["choices"]) == 24
        assert combo["choices_total"] == 40
        assert out["inputs"]["optional"]["denoise"]["type"] == "FLOAT"
        assert out["outputs"] == [{"type": "LATENT", "name": "latent"}]
        assert out["output_node"] is False

    async def test_get_output_node_flag(self, node_registry):
        from ComfyTV.api.mcp_tools import _node_info
        out = await _node_info({"action": "get", "name": "SaveImage"})
        assert out["output_node"] is True
        assert out["outputs"] == []

    async def test_get_unknown_suggests_close_names(self, node_registry):
        from ComfyTV.api.mcp_tools import _node_info
        with pytest.raises(ValueError, match="KSampler"):
            await _node_info({"action": "get", "name": "sampler"})

    async def test_unknown_action(self, node_registry):
        from ComfyTV.api.mcp_tools import _node_info
        with pytest.raises(ValueError, match="unknown action"):
            await _node_info({"action": "nope"})


API_JSON = {
    "3": {"class_type": "KSampler",
          "inputs": {"seed": 5, "sampler_name": "sampler-0"}},
    "9": {"class_type": "SaveImage", "inputs": {"images": ["3", 0]}},
}

GUI_GRAPH = {"nodes": [{"id": 1, "type": "Note"}], "links": []}


def _validation_stub(result):
    async def stub(prompt_id, prompt, partial_execution_list):
        return result
    return stub


@pytest.fixture()
def valid_prompt(monkeypatch):
    import execution
    monkeypatch.setattr(execution, "validate_prompt",
                        _validation_stub((True, None, ["9"], {})),
                        raising=False)


class TestWorkflowCreate:
    async def test_api_json_path(self, reset_db, valid_prompt):
        from ComfyTV.api.mcp_tools import _workflow_create, _workflow_get
        out = await _workflow_create({
            "kind": "image", "label": "Bot T2I", "api_json": API_JSON,
            "description": "made by bot",
            "result_node": "9", "result_type": "image",
        })
        assert out["created"] is True
        assert out["has_api"] is True
        assert out["validation"]["valid"] is True
        assert json.loads(Path(out["file_path"]).read_text("utf-8")) == API_JSON

        cfg = await _workflow_get({"kind": "image", "label": "Bot T2I"})
        assert cfg["has_api"] is True
        assert cfg["description"] == "made by bot"
        assert cfg["result_node"] == "9"
        assert cfg["result_type"] == "image"
        assert cfg["meta"]["created_by"] == "mcp"
        assert cfg["meta"]["api_only"] is True
        nodes = {n["node_id"]: n for n in cfg["nodes"]}
        assert nodes["3"]["class_type"] == "KSampler"

    async def test_invalid_api_json_not_registered(self, reset_db, monkeypatch):
        import execution
        from ComfyTV.api.mcp_tools import _workflow_create, _workflow_get
        err = {"type": "invalid_prompt", "message": "bad graph",
               "details": "node 3", "extra_info": {"traceback": "huge"}}
        node_errors = {"3": {"class_type": "KSampler",
                             "errors": [{"message": "m", "details": "d"}]}}
        monkeypatch.setattr(execution, "validate_prompt",
                            _validation_stub((False, err, [], node_errors)),
                            raising=False)
        out = await _workflow_create({
            "kind": "image", "label": "Broken", "api_json": API_JSON})
        assert out["created"] is False
        assert out["validation"]["valid"] is False
        assert out["validation"]["error"] == {
            "type": "invalid_prompt", "message": "bad graph",
            "details": "node 3"}
        assert out["validation"]["node_errors"]["3"]["errors"] == ["m: d"]
        with pytest.raises(ValueError):
            await _workflow_get({"kind": "image", "label": "Broken"})

    async def test_validate_only_registers_nothing(self, reset_db, valid_prompt):
        from ComfyTV.api.mcp_tools import _workflow_create, _workflow_get
        out = await _workflow_create({
            "kind": "image", "label": "Check", "api_json": API_JSON,
            "validate_only": True})
        assert out["created"] is False
        assert out["validation"]["valid"] is True
        with pytest.raises(ValueError):
            await _workflow_get({"kind": "image", "label": "Check"})

    async def test_graph_path_needs_ui_conversion(self, reset_db):
        from ComfyTV.api.mcp_tools import _workflow_create, _workflow_get
        out = await _workflow_create({
            "kind": "video", "label": "Cam Sweep", "graph": GUI_GRAPH})
        assert out["created"] is True
        assert out["has_api"] is False
        assert "opened" in out["note"]
        cfg = await _workflow_get({"kind": "video", "label": "Cam Sweep"})
        assert cfg["has_api"] is False
        assert cfg["meta"].get("api_only") is None

    async def test_graph_must_be_gui_format(self, reset_db):
        from ComfyTV.api.mcp_tools import _workflow_create
        with pytest.raises(ValueError, match="GUI-format"):
            await _workflow_create({
                "kind": "video", "label": "X", "graph": API_JSON})

    async def test_label_and_file_dedupe(self, reset_db, valid_prompt):
        from ComfyTV.api.mcp_tools import _workflow_create
        first = await _workflow_create({
            "kind": "image", "label": "Twin", "api_json": API_JSON})
        second = await _workflow_create({
            "kind": "image", "label": "Twin", "api_json": API_JSON})
        assert first["label"] == "Twin"
        assert second["label"] == "Twin-2"
        assert first["file_path"] != second["file_path"]

    async def test_requires_payload(self, reset_db):
        from ComfyTV.api.mcp_tools import _workflow_create
        with pytest.raises(ValueError, match="api_json.*or graph"):
            await _workflow_create({"kind": "image", "label": "Empty"})

    async def test_unknown_kind(self, reset_db):
        from ComfyTV.api.mcp_tools import _workflow_create
        with pytest.raises(ValueError, match="unknown workflow kind"):
            await _workflow_create({
                "kind": "nope", "label": "X", "api_json": API_JSON})

    async def test_missing_label(self, reset_db):
        from ComfyTV.api.mcp_tools import _workflow_create
        with pytest.raises(ValueError, match="label is required"):
            await _workflow_create({"kind": "image", "api_json": API_JSON})
