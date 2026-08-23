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


class TestFastCompletionRace:
    @pytest.fixture(autouse=True)
    def clean_run_registry(self):
        from ComfyTV.api import mcp_tools
        mcp_tools._RUN_STARTED.clear()
        yield
        mcp_tools._RUN_STARTED.clear()

    async def test_done_when_output_born_after_run_start(self, wait_tool):
        import time as _time
        from ComfyTV import storage
        from ComfyTV.api import mcp_tools
        storage.ensure_default_project()
        mcp_tools._RUN_STARTED[STAGE["uid"]] = _time.time() - 5
        row = storage.persist_output(
            project_id="default", stage_class="VideoStage",
            stage_node_id="7", output_type="video", payload_url="/view?fast",
        )
        storage.set_output_stage_uid(row["id"], STAGE["uid"])
        out = await wait_tool({"node": "7", "timeout_s": 5})
        assert out["status"] == "done"
        assert out["output"]["payload_url"] == "/view?fast"
        assert out["waited_s"] < 2

    async def test_stale_output_before_run_start_still_waits(self, wait_tool):
        import time as _time
        from ComfyTV import storage
        from ComfyTV.api import mcp_tools
        storage.ensure_default_project()
        row = storage.persist_output(
            project_id="default", stage_class="VideoStage",
            stage_node_id="7", output_type="video", payload_url="/view?old",
        )
        storage.set_output_stage_uid(row["id"], STAGE["uid"])
        mcp_tools._RUN_STARTED[STAGE["uid"]] = _time.time() + 60
        out = await wait_tool({"node": "7", "timeout_s": 2})
        assert out["status"] == "running"

    async def test_run_stage_records_start(self, mirror, monkeypatch):
        from ComfyTV.api import mcp_tools

        async def submit(action, payload, timeout=15.0):
            return {"started": True, "uid": "uid-recorded"}

        monkeypatch.setattr(mcp_tools, "submit_command", submit)
        await mcp_tools._run_stage({"node": "7"})
        assert "uid-recorded" in mcp_tools._RUN_STARTED

    async def test_not_started_not_recorded(self, mirror, monkeypatch):
        from ComfyTV.api import mcp_tools

        async def submit(action, payload, timeout=15.0):
            return {"ok": True}

        monkeypatch.setattr(mcp_tools, "submit_command", submit)
        await mcp_tools._run_stage({"node": "7"})
        assert mcp_tools._RUN_STARTED == {}


class TestFastFailureRace:
    @pytest.fixture(autouse=True)
    def clean_run_registry(self):
        from ComfyTV.api import mcp_tools
        mcp_tools._RUN_STARTED.clear()
        yield
        mcp_tools._RUN_STARTED.clear()

    async def test_error_landed_after_run_start_is_reported(self, wait_tool):
        import time as _time
        from ComfyTV.api import mcp_tools
        from ComfyTV.api.canvas_state import store_canvas_state
        mcp_tools._RUN_STARTED[STAGE["uid"]] = _time.time() - 5
        failed = dict(STAGE)
        failed["last_run"] = {"status": "error", "error": "instant boom"}
        store_canvas_state("default", [failed], client_id="tab-1")
        out = await wait_tool({"node": "7", "timeout_s": 5})
        assert out["status"] == "error"
        assert out["error"] == "instant boom"
        assert out["waited_s"] < 2

    async def test_error_landed_before_run_start_still_waits(self, wait_tool):
        import time as _time
        from ComfyTV.api import mcp_tools
        from ComfyTV.api.canvas_state import store_canvas_state
        failed = dict(STAGE)
        failed["last_run"] = {"status": "error", "error": "old failure"}
        store_canvas_state("default", [failed], client_id="tab-1")
        mcp_tools._RUN_STARTED[STAGE["uid"]] = _time.time() + 60
        out = await wait_tool({"node": "7", "timeout_s": 2})
        assert out["status"] == "running"

    async def test_same_message_reerror_is_reported(self, wait_tool):
        from ComfyTV.api.canvas_state import store_canvas_state
        failed = dict(STAGE)
        failed["last_run"] = {"status": "error", "error": "boom"}
        store_canvas_state("default", [failed], client_id="tab-1")

        async def _refail():
            await asyncio.sleep(0.05)
            running = dict(STAGE)
            running["last_run"] = {"status": "running"}
            store_canvas_state("default", [running], client_id="tab-1")
            await asyncio.sleep(0.05)
            refailed = dict(STAGE)
            refailed["last_run"] = {"status": "error", "error": "boom"}
            store_canvas_state("default", [refailed], client_id="tab-1")

        task = asyncio.ensure_future(_refail())
        out = await wait_tool({"node": "7", "timeout_s": 5})
        await task
        assert out["status"] == "error"
        assert out["error"] == "boom"


class TestLastRunStamping:
    def test_first_store_stamps(self, mirror):
        from ComfyTV.api.canvas_state import get_canvas_state
        run = get_canvas_state("default")["stages"][0]["last_run"]
        assert isinstance(run["changed_at"], float)

    def test_unchanged_run_keeps_stamp(self, mirror):
        from ComfyTV.api.canvas_state import get_canvas_state, store_canvas_state
        first = get_canvas_state("default")["stages"][0]["last_run"]["changed_at"]
        store_canvas_state("default", [dict(STAGE)], client_id="tab-1")
        again = get_canvas_state("default")["stages"][0]["last_run"]["changed_at"]
        assert again == first

    def test_changed_run_restamps(self, mirror):
        import time as _time
        from ComfyTV.api.canvas_state import get_canvas_state, store_canvas_state
        first = get_canvas_state("default")["stages"][0]["last_run"]["changed_at"]
        _time.sleep(0.01)
        failed = dict(STAGE)
        failed["last_run"] = {"status": "error", "error": "boom"}
        store_canvas_state("default", [failed], client_id="tab-1")
        run = get_canvas_state("default")["stages"][0]["last_run"]
        assert run["status"] == "error"
        assert run["changed_at"] > first
