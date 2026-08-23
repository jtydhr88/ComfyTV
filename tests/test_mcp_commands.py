from __future__ import annotations

import asyncio
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
def sent(monkeypatch):
    import server
    events: list[tuple[str, dict]] = []
    monkeypatch.setattr(
        server.PromptServer.instance, "send_sync",
        lambda event, data, sid=None: events.append((event, data)),
    )
    return events


async def _call_tool(client, name: str, arguments: dict | None = None) -> dict:
    resp = await client.post("/comfytv/mcp", json={
        "jsonrpc": "2.0", "id": 1, "method": "tools/call",
        "params": {"name": name, "arguments": arguments or {}},
    })
    assert resp.status == 200
    data = await resp.json()
    assert "result" in data, data
    return data["result"]


def _tool_error(result: dict) -> str:
    assert result["isError"] is True, result
    return result["content"][0]["text"]


def _tool_json(result: dict) -> dict:
    assert result["isError"] is False, result
    return json.loads(result["content"][0]["text"])


class TestCommandRegistry:
    async def test_submit_resolves_on_posted_result(self, client, sent):
        from ComfyTV.api.mcp_commands import submit_command
        task = asyncio.ensure_future(
            submit_command("add_stage", {"node_class": "ComfyTV.ImageStage"}, timeout=5.0)
        )
        await asyncio.sleep(0)
        commands = [d for e, d in sent if e == "comfytv-mcp-command"]
        assert len(commands) == 1
        cmd = commands[0]
        assert cmd["action"] == "add_stage"
        assert cmd["node_class"] == "ComfyTV.ImageStage"

        resp = await client.post("/comfytv/mcp_command_result", json={
            "command_id": cmd["id"], "ok": True,
            "result": {"graph_node_id": "7", "uid": "u-7"},
        })
        assert (await resp.json())["ok"] is True
        assert await task == {"graph_node_id": "7", "uid": "u-7"}

    async def test_submit_times_out_without_a_tab(self, client, sent):
        from ComfyTV.api.mcp_commands import pending_count, submit_command
        with pytest.raises(ValueError, match="no ComfyTV page"):
            await submit_command("run_stage", {"node": "1"}, timeout=0.05)
        assert pending_count() == 0

    async def test_frontend_error_becomes_value_error(self, client, sent):
        from ComfyTV.api.mcp_commands import submit_command
        task = asyncio.ensure_future(
            submit_command("set_stage", {"node": "9"}, timeout=5.0)
        )
        await asyncio.sleep(0)
        cmd_id = sent[0][1]["id"]
        await client.post("/comfytv/mcp_command_result", json={
            "command_id": cmd_id, "ok": False, "error": "stage 9 not found on the canvas",
        })
        with pytest.raises(ValueError, match="stage 9 not found"):
            await task

    async def test_unknown_result_is_ignored(self, client):
        resp = await client.post("/comfytv/mcp_command_result", json={
            "command_id": "deadbeef", "ok": True, "result": {},
        })
        data = await resp.json()
        assert data["ok"] is False

    async def test_result_requires_command_id(self, client):
        resp = await client.post("/comfytv/mcp_command_result", json={"ok": True})
        assert resp.status == 400

    async def test_command_targets_mirroring_client(self, client, sent):
        from ComfyTV.api.canvas_state import store_canvas_state
        from ComfyTV.api.mcp_commands import submit_command
        store_canvas_state("default", [], client_id="tab-42")
        task = asyncio.ensure_future(
            submit_command("add_stage", {"node_class": "X", "project_id": "default"},
                           timeout=5.0)
        )
        await asyncio.sleep(0)
        cmd = sent[0][1]
        assert cmd["target_client_id"] == "tab-42"
        await client.post("/comfytv/mcp_command_result", json={
            "command_id": cmd["id"], "ok": True, "result": {},
        })
        await task

    async def test_single_mirror_targets_without_project_id(self, client, sent):
        from ComfyTV.api.canvas_state import store_canvas_state
        from ComfyTV.api.mcp_commands import submit_command
        store_canvas_state("p1", [], client_id="tab-1")
        task = asyncio.ensure_future(
            submit_command("run_stage", {"node": "3"}, timeout=5.0)
        )
        await asyncio.sleep(0)
        cmd = sent[0][1]
        assert cmd["target_client_id"] == "tab-1"
        await client.post("/comfytv/mcp_command_result", json={
            "command_id": cmd["id"], "ok": True, "result": {"started": True},
        })
        await task

    async def test_stale_mirror_is_not_targeted(self, client, sent):
        from ComfyTV.api import canvas_state
        from ComfyTV.api.mcp_commands import submit_command
        canvas_state.store_canvas_state("p1", [], client_id="tab-1")
        canvas_state._mirrors["p1"]["received_at"] -= 120
        task = asyncio.ensure_future(
            submit_command("run_stage", {"node": "3"}, timeout=5.0)
        )
        await asyncio.sleep(0)
        cmd = sent[0][1]
        assert "target_client_id" not in cmd
        await client.post("/comfytv/mcp_command_result", json={
            "command_id": cmd["id"], "ok": True, "result": {},
        })
        await task


