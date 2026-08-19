from __future__ import annotations

import pytest


@pytest.fixture()
def bus(monkeypatch):
    from ComfyTV.api import mcp_tools
    calls: list[tuple[str, dict]] = []
    results: dict[str, dict] = {}

    async def fake_submit(action, payload, timeout=15.0):
        calls.append((action, payload))
        return results.get(action, {"ok": True})

    monkeypatch.setattr(mcp_tools, "submit_command", fake_submit)
    return {"calls": calls, "results": results}


class _FakeQueue:
    def __init__(self, entries=None):
        self.entries = entries or {}

    def get_history(self, prompt_id=None, **kw):
        entry = self.entries.get(prompt_id)
        return {prompt_id: entry} if entry else {}


@pytest.fixture()
def history(monkeypatch):
    import server
    queue = _FakeQueue()
    monkeypatch.setattr(server.PromptServer.instance, "prompt_queue", queue,
                        raising=False)
    return queue


class TestGraphGetEdit:
    async def test_get_passes_through(self, bus):
        from ComfyTV.api.mcp_tools import _graph_get
        await _graph_get({"project_id": "p1"})
        assert bus["calls"] == [("graph_get", {"project_id": "p1"})]

    async def test_edit_forwards_ops(self, bus):
        from ComfyTV.api.mcp_tools import _graph_edit
        ops = [{"op": "add_node", "type": "LoraLoader"},
               {"op": "connect", "from_node": "4", "to_node": "3"}]
        await _graph_edit({"ops": ops})
        action, payload = bus["calls"][0]
        assert action == "graph_edit"
        assert payload["ops"] == ops

    async def test_edit_rejects_bad_ops(self, bus):
        from ComfyTV.api.mcp_tools import _graph_edit
        with pytest.raises(ValueError, match="non-empty"):
            await _graph_edit({"ops": []})
        with pytest.raises(ValueError, match="ops\\[0\\]"):
            await _graph_edit({"ops": [{"op": "explode"}]})
        assert bus["calls"] == []

    async def test_edit_accepts_new_ops(self, bus):
        from ComfyTV.api.mcp_tools import _graph_edit
        ops = [{"op": "set_mode", "node": "17", "mode": "bypass"},
               {"op": "clone", "node": "3"},
               {"op": "set_color", "node": "3", "color": "#335"},
               {"op": "create_group", "title": "LoRA", "nodes": ["17"]},
               {"op": "collapse", "node": "3"},
               {"op": "pin", "node": "3", "pinned": False},
               {"op": "convert_to_subgraph", "nodes": ["3", "17"]},
               {"op": "unpack_subgraph", "node": "30"}]
        await _graph_edit({"ops": ops})
        assert bus["calls"][0][1]["ops"] == ops


class TestCanvasCommand:
    async def test_whitelisted_command_passes_through(self, bus):
        from ComfyTV.api.mcp_tools import _canvas_command
        await _canvas_command({"command": "Comfy.Undo"})
        assert bus["calls"] == [
            ("canvas_command", {"command": "Comfy.Undo"})]

    async def test_unlisted_command_rejected(self, bus):
        from ComfyTV.api.mcp_tools import _canvas_command
        with pytest.raises(ValueError, match="not allowed"):
            await _canvas_command({"command": "Comfy.ClearWorkflow"})
        assert bus["calls"] == []

    async def test_nodes_preselection_passthrough(self, bus):
        from ComfyTV.api.mcp_tools import _canvas_command
        await _canvas_command({"command": "Comfy.Graph.GroupSelectedNodes",
                               "nodes": ["1", 2]})
        assert bus["calls"] == [("canvas_command", {
            "command": "Comfy.Graph.GroupSelectedNodes",
            "nodes": ["1", 2]})]

    async def test_bad_nodes_rejected(self, bus):
        from ComfyTV.api.mcp_tools import _canvas_command
        with pytest.raises(ValueError, match="array of node ids"):
            await _canvas_command({"command": "Comfy.Canvas.FitView",
                                   "nodes": [{"id": 1}]})
        assert bus["calls"] == []


class TestCanvasFocus:
    async def test_requires_node(self, bus):
        from ComfyTV.api.mcp_tools import _canvas_focus
        with pytest.raises(ValueError, match="node is required"):
            await _canvas_focus({})

    async def test_passes_through(self, bus):
        from ComfyTV.api.mcp_tools import _canvas_focus
        await _canvas_focus({"node": "17"})
        assert bus["calls"] == [("canvas_focus", {"node": "17"})]


SUCCESS_ENTRY = {
    "outputs": {
        "9": {"images": [
            {"filename": "x.png", "subfolder": "", "type": "output"}]},
        "12": {"text": ["not a file"]},
    },
    "status": {"status_str": "success", "completed": True, "messages": []},
}

ERROR_ENTRY = {
    "outputs": {},
    "status": {"status_str": "error", "completed": False, "messages": [
        ["execution_start", {}],
        ["execution_error", {"node_id": "3", "node_type": "KSampler",
                             "exception_message": "boom"}],
    ]},
}


class TestGraphRun:
    async def test_queue_then_done(self, bus, history):
        from ComfyTV.api.mcp_tools import _graph_run
        bus["results"]["graph_run"] = {"queued": True, "prompt_id": "p1"}
        history.entries["p1"] = SUCCESS_ENTRY
        out = await _graph_run({})
        assert out["status"] == "done"
        assert out["prompt_id"] == "p1"
        assert out["outputs"] == [
            "/view?filename=x.png&subfolder=&type=output"]

    async def test_error_entry(self, bus, history):
        from ComfyTV.api.mcp_tools import _graph_run
        bus["results"]["graph_run"] = {"queued": True, "prompt_id": "p2"}
        history.entries["p2"] = ERROR_ENTRY
        out = await _graph_run({})
        assert out["status"] == "error"
        assert out["error"] == "KSampler (node 3): boom"

    async def test_timeout_returns_running(self, bus, history):
        from ComfyTV.api.mcp_tools import _graph_run
        bus["results"]["graph_run"] = {"queued": True, "prompt_id": "p3"}
        out = await _graph_run({"wait_s": 0})
        assert out["status"] == "running"
        assert "re-call" in out["hint"]

    async def test_rewait_skips_queueing(self, bus, history):
        from ComfyTV.api.mcp_tools import _graph_run
        history.entries["p4"] = SUCCESS_ENTRY
        out = await _graph_run({"prompt_id": "p4"})
        assert out["status"] == "done"
        assert bus["calls"] == []

    async def test_queue_rejection_passthrough(self, bus, history):
        from ComfyTV.api.mcp_tools import _graph_run
        bus["results"]["graph_run"] = {"queued": False}
        out = await _graph_run({})
        assert out == {"queued": False}
