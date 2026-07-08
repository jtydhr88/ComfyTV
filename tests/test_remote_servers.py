"""Tests for the multi-machine feature: server storage CRUD, execute-kwargs
shaping, __server routing, and remote workflow file-ref scanning."""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest


class TestServerStorage:
    def test_create_list_get(self, reset_db):
        from ComfyTV import storage
        row = storage.create_server(label="rig", host="192.168.1.20", port=8188)
        assert row["id"] > 0
        assert row["enabled"] is True
        assert storage.get_server(row["id"])["label"] == "rig"
        assert [s["label"] for s in storage.list_servers()] == ["rig"]

    def test_create_rejects_blank_and_duplicate_label(self, reset_db):
        from ComfyTV import storage
        assert storage.create_server(label="", host="x", port=1) is None
        assert storage.create_server(label="a", host="", port=1) is None
        storage.create_server(label="rig", host="h1", port=8188)
        assert storage.create_server(label="rig", host="h2", port=8188) is None

    def test_update_and_toggle(self, reset_db):
        from ComfyTV import storage
        row = storage.create_server(label="rig", host="h", port=8188)
        updated = storage.update_server(row["id"], host="new-host", port=8288,
                                        enabled=False)
        assert updated["host"] == "new-host"
        assert updated["port"] == 8288
        assert updated["enabled"] is False

    def test_update_label_clash_returns_none(self, reset_db):
        from ComfyTV import storage
        storage.create_server(label="a", host="h", port=1)
        b = storage.create_server(label="b", host="h", port=1)
        assert storage.update_server(b["id"], label="a") is None

    def test_delete(self, reset_db):
        from ComfyTV import storage
        row = storage.create_server(label="rig", host="h", port=8188)
        assert storage.delete_server(row["id"]) is True
        assert storage.delete_server(row["id"]) is False
        assert storage.list_servers() == []


class TestRemoteJobStorage:
    def test_lifecycle(self, reset_db):
        from ComfyTV import storage
        srv = storage.create_server(label="rig", host="h", port=8188)
        job = storage.create_remote_job(
            job_id="j1", server_id=srv["id"], server_label="rig",
            project_id="p", stage_node_id="42", stage_uid="uid-1",
        )
        assert job["status"] == "queued"
        storage.update_remote_job("j1", status="running", remote_prompt_id="rp")
        storage.update_remote_job("j1", status="done", output_id=None)
        got = storage.get_remote_job("j1")
        assert got["status"] == "done"
        assert got["remote_prompt_id"] == "rp"
        assert storage.list_remote_jobs(status="done")[0]["id"] == "j1"
        assert storage.list_remote_jobs(status="running") == []


def _fake_stage_cls():
    texts = SimpleNamespace(
        id="texts", template=SimpleNamespace(names=["text0", "text1", "text2"]))
    images = SimpleNamespace(
        id="images", template=SimpleNamespace(names=["image0", "image1"]))
    plain = [SimpleNamespace(id=i, template=None)
             for i in ("force_run_token", "project_id", "workflow",
                       "main_prompt", "custom_params")]

    class FakeStage:
        __name__ = "FakeStage"

        @classmethod
        def define_schema(cls):
            return SimpleNamespace(inputs=[*plain, texts, images])

    return FakeStage


class TestBuildExecuteKwargs:
    def test_groups_autogrow_and_passes_plain(self, reset_db):
        from ComfyTV.api.servers import build_execute_kwargs
        kwargs = build_execute_kwargs(_fake_stage_cls(), {
            "workflow": "Flux",
            "main_prompt": "a cat",
            "text0": "t0",
            "text2": "t2",
            "image0": "/view?filename=a.png",
            "unknown_key": "dropped",
        })
        assert kwargs["workflow"] == "Flux"
        assert kwargs["texts"] == {"text0": "t0", "text2": "t2"}
        assert list(kwargs["texts"]) == ["text0", "text2"]  # index order kept
        assert kwargs["images"] == {"image0": "/view?filename=a.png"}
        assert "unknown_key" not in kwargs

    def test_missing_inputs_yield_empty_group(self, reset_db):
        from ComfyTV.api.servers import build_execute_kwargs
        kwargs = build_execute_kwargs(_fake_stage_cls(), {"workflow": "X"})
        assert kwargs["texts"] == {}
        assert "main_prompt" not in kwargs


