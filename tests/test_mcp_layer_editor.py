from __future__ import annotations

import json

import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer


@pytest.fixture()
def clean_state():
    from ComfyTV.api.canvas_state import clear_canvas_state
    from ComfyTV.api.mcp import _reset_activity
    from ComfyTV.api.mcp_commands import clear_pending
    clear_canvas_state()
    clear_pending()
    _reset_activity()
    yield
    clear_canvas_state()
    clear_pending()
    _reset_activity()


@pytest.fixture()
async def client(reset_db, clean_state):
    from ComfyTV import storage
    storage.set_settings({"enable-mcp": True})
    from ComfyTV import api  # noqa: F401
    import server
    app = web.Application()
    app.router.add_routes(server.PromptServer.instance.routes)
    test_server = TestServer(app)
    test_client = TestClient(test_server)
    await test_client.start_server()
    yield test_client
    await test_client.close()


@pytest.fixture()
def fake_submit(monkeypatch):
    from ComfyTV.api import mcp_tools
    calls: dict = {}

    async def submit(action, payload, timeout=15.0):
        calls["action"] = action
        calls["payload"] = payload
        calls["timeout"] = timeout
        return {"ok_from_tab": True}

    monkeypatch.setattr(mcp_tools._shared, "submit_command", submit)
    return calls


async def _call_tool(client, name, arguments):
    resp = await client.post("/comfytv/mcp", json={
        "jsonrpc": "2.0", "id": 1, "method": "tools/call",
        "params": {"name": name, "arguments": arguments},
    })
    data = await resp.json()
    return data["result"]


def _ok(result):
    assert result["isError"] is False, result
    return json.loads(result["content"][0]["text"])


def _err(result):
    assert result["isError"] is True, result
    return result["content"][0]["text"]


class TestLayerEditorTools:
    def test_registered_and_whitelisted(self):
        from ComfyTV.api.mcp_tools import TOOLS
        from ComfyTV.bot._cli_common import CORE_MCP_TOOLS
        for name in ("layer_get", "layer_edit", "layer_capture"):
            assert name in TOOLS
            assert name in CORE_MCP_TOOLS

    async def test_layer_get_submits(self, client, fake_submit):
        out = _ok(await _call_tool(client, "layer_get", {"node": "7"}))
        assert out == {"ok_from_tab": True}
        assert fake_submit["action"] == "layer_get"
        assert fake_submit["payload"] == {"node": "7"}

    async def test_layer_get_can_skip_resources(self, client, fake_submit):
        _ok(await _call_tool(client, "layer_get", {"node": "7", "resources": False}))
        assert fake_submit["payload"] == {"node": "7", "resources": False}

    async def test_layer_get_requires_node(self, client, fake_submit):
        assert "node is required" in _err(await _call_tool(client, "layer_get", {}))

    async def test_layer_edit_validates_ops(self, client, fake_submit):
        assert "non-empty" in _err(await _call_tool(client, "layer_edit", {"node": "7", "ops": []}))
        assert "'op' field" in _err(
            await _call_tool(client, "layer_edit", {"node": "7", "ops": [{"id": "x"}]}))
        assert "action" not in fake_submit

    async def test_layer_edit_submits(self, client, fake_submit):
        ops = [{"op": "add_layer", "name": "Base"}, {"op": "set_opacity", "id": "l1", "opacity": 0.5}]
        _ok(await _call_tool(client, "layer_edit", {"node": "u1", "ops": ops, "project_id": "p"}))
        assert fake_submit["action"] == "layer_edit"
        assert fake_submit["payload"] == {"node": "u1", "ops": ops, "project_id": "p"}
        assert fake_submit["timeout"] == 60.0

    async def test_layer_capture_modes(self, client, fake_submit):
        _ok(await _call_tool(client, "layer_capture", {"node": "u1"}))
        assert fake_submit["payload"] == {"node": "u1"}
        _ok(await _call_tool(client, "layer_capture", {"node": "u1", "mode": "batch"}))
        assert fake_submit["payload"] == {"node": "u1", "mode": "batch"}
        assert fake_submit["timeout"] == 120.0
        assert "mode must be" in _err(
            await _call_tool(client, "layer_capture", {"node": "u1", "mode": "video"}))


class TestGetStageLatestOutput:
    async def test_get_stage_attaches_latest_output(self, client, monkeypatch):
        from ComfyTV.api import mcp_tools
        from ComfyTV import storage

        async def submit(action, payload, timeout=15.0):
            return {"graph_node_id": "2", "uid": "u-1", "widgets": {}}

        monkeypatch.setattr(mcp_tools._shared, "submit_command", submit)
        monkeypatch.setattr(storage, "latest_output_by_uid", lambda pid, uid: {
            "id": 42, "output_type": "images", "created_at": "t", "payload_url": "",
            "picked_index": 1,
            "payload_json": {"images": [{"index": "1", "image_url": "/view?filename=a.png"}]},
        } if (pid, uid) == ("p1", "u-1") else None)
        out = _ok(await _call_tool(client, "get_stage", {"node": "2", "project_id": "p1"}))
        assert out["latest_output"]["id"] == 42
        assert out["latest_output"]["images"] == [{"index": "1", "image_url": "/view?filename=a.png"}]
        assert out["latest_output"]["payload_url"] is None
        out = _ok(await _call_tool(client, "get_stage", {"node": "2", "project_id": "other"}))
        assert out["latest_output"] is None

    async def test_asset_by_id_route(self, client, monkeypatch):
        from ComfyTV import storage
        monkeypatch.setattr(storage, "get_asset", lambda aid: {"id": aid, "name": "x", "payload_url": "/view?f=x.png", "media_type": "image", "mime_type": "image/png"} if aid == 5 else None)
        resp = await client.get("/comfytv/assets/5")
        assert resp.status == 200
        assert (await resp.json())["asset"]["id"] == 5
        assert (await client.get("/comfytv/assets/6")).status == 404
        assert (await client.get("/comfytv/assets/x")).status == 400
