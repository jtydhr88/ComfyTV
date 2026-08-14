from __future__ import annotations

import asyncio
import json
import time

import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer


@pytest.fixture()
def clean_state():
    from ComfyTV.api.canvas_state import clear_canvas_state
    from ComfyTV.api.mcp import _reset_activity
    from ComfyTV.api.mcp_commands import clear_pending
    from ComfyTV.api.prompt_lint import clear_lint_cache
    from ComfyTV.runners.exec_errors import clear_exec_errors
    clear_canvas_state()
    clear_pending()
    clear_exec_errors()
    clear_lint_cache()
    _reset_activity()
    yield
    clear_canvas_state()
    clear_pending()
    clear_exec_errors()
    clear_lint_cache()
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


async def _post_state(client, body):
    return await client.post("/comfytv/canvas_state", json=body)


class TestMirrorOwnership:
    async def test_owner_heartbeat_touches(self, client):
        await _post_state(client, {"project_id": "p1", "stages": [],
                                   "client_id": "tab-a"})
        resp = await _post_state(client, {"project_id": "p1", "heartbeat": True,
                                          "client_id": "tab-a"})
        assert resp.status == 200

    async def test_foreign_heartbeat_gets_409_while_fresh(self, client):
        await _post_state(client, {"project_id": "p1", "stages": [],
                                   "client_id": "tab-a"})
        resp = await _post_state(client, {"project_id": "p1", "heartbeat": True,
                                          "client_id": "tab-b"})
        assert resp.status == 409

    async def test_foreign_heartbeat_gets_404_when_stale(self, client):
        from ComfyTV.api import canvas_state
        await _post_state(client, {"project_id": "p1", "stages": [],
                                   "client_id": "tab-a"})
        canvas_state._mirrors["p1"]["received_at"] -= 120
        resp = await _post_state(client, {"project_id": "p1", "heartbeat": True,
                                          "client_id": "tab-b"})
        assert resp.status == 404

    async def test_full_post_always_takes_over(self, client):
        await _post_state(client, {"project_id": "p1", "stages": [],
                                   "client_id": "tab-a"})
        resp = await _post_state(client, {"project_id": "p1", "stages": [{}],
                                          "client_id": "tab-b"})
        assert resp.status == 200
        from ComfyTV.api.canvas_state import get_mirror_client_id
        assert get_mirror_client_id("p1") == "tab-b"

    async def test_legacy_heartbeat_without_client_still_touches(self, client):
        await _post_state(client, {"project_id": "p1", "stages": [],
                                   "client_id": "tab-a"})
        resp = await _post_state(client, {"project_id": "p1", "heartbeat": True})
        assert resp.status == 200


class TestWsObservability:
    async def test_ws_state_flows_to_canvas_and_summary(self, client):
        from ComfyTV.api.canvas_state import get_canvas_state, mirror_summary
        await _post_state(client, {"project_id": "p1", "stages": [],
                                   "client_id": "tab-a", "ws_connected": False})
        assert get_canvas_state("p1")["tab_ws_connected"] is False
        assert mirror_summary()[0]["tab_ws_connected"] is False

        await _post_state(client, {"project_id": "p1", "heartbeat": True,
                                   "client_id": "tab-a", "ws_connected": True})
        assert get_canvas_state("p1")["tab_ws_connected"] is True

    async def test_submit_fails_fast_when_ws_down(self, client):
        from ComfyTV.api.canvas_state import store_canvas_state
        from ComfyTV.api.mcp_commands import submit_command
        store_canvas_state("p1", [], client_id="tab-a", ws_connected=False)
        with pytest.raises(ValueError, match="websocket is disconnected"):
            await submit_command("run_stage", {"node": "1", "project_id": "p1"},
                                 timeout=5.0)

    async def test_timeout_message_mentions_fresh_mirror(self, client, monkeypatch):
        import server
        monkeypatch.setattr(server.PromptServer.instance, "send_sync",
                            lambda *a, **k: None)
        from ComfyTV.api.canvas_state import store_canvas_state
        from ComfyTV.api.mcp_commands import submit_command
        store_canvas_state("p1", [], client_id="tab-a", ws_connected=True)
        with pytest.raises(ValueError, match="websocket connection is likely"):
            await submit_command("run_stage", {"node": "1", "project_id": "p1"},
                                 timeout=0.05)

    async def test_timeout_message_without_mirror(self, client, monkeypatch):
        import server
        monkeypatch.setattr(server.PromptServer.instance, "send_sync",
                            lambda *a, **k: None)
        from ComfyTV.api.mcp_commands import submit_command
        with pytest.raises(ValueError, match="is the ComfyTV page open"):
            await submit_command("run_stage", {"node": "1"}, timeout=0.05)


