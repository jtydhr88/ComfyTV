from __future__ import annotations

import asyncio

import pytest


STAGE = {
    "uid": "aabbccdd-1234-5678-9abc-def012345678",
    "graph_node_id": "7",
    "stage_class": "VideoStage",
    "last_run": {"status": "never"},
}


@pytest.fixture()
def mirror(reset_db):
    from ComfyTV.api.canvas_state import clear_canvas_state, store_canvas_state
    clear_canvas_state()
    store_canvas_state("default", [dict(STAGE)], client_id="tab-1")
    yield
    clear_canvas_state()


@pytest.fixture()
def wait_tool(mirror, monkeypatch):
    from ComfyTV.api import mcp_tools
    monkeypatch.setattr(mcp_tools, "_WAIT_POLL_S", 0.01)
    return mcp_tools._wait_stage


class TestWaitStage:
    async def test_requires_node(self, wait_tool):
        with pytest.raises(ValueError, match="node is required"):
            await wait_tool({})

    async def test_unknown_stage(self, wait_tool):
        with pytest.raises(ValueError, match="not found on the mirrored"):
            await wait_tool({"node": "nope-nope"})

    async def test_done_on_new_output(self, wait_tool):
        from ComfyTV import storage
        storage.ensure_default_project()

        async def _produce():
            await asyncio.sleep(0.05)
            row = storage.persist_output(
                project_id="default", stage_class="VideoStage",
                stage_node_id="7", output_type="video",
                payload_url="/view?x=1",
            )
            storage.set_output_stage_uid(row["id"], STAGE["uid"])

        task = asyncio.ensure_future(_produce())
        out = await wait_tool({"node": "7", "timeout_s": 5})
        await task
        assert out["status"] == "done"
        assert out["output"]["payload_url"] == "/view?x=1"

    async def test_ignores_preexisting_output(self, wait_tool):
        from ComfyTV import storage
        storage.ensure_default_project()
        row = storage.persist_output(
            project_id="default", stage_class="VideoStage",
            stage_node_id="7", output_type="video", payload_url="/view?old",
        )
        storage.set_output_stage_uid(row["id"], STAGE["uid"])
        out = await wait_tool({"node": STAGE["uid"][:8], "timeout_s": 2})
        assert out["status"] == "running"
        assert out["after_output_id"] > 0

    async def test_after_output_id_baseline(self, wait_tool):
        from ComfyTV import storage
        storage.ensure_default_project()
        row = storage.persist_output(
            project_id="default", stage_class="VideoStage",
            stage_node_id="7", output_type="video", payload_url="/view?new",
        )
        row = storage.set_output_stage_uid(row["id"], STAGE["uid"])
        out = await wait_tool({"node": "7", "timeout_s": 5,
                               "after_output_id": row["id"] - 1})
        assert out["status"] == "done"
        assert out["output"]["id"] == row["id"]

    async def test_error_from_mirror(self, wait_tool):
        from ComfyTV.api.canvas_state import store_canvas_state

        async def _fail():
            await asyncio.sleep(0.05)
            failed = dict(STAGE)
            failed["last_run"] = {"status": "error", "error": "boom"}
            store_canvas_state("default", [failed], client_id="tab-1")

        task = asyncio.ensure_future(_fail())
        out = await wait_tool({"node": "7", "timeout_s": 5})
        await task
        assert out["status"] == "error"
        assert out["error"] == "boom"

    async def test_preexisting_error_not_reported(self, wait_tool):
        from ComfyTV.api.canvas_state import store_canvas_state
        failed = dict(STAGE)
        failed["last_run"] = {"status": "error", "error": "old failure"}
        store_canvas_state("default", [failed], client_id="tab-1")
        out = await wait_tool({"node": "7", "timeout_s": 2})
        assert out["status"] == "running"

    async def test_timeout_returns_running(self, wait_tool):
        out = await wait_tool({"node": "7", "timeout_s": 2})
        assert out["status"] == "running"
        assert out["after_output_id"] == 0
        assert "wait_stage again" in out["hint"]
