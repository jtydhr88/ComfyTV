from __future__ import annotations

import json

import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer


@pytest.fixture()
def clean_buffers():
    from ComfyTV.api.canvas_state import clear_canvas_state
    from ComfyTV.api.mcp import _reset_activity
    from ComfyTV.runners.exec_errors import clear_exec_errors
    clear_canvas_state()
    clear_exec_errors()
    _reset_activity()
    yield
    clear_canvas_state()
    clear_exec_errors()
    _reset_activity()


@pytest.fixture()
async def client(reset_db, clean_buffers):
    from ComfyTV import storage
    storage.set_settings({"enable-mcp": True})
    from ComfyTV import api  # noqa: F401 — registers routes on the stub PromptServer
    import server
    app = web.Application()
    app.router.add_routes(server.PromptServer.instance.routes)
    test_server = TestServer(app)
    test_client = TestClient(test_server)
    await test_client.start_server()
    yield test_client
    await test_client.close()


async def _rpc(client, method: str, params: dict | None = None, msg_id=1) -> dict:
    body: dict = {"jsonrpc": "2.0", "id": msg_id, "method": method}
    if params is not None:
        body["params"] = params
    resp = await client.post("/comfytv/mcp", json=body)
    assert resp.status == 200
    return await resp.json()


async def _call_tool(client, name: str, arguments: dict | None = None) -> dict:
    data = await _rpc(client, "tools/call", {"name": name, "arguments": arguments or {}})
    assert "result" in data, data
    return data["result"]


def _tool_json(result: dict) -> dict:
    assert result["isError"] is False, result
    return json.loads(result["content"][0]["text"])


