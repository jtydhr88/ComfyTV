"""Tests for storage.py — Project + Output CRUD + retention pruning."""

from __future__ import annotations

import json
import pytest


class TestProjects:
    def test_ensure_default_project_idempotent(self, reset_db):
        from ComfyTV import storage
        p1 = storage.ensure_default_project()
        p2 = storage.ensure_default_project()
        assert p1["id"] == storage.DEFAULT_PROJECT_ID
        assert p1["id"] == p2["id"]

    def test_list_projects_includes_default(self, reset_db):
        from ComfyTV import storage
        storage.ensure_default_project()
        names = [p["id"] for p in storage.list_projects()]
        assert storage.DEFAULT_PROJECT_ID in names

    def test_get_existing_and_missing(self, reset_db):
        from ComfyTV import storage
        storage.ensure_default_project()
        proj = storage.get_project(storage.DEFAULT_PROJECT_ID)
        assert proj["id"] == storage.DEFAULT_PROJECT_ID
        assert storage.get_project("does-not-exist") is None

    def test_create_project(self, reset_db):
        from ComfyTV import storage
        proj = storage.create_project("My Project")
        assert proj["name"] == "My Project"
        assert len(proj["id"]) > 0

    def test_create_blank_name_defaults_to_untitled(self, reset_db):
        from ComfyTV import storage
        proj = storage.create_project("   ")
        assert proj["name"] == "Untitled"

    def test_rename_project(self, reset_db):
        from ComfyTV import storage
        proj = storage.create_project("Orig")
        renamed = storage.rename_project(proj["id"], "New")
        assert renamed["name"] == "New"

    def test_rename_blank_keeps_existing(self, reset_db):
        from ComfyTV import storage
        proj = storage.create_project("Orig")
        renamed = storage.rename_project(proj["id"], "   ")
        assert renamed["name"] == "Orig"

    def test_rename_missing_returns_none(self, reset_db):
        from ComfyTV import storage
        assert storage.rename_project("nope", "X") is None

    def test_delete_project_removes_outputs(self, reset_db):
        from ComfyTV import storage
        proj = storage.create_project("To Delete")
        storage.persist_output(
            project_id=proj["id"], stage_class="ImageStage",
            stage_node_id="1", output_type="image",
            payload_url="/view?filename=a.png",
        )
        assert storage.delete_project(proj["id"]) is True
        assert storage.list_outputs(proj["id"]) == []

    def test_delete_default_refused(self, reset_db):
        from ComfyTV import storage
        storage.ensure_default_project()
        assert storage.delete_project(storage.DEFAULT_PROJECT_ID) is False

    def test_delete_missing_returns_false(self, reset_db):
        from ComfyTV import storage
        assert storage.delete_project("nope") is False


class TestOutputs:
    def test_persist_basic(self, reset_db):
        from ComfyTV import storage
        out = storage.persist_output(
            project_id="default", stage_class="ImageStage",
            stage_node_id="42", output_type="image",
            payload_url="/view?filename=x.png",
        )
        assert out is not None
        assert out["project_id"] == "default"
        assert out["stage_node_id"] == "42"
        assert out["payload_url"] == "/view?filename=x.png"

    def test_persist_with_payload_json_and_params(self, reset_db):
        from ComfyTV import storage
        out = storage.persist_output(
            project_id="default", stage_class="ImageStage",
            stage_node_id="1", output_type="images",
            payload_url="", payload_json={"images": [{"label": "#1"}]},
            params={"seed": 42, "extra": object()},  # object → default=str
        )
        assert out["payload_json"] == {"images": [{"label": "#1"}]}
        assert out["params_json"]["seed"] == 42

    def test_blank_project_id_uses_default(self, reset_db):
        from ComfyTV import storage
        out = storage.persist_output(
            project_id="   ", stage_class="X", stage_node_id="1",
            output_type="image", payload_url="x",
        )
        assert out["project_id"] == storage.DEFAULT_PROJECT_ID

    def test_unknown_project_falls_back_to_default(self, reset_db):
        from ComfyTV import storage
        out = storage.persist_output(
            project_id="missing-id", stage_class="X", stage_node_id="1",
            output_type="image", payload_url="x",
        )
        assert out["project_id"] == storage.DEFAULT_PROJECT_ID

    def test_list_outputs_filters_by_node(self, reset_db):
        from ComfyTV import storage
        storage.persist_output(project_id="default", stage_class="X",
                               stage_node_id="1", output_type="image",
                               payload_url="a")
        storage.persist_output(project_id="default", stage_class="X",
                               stage_node_id="2", output_type="image",
                               payload_url="b")
        rows = storage.list_outputs("default", stage_node_id="2")
        assert len(rows) == 1
        assert rows[0]["payload_url"] == "b"

    def test_list_outputs_orders_newest_first(self, reset_db):
        from ComfyTV import storage
        for i in range(3):
            storage.persist_output(project_id="default", stage_class="X",
                                   stage_node_id="1", output_type="image",
                                   payload_url=f"img-{i}")
        rows = storage.list_outputs("default", stage_node_id="1")
        # newest first → img-2, img-1, img-0
        assert [r["payload_url"] for r in rows] == ["img-2", "img-1", "img-0"]

    def test_latest_output(self, reset_db):
        from ComfyTV import storage
        for i in range(3):
            storage.persist_output(project_id="default", stage_class="X",
                                   stage_node_id="9", output_type="image",
                                   payload_url=f"img-{i}")
        latest = storage.latest_output("default", "9")
        assert latest["payload_url"] == "img-2"

    def test_latest_output_returns_none_when_empty(self, reset_db):
        from ComfyTV import storage
        storage.ensure_default_project()
        assert storage.latest_output("default", "999") is None

    def test_retention_prune(self, reset_db, monkeypatch):
        from ComfyTV import storage
        monkeypatch.setattr(storage, "OUTPUT_RETENTION_PER_STAGE", 3)
        for i in range(6):
            storage.persist_output(project_id="default", stage_class="X",
                                   stage_node_id="1", output_type="image",
                                   payload_url=f"img-{i}")
        rows = storage.list_outputs("default", stage_node_id="1", limit=100)
        assert len(rows) == 3
        # Newest three preserved.
        assert [r["payload_url"] for r in rows] == ["img-5", "img-4", "img-3"]

    def test_no_prune_when_stage_node_id_null(self, reset_db, monkeypatch):
        from ComfyTV import storage
        monkeypatch.setattr(storage, "OUTPUT_RETENTION_PER_STAGE", 2)
        for i in range(5):
            storage.persist_output(project_id="default", stage_class="X",
                                   stage_node_id=None, output_type="image",
                                   payload_url=f"img-{i}")
        rows = storage.list_outputs("default", limit=100)
        # When stage_node_id is None, pruning is skipped — all 5 kept.
        assert len([r for r in rows if r["stage_node_id"] is None]) == 5

    def test_output_to_dict_handles_nulls(self, reset_db):
        from ComfyTV import storage
        out = storage.persist_output(
            project_id="default", stage_class="X", stage_node_id="1",
            output_type="image", payload_url="x",
        )
        assert out["payload_json"] is None
        assert out["params_json"] is None
        assert out["parent_output_id"] is None
        assert out["created_at"] is not None