class TestInjectServer:
    def test_inject_into_empty(self, reset_db):
        from ComfyTV.api.servers import _inject_server
        kwargs = {}
        _inject_server(kwargs, 7)
        data = json.loads(kwargs["custom_params"])
        assert data["items"] == [{"key": "__server", "value": 7}]

    def test_preserves_existing_items_and_replaces_server(self, reset_db):
        from ComfyTV.api.servers import _inject_server
        kwargs = {"custom_params": json.dumps({
            "items": [
                {"key": "steps", "value": 20},
                {"key": "__server", "value": 1},
            ],
        })}
        _inject_server(kwargs, 9)
        items = json.loads(kwargs["custom_params"])["items"]
        assert {"key": "steps", "value": 20} in items
        assert [it for it in items if it["key"] == "__server"] == [
            {"key": "__server", "value": 9}]

    def test_tolerates_garbage_custom_params(self, reset_db):
        from ComfyTV.api.servers import _inject_server
        kwargs = {"custom_params": "not json"}
        _inject_server(kwargs, 3)
        data = json.loads(kwargs["custom_params"])
        assert data["items"][0]["key"] == "__server"


class TestServerRouting:
    def test_local_and_empty_pass_through(self, reset_db):
        from ComfyTV.nodes.stages.common.invoke import _route_server
        runner = object()
        assert _route_server(runner, None) is runner
        assert _route_server(runner, "") is runner
        assert _route_server(runner, "local") is runner

    def test_unknown_server_raises(self, reset_db):
        from ComfyTV.nodes.stages.common.invoke import _route_server, StageError
        from ComfyTV.runners.local_comfy import LocalComfyUIRunner
        runner = LocalComfyUIRunner("image/X", "X", {"image"})
        with pytest.raises(StageError, match="not found"):
            _route_server(runner, 999)

    def test_disabled_server_raises(self, reset_db):
        from ComfyTV import storage
        from ComfyTV.nodes.stages.common.invoke import _route_server, StageError
        from ComfyTV.runners.local_comfy import LocalComfyUIRunner
        srv = storage.create_server(label="rig", host="h", port=8188)
        storage.update_server(srv["id"], enabled=False)
        runner = LocalComfyUIRunner("image/X", "X", {"image"})
        with pytest.raises(StageError, match="disabled"):
            _route_server(runner, srv["id"])

    def test_wraps_local_runner(self, reset_db):
        from ComfyTV import storage
        from ComfyTV.nodes.stages.common.invoke import _route_server
        from ComfyTV.runners.local_comfy import LocalComfyUIRunner
        from ComfyTV.runners.remote_comfy import RemoteComfyUIRunner
        srv = storage.create_server(label="rig", host="h", port=8188)
        runner = LocalComfyUIRunner("image/X", "X", {"image"})
        wrapped = _route_server(runner, srv["id"])
        assert isinstance(wrapped, RemoteComfyUIRunner)
        assert wrapped.id == "image/X"
        assert wrapped.server["label"] == "rig"

    def test_non_local_runner_rejected(self, reset_db):
        from ComfyTV import storage
        from ComfyTV.nodes.stages.common.invoke import _route_server, StageError
        from ComfyTV.runners.fake_multishot import FakeMultishotRunner
        srv = storage.create_server(label="rig", host="h", port=8188)
        runner = FakeMultishotRunner("fake", "Fake", {"timeline"})
        with pytest.raises(StageError, match="not a ComfyUI workflow runner"):
            _route_server(runner, srv["id"])


class TestAnnotatedRefScan:
    def test_collects_and_maps_sites(self):
        from ComfyTV.runners.remote_comfy import _collect_annotated_refs
        workflow = {
            "1": {"class_type": "LoadImage",
                  "inputs": {"image": "painter/m.png [input]"}},
            "2": {"class_type": "LoadImage",
                  "inputs": {"image": "runs/out.png [output]",
                             "other": 3,
                             "link": ["1", 0]}},
            "3": {"class_type": "KSampler",
                  "inputs": {"seed": 5, "text": "no ref here"}},
            "4": {"class_type": "LoadImageMask",
                  "inputs": {"image": "painter/m.png [input]"}},
        }
        refs = _collect_annotated_refs(workflow)
        assert set(refs) == {"painter/m.png [input]", "runs/out.png [output]"}
        assert sorted(refs["painter/m.png [input]"]) == [("1", "image"), ("4", "image")]
        assert refs["runs/out.png [output]"] == [("2", "image")]

    def test_ignores_plain_strings(self):
        from ComfyTV.runners.remote_comfy import _collect_annotated_refs
        workflow = {"1": {"inputs": {"text": "hello [world] extra"}}}
        assert _collect_annotated_refs(workflow) == {}


class TestSafePathComponent:
    def test_sanitizes(self):
        from ComfyTV.runners.remote_comfy import _safe_path_component
        assert _safe_path_component("GPU rig #2 (4090)") == "GPU_rig_2_4090"
        assert _safe_path_component("") == "server"