class TestProtocol:
    async def test_initialize(self, client):
        data = await _rpc(client, "initialize", {
            "protocolVersion": "2025-06-18",
            "capabilities": {},
            "clientInfo": {"name": "t", "version": "0"},
        })
        result = data["result"]
        assert result["protocolVersion"] == "2025-06-18"
        assert result["serverInfo"]["name"] == "comfytv-mcp"
        assert result["capabilities"] == {"tools": {}, "prompts": {}}
        assert "add_stage" in result["instructions"]

    async def test_initialize_unknown_version_falls_back(self, client):
        data = await _rpc(client, "initialize", {"protocolVersion": "2099-01-01"})
        assert data["result"]["protocolVersion"] == "2025-06-18"

    async def test_notification_gets_202(self, client):
        resp = await client.post("/comfytv/mcp", json={
            "jsonrpc": "2.0", "method": "notifications/initialized",
        })
        assert resp.status == 202

    async def test_ping(self, client):
        data = await _rpc(client, "ping")
        assert data["result"] == {}

    async def test_parse_error(self, client):
        resp = await client.post(
            "/comfytv/mcp", data=b"{not json",
            headers={"Content-Type": "application/json"},
        )
        assert resp.status == 400
        assert (await resp.json())["error"]["code"] == -32700

    async def test_batch_rejected(self, client):
        resp = await client.post("/comfytv/mcp", json=[
            {"jsonrpc": "2.0", "id": 1, "method": "ping"},
        ])
        assert resp.status == 400
        assert (await resp.json())["error"]["code"] == -32600

    async def test_non_jsonrpc_rejected(self, client):
        resp = await client.post("/comfytv/mcp", json={"hello": "world"})
        assert resp.status == 400
        assert (await resp.json())["error"]["code"] == -32600

    async def test_unknown_method(self, client):
        data = await _rpc(client, "frobnicate/list")
        assert data["error"]["code"] == -32601

    async def test_get_is_405_delete_is_200(self, client):
        assert (await client.get("/comfytv/mcp")).status == 405
        assert (await client.delete("/comfytv/mcp")).status == 200

    async def test_initialize_issues_session_id(self, client):
        body = {"jsonrpc": "2.0", "id": 1, "method": "initialize",
                "params": {"protocolVersion": "2025-06-18"}}
        first = await client.post("/comfytv/mcp", json=body)
        second = await client.post("/comfytv/mcp", json=body)
        sid1 = first.headers.get("Mcp-Session-Id")
        sid2 = second.headers.get("Mcp-Session-Id")
        assert sid1 and sid2 and sid1 != sid2
        ping = await client.post("/comfytv/mcp", json={
            "jsonrpc": "2.0", "id": 2, "method": "ping"})
        assert "Mcp-Session-Id" not in ping.headers

    async def test_resources_empty_prompts_mirror_skills(self, client, monkeypatch, tmp_path):
        assert (await _rpc(client, "resources/list"))["result"] == {
            "resources": []}
        assert (await _rpc(client, "resources/templates/list"))["result"] == {
            "resourceTemplates": []}
        from ComfyTV import skill_store
        empty = tmp_path / "no-skills"
        empty.mkdir()
        monkeypatch.setattr(skill_store, "BUILTIN_SKILLS_DIR", empty)
        monkeypatch.setattr(skill_store, "user_skills_dir", lambda: empty)
        assert (await _rpc(client, "prompts/list"))["result"] == {"prompts": []}
        data = await _rpc(client, "resources/read",
                          {"uri": "comfytv://call/server_info"})
        assert data["error"]["code"] == -32601

    async def test_tools_list(self, client):
        data = await _rpc(client, "tools/list")
        tools = {t["name"]: t for t in data["result"]["tools"]}
        assert set(tools) == {
            "server_info", "projects", "stage_catalog", "list_workflows",
            "get_canvas", "outputs", "assets", "jobs", "exec_errors",
            "add_stage", "set_stage", "connect_stages", "run_stage", "servers",
            "remove_stage", "wait_stage",
            "workflow_get", "workflow_edit", "workflow_create", "node_info",
            "graph_get", "graph_edit", "graph_run",
            "canvas_command", "canvas_focus",
            "asset_edit", "entries",
            "resources", "stage_params", "media_probe", "media_frame",
            "media_waveform", "pick_output", "cancel_stage", "get_stage",
            "director_get", "director_edit", "view_image", "fx_preview",
            "arrange_canvas",
            "scene_get", "scene_edit", "scene_capture", "scene_record",
            "skill",
        }
        for t in tools.values():
            assert t["description"]
            assert t["inputSchema"]["type"] == "object"

    async def test_unknown_tool_is_protocol_error(self, client):
        data = await _rpc(client, "tools/call", {"name": "nope", "arguments": {}})
        assert data["error"]["code"] == -32602


class TestMcpActivity:
    async def test_inactive_until_first_request(self, client):
        resp = await client.get("/comfytv/mcp_activity")
        data = await resp.json()
        assert data == {"active": False, "last_seen": None}

        await _rpc(client, "ping")

        resp = await client.get("/comfytv/mcp_activity")
        data = await resp.json()
        assert data["active"] is True
        assert isinstance(data["last_seen"], float)

    async def test_broadcast_fires_once_then_throttles(self, client, monkeypatch):
        import server
        events: list[str] = []
        monkeypatch.setattr(
            server.PromptServer.instance, "send_sync",
            lambda event, data, sid=None: events.append(event),
        )
        await _rpc(client, "ping")
        await _rpc(client, "tools/list")
        assert events.count("comfytv-mcp-activity") == 1