class TestWriteTools:
    @pytest.fixture()
    def fake_submit(self, monkeypatch):
        from ComfyTV.api import mcp_tools
        calls: dict = {}

        async def submit(action, payload, timeout=15.0):
            calls["action"] = action
            calls["payload"] = payload
            calls["timeout"] = timeout
            return {"ok_from_tab": True}

        monkeypatch.setattr(mcp_tools, "submit_command", submit)
        return calls

    async def test_add_stage_normalizes_class(self, client, fake_submit):
        out = _tool_json(await _call_tool(client, "add_stage", {
            "node_class": "ImageStage", "prompt": "a cat", "title": "T",
        }))
        assert out == {"ok_from_tab": True}
        assert fake_submit["action"] == "add_stage"
        assert fake_submit["payload"]["node_class"] == "ComfyTV.ImageStage"
        assert fake_submit["payload"]["prompt"] == "a cat"
        assert fake_submit["payload"]["title"] == "T"

    async def test_add_stage_rejects_unknown_class(self, client, fake_submit):
        text = _tool_error(await _call_tool(client, "add_stage",
                                            {"node_class": "NopeStage"}))
        assert "unknown stage class" in text
        assert "action" not in fake_submit

    async def test_add_stage_validates_workflow_label(self, client, fake_submit,
                                                      monkeypatch):
        from ComfyTV.runners import workflow_db
        monkeypatch.setattr(workflow_db, "list_workflows_overview",
                            lambda kind=None: [{"label": "Flux Schnell"}])
        text = _tool_error(await _call_tool(client, "add_stage", {
            "node_class": "ImageStage", "workflow": "Nope",
        }))
        assert "not found for kind 'image'" in text

        out = _tool_json(await _call_tool(client, "add_stage", {
            "node_class": "ImageStage", "workflow": "Flux Schnell",
        }))
        assert out == {"ok_from_tab": True}
        assert fake_submit["payload"]["workflow"] == "Flux Schnell"

    async def test_add_stage_rejects_workflow_on_workflowless_stage(
            self, client, fake_submit):
        text = _tool_error(await _call_tool(client, "add_stage", {
            "node_class": "CropStage", "workflow": "Whatever",
        }))
        assert "no workflow selector" in text

    async def test_set_stage_requires_node_and_fields(self, client, fake_submit):
        text = _tool_error(await _call_tool(client, "set_stage", {}))
        assert "node is required" in text
        text = _tool_error(await _call_tool(client, "set_stage", {"node": "1"}))
        assert "nothing to set" in text

    async def test_set_stage_submits(self, client, fake_submit):
        _tool_json(await _call_tool(client, "set_stage", {
            "node": "1", "prompt": "p", "title": "t",
        }))
        assert fake_submit["action"] == "set_stage"
        assert fake_submit["payload"] == {"node": "1", "prompt": "p", "title": "t"}

    async def test_set_stage_passes_widgets(self, client, fake_submit):
        _tool_json(await _call_tool(client, "set_stage", {
            "node": "1", "widgets": {"duration": 8, "text": "Hello"},
        }))
        assert fake_submit["payload"] == {
            "node": "1", "widgets": {"duration": 8, "text": "Hello"},
        }

    async def test_widgets_must_be_object(self, client, fake_submit):
        text = _tool_error(await _call_tool(client, "set_stage", {
            "node": "1", "widgets": "duration=8",
        }))
        assert "widgets must be an object" in text
        assert "action" not in fake_submit

    async def test_connect_requires_both_nodes(self, client, fake_submit):
        text = _tool_error(await _call_tool(client, "connect_stages",
                                            {"from_node": "1"}))
        assert "from_node and to_node are required" in text

    async def test_connect_submits(self, client, fake_submit):
        _tool_json(await _call_tool(client, "connect_stages", {
            "from_node": "1", "to_node": "2", "to_slot": "images.0",
        }))
        assert fake_submit["action"] == "connect_stages"
        assert fake_submit["payload"] == {
            "from_node": "1", "to_node": "2", "to_slot": "images.0",
        }

    async def test_run_stage_uses_longer_timeout(self, client, fake_submit):
        _tool_json(await _call_tool(client, "run_stage", {"node": "5"}))
        assert fake_submit["action"] == "run_stage"
        assert fake_submit["payload"] == {"node": "5"}
        assert fake_submit["timeout"] == 60.0

    async def test_set_stage_validates_server(self, client, fake_submit):
        text = _tool_error(await _call_tool(client, "set_stage", {
            "node": "1", "server": "999",
        }))
        assert "server 999 not found" in text

        from ComfyTV import storage
        row = storage.create_server(label="rig", host="10.0.0.9", port=8188)
        _tool_json(await _call_tool(client, "set_stage", {
            "node": "1", "server": str(row["id"]),
        }))
        assert fake_submit["payload"] == {"node": "1", "server": str(row["id"])}

        storage.update_server(row["id"], enabled=False)
        text = _tool_error(await _call_tool(client, "set_stage", {
            "node": "1", "server": str(row["id"]),
        }))
        assert "disabled" in text

    async def test_set_stage_server_local_skips_validation(self, client, fake_submit):
        _tool_json(await _call_tool(client, "set_stage", {
            "node": "1", "server": "local",
        }))
        assert fake_submit["payload"] == {"node": "1", "server": "local"}

    async def test_set_stage_validates_asset_refs(self, client, fake_submit):
        text = _tool_error(await _call_tool(client, "set_stage", {
            "node": "1", "asset_refs": [{"asset_id": 424242}],
        }))
        assert "asset 424242 not found" in text

        from ComfyTV import storage
        row = storage.create_asset(
            name="ref", payload_url="/view?filename=r.png&type=output",
            media_type="image", category_ids=[],
        )
        _tool_json(await _call_tool(client, "set_stage", {
            "node": "1",
            "asset_refs": [{"asset_id": row["id"], "slot": 0}],
        }))
        assert fake_submit["payload"]["asset_refs"] == [
            {"asset_id": row["id"], "slot": 0},
        ]

        text = _tool_error(await _call_tool(client, "set_stage", {
            "node": "1", "asset_refs": [{"asset_id": row["id"], "type": "mesh"}],
        }))
        assert "image/video/audio" in text

    async def test_set_stage_asset_refs_must_be_list(self, client, fake_submit):
        text = _tool_error(await _call_tool(client, "set_stage", {
            "node": "1", "asset_refs": {"asset_id": 1},
        }))
        assert "must be an array" in text


class TestServersTool:
    async def test_lists_servers_with_status(self, client, monkeypatch):
        from ComfyTV import storage
        from ComfyTV.api import mcp_tools
        row = storage.create_server(label="rig-a", host="10.0.0.8", port=8188)

        async def fake_fetch(session, server):
            return {"id": server["id"], "online": True, "running": 1, "pending": 2}

        from ComfyTV.api import servers as servers_api
        monkeypatch.setattr(servers_api, "_fetch_server_queue", fake_fetch)
        out = _tool_json(await _call_tool(client, "servers"))
        entry = next(s for s in out["servers"] if s["id"] == row["id"])
        assert entry["status"]["online"] is True
        assert entry["status"]["pending"] == 2
        assert entry["status"]["jobs"] == 0

    async def test_disabled_server_has_null_status(self, client):
        from ComfyTV import storage
        row = storage.create_server(label="rig-off", host="10.0.0.7", port=8188)
        storage.update_server(row["id"], enabled=False)
        out = _tool_json(await _call_tool(client, "servers"))
        entry = next(s for s in out["servers"] if s["id"] == row["id"])
        assert entry["status"] is None