class TestExecErrorCoverage:
    def test_wrapper_records_sync_and_async(self):
        from ComfyTV.runners.exec_errors import (
            clear_exec_errors, install_exec_error_recorder, list_exec_errors,
        )
        clear_exec_errors()

        class SyncStage:
            @classmethod
            def execute(cls, project_id="", **kwargs):
                raise RuntimeError("sync boom")

        class AsyncStage:
            @classmethod
            async def execute(cls, project_id="", **kwargs):
                raise RuntimeError("async boom")

        install_exec_error_recorder(SyncStage, "video")
        install_exec_error_recorder(AsyncStage, "audio")

        with pytest.raises(RuntimeError, match="sync boom"):
            SyncStage.execute(project_id="p1")
        with pytest.raises(RuntimeError, match="async boom"):
            asyncio.run(AsyncStage.execute(project_id="p2"))

        errors = list_exec_errors(10)
        assert len(errors) == 2
        assert errors[0]["label"] == "AsyncStage"
        assert errors[0]["kind"] == "audio"
        assert errors[0]["project_id"] == "p2"
        assert errors[1]["label"] == "SyncStage"

    def test_no_double_record(self):
        from ComfyTV.runners.exec_errors import (
            clear_exec_errors, install_exec_error_recorder, list_exec_errors,
            record_exec_error,
        )
        clear_exec_errors()

        class Inner:
            @classmethod
            def execute(cls, **kwargs):
                e = RuntimeError("already recorded downstream")
                record_exec_error(kind="video", label="Runner", error=e)
                raise e

        install_exec_error_recorder(Inner, "video")
        with pytest.raises(RuntimeError):
            Inner.execute()
        errors = list_exec_errors(10)
        assert len(errors) == 1
        assert errors[0]["label"] == "Runner"

    def test_install_is_idempotent(self):
        from ComfyTV.runners.exec_errors import install_exec_error_recorder

        class S:
            @classmethod
            def execute(cls, **kwargs):
                return "ok"

        install_exec_error_recorder(S, "image")
        first = S.execute.__func__
        install_exec_error_recorder(S, "image")
        assert S.execute.__func__ is first
        assert S.execute() == "ok"


class TestPromptLint:
    def _register(self, monkeypatch, cls):
        import nodes
        monkeypatch.setitem(nodes.NODE_CLASS_MAPPINGS, "ComfyTV.LintProbe", cls)
        from ComfyTV.api.prompt_lint import clear_lint_cache
        clear_lint_cache()

    def _probe_class(self):
        class _Tpl:
            names = ["video0", "video1", "video2"]

        class _In:
            def __init__(self, id, template=None):
                self.id = id
                self.template = template

        class _Schema:
            inputs = [_In("force_run_token"), _In("clip_order"),
                      _In("videos", _Tpl())]

        class LintProbe:
            @classmethod
            def GET_SCHEMA(cls):
                return _Schema()

        return LintProbe

    def test_flags_unknown_keys_with_autogrow_hint(self, client, monkeypatch):
        self._register(monkeypatch, self._probe_class())
        from ComfyTV.api.prompt_lint import lint_prompt
        findings = lint_prompt({
            "9": {"class_type": "ComfyTV.LintProbe", "inputs": {
                "clip_order": "", "videos.0": "x", "video1": "y",
                "videos.video2": "ok",
            }},
        })
        assert len(findings) == 1
        assert findings[0]["unknown"] == ["video1", "videos.0"]
        assert findings[0]["autogrow_formats"] == ["videos.videoN"]

    def test_clean_prompt_and_non_comfytv_ignored(self, client, monkeypatch):
        self._register(monkeypatch, self._probe_class())
        from ComfyTV.api.prompt_lint import lint_prompt
        assert lint_prompt({
            "1": {"class_type": "ComfyTV.LintProbe", "inputs": {
                "videos.video0": "a", "videos.video1": "b",
            }},
            "2": {"class_type": "KSampler", "inputs": {"bogus": 1}},
        }) == []

    def test_handler_registered_and_passthrough(self, client):
        import server
        from ComfyTV.api.prompt_lint import _on_prompt
        assert _on_prompt in server.PromptServer.instance.on_prompt_handlers
        data = {"prompt": {"1": {"class_type": "ComfyTV.Nope", "inputs": {}}}}
        assert _on_prompt(data) is data


class TestRemoveStageTool:
    @pytest.fixture()
    def fake_submit(self, monkeypatch):
        from ComfyTV.api import mcp_tools
        calls: dict = {}

        async def submit(action, payload, timeout=15.0):
            calls["action"] = action
            calls["payload"] = payload
            return {"removed": True}

        monkeypatch.setattr(mcp_tools, "submit_command", submit)
        return calls

    async def _call_tool(self, client, name, arguments):
        resp = await client.post("/comfytv/mcp", json={
            "jsonrpc": "2.0", "id": 1, "method": "tools/call",
            "params": {"name": name, "arguments": arguments},
        })
        data = await resp.json()
        return data["result"]

    async def test_remove_stage_submits(self, client, fake_submit):
        result = await self._call_tool(client, "remove_stage", {"node": "7"})
        assert result["isError"] is False
        assert json.loads(result["content"][0]["text"]) == {"removed": True}
        assert fake_submit["action"] == "remove_stage"
        assert fake_submit["payload"] == {"node": "7"}

    async def test_remove_stage_requires_node(self, client, fake_submit):
        result = await self._call_tool(client, "remove_stage", {})
        assert result["isError"] is True
        assert "node is required" in result["content"][0]["text"]