class TestReadTools:
    async def test_server_info(self, client):
        info = _tool_json(await _call_tool(client, "server_info"))
        assert info["readonly"] is False
        assert info["write_tools_need_open_tab"] is True
        assert info["comfytv_version"] != "unknown"
        assert info["stage_types"] > 0
        assert info["canvas_mirror"] == "absent"
        assert info["recent_exec_errors"] == 0

    async def test_projects_list_and_get(self, client):
        listed = _tool_json(await _call_tool(client, "projects", {"action": "list"}))
        assert listed["projects"], "default project should exist"
        pid = listed["projects"][0]["id"]
        got = _tool_json(await _call_tool(client, "projects",
                                          {"action": "get", "project_id": pid}))
        assert got["project"]["id"] == pid
        assert got["latest_output_at"] is None

    async def test_projects_get_requires_id(self, client):
        result = await _call_tool(client, "projects", {"action": "get"})
        assert result["isError"] is True
        assert "project_id" in result["content"][0]["text"]

    async def test_projects_unknown_action(self, client):
        result = await _call_tool(client, "projects", {"action": "destroy"})
        assert result["isError"] is True

    async def test_stage_catalog(self, client):
        cat = _tool_json(await _call_tool(client, "stage_catalog"))
        node_ids = {s["node_id"] for s in cat["stages"]}
        assert any(n.startswith("ComfyTV.") for n in node_ids)
        assert isinstance(cat["workflow_info"], dict)

    async def test_list_workflows_rejects_bad_kind(self, client):
        result = await _call_tool(client, "list_workflows", {"kind": "nope"})
        assert result["isError"] is True

    async def test_list_workflows(self, client):
        data = _tool_json(await _call_tool(client, "list_workflows"))
        assert data["kinds"]
        assert isinstance(data["workflows"], list)

    async def test_outputs_requires_project(self, client):
        result = await _call_tool(client, "outputs")
        assert result["isError"] is True

    async def test_outputs_empty(self, client):
        listed = _tool_json(await _call_tool(client, "projects", {"action": "list"}))
        pid = listed["projects"][0]["id"]
        data = _tool_json(await _call_tool(client, "outputs", {"project_id": pid}))
        assert data["outputs"] == []

    async def test_outputs_latest_only_needs_stage_ref(self, client):
        result = await _call_tool(
            client, "outputs", {"project_id": "p", "latest_only": True})
        assert result["isError"] is True

    async def test_assets_empty(self, client):
        data = _tool_json(await _call_tool(client, "assets"))
        assert data["assets"] == []
        assert data["categories"] == []

    async def test_assets_bad_category(self, client):
        result = await _call_tool(client, "assets", {"category": "weird"})
        assert result["isError"] is True

    async def test_jobs_empty_and_bad_status(self, client):
        data = _tool_json(await _call_tool(client, "jobs"))
        assert data["jobs"] == []
        result = await _call_tool(client, "jobs", {"status": "exploded"})
        assert result["isError"] is True

    async def test_exec_errors_empty(self, client):
        data = _tool_json(await _call_tool(client, "exec_errors"))
        assert data["errors"] == []


