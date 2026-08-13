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

    monkeypatch.setattr(mcp_tools, "submit_command", submit)
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


class TestSceneTools:
    async def test_scene_get_submits(self, client, fake_submit):
        out = _ok(await _call_tool(client, "scene_get", {"node": "7"}))
        assert out == {"ok_from_tab": True}
        assert fake_submit["action"] == "scene_get"
        assert fake_submit["payload"] == {"node": "7"}

    async def test_scene_edit_validates_ops(self, client, fake_submit):
        text = _err(await _call_tool(client, "scene_edit", {"node": "7"}))
        assert "ops must be a non-empty array" in text

        text = _err(await _call_tool(client, "scene_edit", {
            "node": "7", "ops": [{"shape": "cube"}],
        }))
        assert "'op' field" in text

        _ok(await _call_tool(client, "scene_edit", {
            "node": "7", "ops": [{"op": "add_primitive", "shape": "cube"}],
        }))
        assert fake_submit["action"] == "scene_edit"
        assert fake_submit["payload"]["ops"] == [
            {"op": "add_primitive", "shape": "cube"}]

    async def test_scene_capture_validates_channel(self, client, fake_submit):
        text = _err(await _call_tool(client, "scene_capture", {
            "node": "7", "channel": "xray",
        }))
        assert "channel must be one of" in text

        _ok(await _call_tool(client, "scene_capture", {
            "node": "7", "channel": "depth", "width": 1280, "height": 720,
        }))
        assert fake_submit["action"] == "scene_capture"
        assert fake_submit["payload"] == {
            "node": "7", "channel": "depth", "width": 1280, "height": 720}
        assert fake_submit["timeout"] == 120.0

    async def test_scene_record_long_timeout(self, client, fake_submit):
        _ok(await _call_tool(client, "scene_record", {"node": "7"}))
        assert fake_submit["action"] == "scene_record"
        assert fake_submit["timeout"] == 300.0

    async def test_scene_tools_require_node(self, client, fake_submit):
        for name in ("scene_get", "scene_capture", "scene_record"):
            text = _err(await _call_tool(client, name, {}))
            assert "node is required" in text
        assert "action" not in fake_submit