class TestCanvasMirror:
    SNAPSHOT = {
        "project_id": "proj-1",
        "client_id": "c1",
        "stages": [{
            "uid": "u1", "graph_node_id": "3", "node_id": "ComfyTV.ImageStage",
            "workflow": "Flux Schnell", "prompt": "a cat @image_0",
            "mentions": ["image_0"], "inputs": [], "last_run": {"status": "never"},
        }],
    }

    async def test_post_then_get(self, client):
        resp = await client.post("/comfytv/canvas_state", json=self.SNAPSHOT)
        assert resp.status == 200
        data = _tool_json(await _call_tool(client, "get_canvas"))
        assert data["available"] is True
        assert data["stale"] is False
        assert data["stages"][0]["uid"] == "u1"

    async def test_get_without_snapshot(self, client):
        data = _tool_json(await _call_tool(client, "get_canvas"))
        assert data["available"] is False
        assert data["mirrored_project_ids"] == []

    async def test_get_wrong_project(self, client):
        await client.post("/comfytv/canvas_state", json=self.SNAPSHOT)
        data = _tool_json(await _call_tool(client, "get_canvas", {"project_id": "other"}))
        assert data["available"] is False
        assert data["mirrored_project_ids"] == ["proj-1"]

    async def test_multiple_projects_need_explicit_id(self, client):
        await client.post("/comfytv/canvas_state", json=self.SNAPSHOT)
        await client.post("/comfytv/canvas_state",
                          json={**self.SNAPSHOT, "project_id": "proj-2"})
        data = _tool_json(await _call_tool(client, "get_canvas"))
        assert data["available"] is False
        assert sorted(data["mirrored_project_ids"]) == ["proj-1", "proj-2"]
        data = _tool_json(await _call_tool(client, "get_canvas", {"project_id": "proj-2"}))
        assert data["available"] is True

    async def test_stale_detection(self, client):
        from ComfyTV.api import canvas_state
        await client.post("/comfytv/canvas_state", json=self.SNAPSHOT)
        canvas_state._mirrors["proj-1"]["received_at"] -= canvas_state.STALE_AFTER_S + 1
        data = _tool_json(await _call_tool(client, "get_canvas"))
        assert data["available"] is True
        assert data["stale"] is True

    async def test_heartbeat_refreshes(self, client):
        from ComfyTV.api import canvas_state
        await client.post("/comfytv/canvas_state", json=self.SNAPSHOT)
        canvas_state._mirrors["proj-1"]["received_at"] -= canvas_state.STALE_AFTER_S + 1
        resp = await client.post("/comfytv/canvas_state",
                                 json={"project_id": "proj-1", "heartbeat": True})
        assert resp.status == 200
        data = _tool_json(await _call_tool(client, "get_canvas"))
        assert data["stale"] is False

    async def test_heartbeat_without_snapshot_is_404(self, client):
        resp = await client.post("/comfytv/canvas_state",
                                 json={"project_id": "ghost", "heartbeat": True})
        assert resp.status == 404

    async def test_bad_bodies_rejected(self, client):
        assert (await client.post("/comfytv/canvas_state", json={})).status == 400
        assert (await client.post(
            "/comfytv/canvas_state", json={"project_id": "p", "stages": "no"},
        )).status == 400

    async def test_server_info_reports_mirror(self, client):
        await client.post("/comfytv/canvas_state", json=self.SNAPSHOT)
        info = _tool_json(await _call_tool(client, "server_info"))
        assert info["canvas_mirror"][0]["project_id"] == "proj-1"
        assert info["canvas_mirror"][0]["stage_count"] == 1


class TestExecErrors:
    async def test_record_and_list(self, client):
        from ComfyTV.runners.exec_errors import record_exec_error
        record_exec_error(kind="image", label="A", error=RuntimeError("boom-1"))
        record_exec_error(kind="video", label="B", error=ValueError("boom-2"),
                          project_id="p1")
        data = _tool_json(await _call_tool(client, "exec_errors"))
        assert [e["error_text"] for e in data["errors"]] == ["boom-2", "boom-1"]
        assert data["errors"][0]["error_type"] == "ValueError"
        assert data["errors"][0]["project_id"] == "p1"
        assert data["errors"][1]["project_id"] is None

    async def test_limit(self, client):
        from ComfyTV.runners.exec_errors import record_exec_error
        for i in range(5):
            record_exec_error(kind="image", label="A", error=RuntimeError(f"e{i}"))
        data = _tool_json(await _call_tool(client, "exec_errors", {"limit": 2}))
        assert [e["error_text"] for e in data["errors"]] == ["e4", "e3"]

    async def test_rest_endpoint(self, client):
        from ComfyTV.runners.exec_errors import record_exec_error
        record_exec_error(kind="image", label="A", error=RuntimeError("boom"))
        resp = await client.get("/comfytv/exec_errors")
        assert resp.status == 200
        assert (await resp.json())["errors"][0]["error_text"] == "boom"

    async def test_invoke_runner_records_failure(self, client, reset_db):
        from ComfyTV.nodes.stages.common.invoke import StageRunnerMissing, invoke_runner
        from ComfyTV.runners.exec_errors import list_exec_errors
        with pytest.raises(StageRunnerMissing):
            await invoke_runner(kind="image", label="no-such-workflow-xyz")
        errors = list_exec_errors(5)
        assert errors and errors[0]["label"] == "no-such-workflow-xyz"
        assert errors[0]["error_type"] == "StageRunnerMissing"
