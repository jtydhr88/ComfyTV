from __future__ import annotations

import json
import pytest

from ComfyTV.runners import workflow_db as wdb

from workflow_db_helpers import make_workflow


class TestWorkflowCRUD:
    def test_get_workflow_for_invoke_returns_none_when_missing(self, reset_db):
        assert wdb.get_workflow_for_invoke("image", "Nope") is None

    def test_get_workflow_for_invoke_raises_when_unconvertible(
            self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        make_workflow(wdir, "sd15", "image")
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))
        with pytest.raises(RuntimeError, match="could not be converted"):
            wdb.get_workflow_for_invoke("image", "sd15")

    def test_get_workflow_for_invoke_happy_path(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        make_workflow(wdir, "sd15", "image", preset={
            "label": "SD 1.5",
            "result": {"type": "ui_save_batch", "node": "9"},
            "sizing": {"base": 512, "snap": 8},
            "inputs": {"3": {"seed": {"from": "option:seed", "cast": "int"}}},
        })
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))

        # Stamp api_json so invoke is allowed.
        api = {"3": {"class_type": "KSampler", "inputs": {"seed": 0}}}
        mtime = (wdir / "image" / "sd15.json").stat().st_mtime
        assert wdb.set_api_json("image", "SD 1.5", api, mtime)

        cfg = wdb.get_workflow_for_invoke("image", "SD 1.5")
        assert cfg is not None
        assert cfg["api_json"] == api
        assert cfg["result"] == {"type": "ui_save_batch", "node": "9"}
        assert cfg["sizing"] == {"base": 512, "snap": 8}
        assert cfg["inputs"]["3"]["seed"]["from"] == "option:seed"

    def test_get_workflow_for_invoke_reconverts_edited_file(
            self, reset_db, tmp_path, monkeypatch):
        import os
        from pathlib import Path
        wdir = tmp_path / "workflows"
        make_workflow(wdir, "sd15", "image")
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))
        path = wdir / "image" / "sd15.json"
        api = {"3": {"class_type": "KSampler", "inputs": {"seed": 0}}}
        assert wdb.set_api_json("image", "sd15", api, path.stat().st_mtime)
        assert wdb.get_workflow_for_invoke("image", "sd15")["api_json"] == api

        st = path.stat()
        os.utime(path, (st.st_atime, st.st_mtime + 10))
        with pytest.raises(RuntimeError, match="could not be converted"):
            wdb.get_workflow_for_invoke("image", "sd15")

    def test_set_api_json_invalid_workflow(self, reset_db):
        assert wdb.set_api_json("image", "Nope", {}, 0.0) is False

    def test_set_api_json_prunes_orphaned_bindings(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        make_workflow(wdir, "sd15", "image")
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))
        wid = wdb.get_workflow_config("image", "sd15")["id"]

        wdb.upsert_input_binding(wid, "3", "seed", "option:seed")
        wdb.upsert_input_binding(wid, "42", "text", "main_prompt")

        wdb.set_api_json(
            "image", "sd15",
            {"3": {"class_type": "KSampler", "inputs": {"seed": 0}}},
            200.0,
        )

        cfg = wdb.get_workflow_config("image", "sd15")
        node_ids = {b["node_id"] for b in cfg["bindings"]}
        assert node_ids == {"3"}, "orphaned binding on node 42 should be pruned"

    def test_set_api_json_keeps_bindings_when_nodes_unchanged(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        make_workflow(wdir, "sd15", "image")
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))
        wid = wdb.get_workflow_config("image", "sd15")["id"]

        wdb.upsert_input_binding(wid, "3", "seed", "option:seed")
        # Same node id present → binding must survive a re-prep (e.g. value-only edit).
        wdb.set_api_json(
            "image", "sd15",
            {"3": {"class_type": "KSampler", "inputs": {"seed": 5}}},
            300.0,
        )
        cfg = wdb.get_workflow_config("image", "sd15")
        assert {b["node_id"] for b in cfg["bindings"]} == {"3"}

    def test_upsert_then_delete_binding(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        make_workflow(wdir, "sd15", "image")
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))
        cfg = wdb.get_workflow_config("image", "sd15")
        wid = cfg["id"]

        # insert
        assert wdb.upsert_input_binding(
            wid, "3", "seed", "option:seed", default="random_int31",
            cast="int", required=True, error_msg="oops",
        )
        cfg2 = wdb.get_workflow_config("image", "sd15")
        b = cfg2["bindings"][0]
        assert b["from"] == "option:seed"
        assert b["required"] is True
        assert b["cast"] == "int"
        assert b["error_msg"] == "oops"

        # update (same key) — different from_
        wdb.upsert_input_binding(wid, "3", "seed", "main_prompt")
        cfg3 = wdb.get_workflow_config("image", "sd15")
        b = cfg3["bindings"][0]
        assert b["from"] == "main_prompt"
        assert b["cast"] is None  # cleared

        # delete
        assert wdb.delete_input_binding(wid, "3", "seed")
        cfg4 = wdb.get_workflow_config("image", "sd15")
        assert cfg4["bindings"] == []

        # second delete: false
        assert wdb.delete_input_binding(wid, "3", "seed") is False

    def test_upsert_binding_unknown_workflow(self, reset_db):
        assert wdb.upsert_input_binding(99999, "x", "y", "main_prompt") is False

    def test_update_workflow_meta_partial(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        make_workflow(wdir, "sd15", "image", preset={"description": "orig"})
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))
        cfg = wdb.get_workflow_config("image", "sd15")
        wid = cfg["id"]

        # Update only description; sizing/result untouched.
        assert wdb.update_workflow_meta(wid, description="new desc")
        cfg2 = wdb.get_workflow_config("image", "sd15")
        assert cfg2["description"] == "new desc"

        # Clear it explicitly with None.
        wdb.update_workflow_meta(wid, description=None)
        cfg3 = wdb.get_workflow_config("image", "sd15")
        assert cfg3["description"] is None

        # Set sizing.
        wdb.update_workflow_meta(wid, sizing={"base": 1024, "snap": 16})
        cfg4 = wdb.get_workflow_config("image", "sd15")
        assert cfg4["sizing"] == {"base": 1024, "snap": 16}

        # Clear sizing with empty dict (treated as falsy → None).
        wdb.update_workflow_meta(wid, sizing={})
        cfg5 = wdb.get_workflow_config("image", "sd15")
        assert cfg5["sizing"] == {}

    def test_update_meta_missing_workflow(self, reset_db):
        assert wdb.update_workflow_meta(99999, description="x") is False

    def test_update_workflow_meta_json_blob(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        make_workflow(wdir, "h3ref", "video", preset={})
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("video",))
        cfg = wdb.get_workflow_config("video", "h3ref")
        wid = cfg["id"]
        assert cfg["meta"] == {}

        assert wdb.update_workflow_meta(wid, meta={"mention_style": "minimax_tags"})
        cfg2 = wdb.get_workflow_config("video", "h3ref")
        assert cfg2["meta"] == {"mention_style": "minimax_tags"}

        wdb.set_api_json("video", "h3ref", {"1": {"class_type": "SaveVideo", "inputs": {}}},
                         (wdir / "video" / "h3ref.json").stat().st_mtime)
        invoke = wdb.get_workflow_for_invoke("video", "h3ref")
        assert invoke["meta"] == {"mention_style": "minimax_tags"}

        preset = wdb.build_preset("video", "h3ref")
        assert preset["meta"] == {"mention_style": "minimax_tags"}

        wdb.update_workflow_meta(wid, meta={})
        cfg3 = wdb.get_workflow_config("video", "h3ref")
        assert cfg3["meta"] == {}

    def test_seed_preset_meta(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        make_workflow(wdir, "h3ref", "video", preset={
            "meta": {"mention_style": "minimax_tags"},
        })
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("video",))
        cfg = wdb.get_workflow_config("video", "h3ref")
        assert cfg["meta"] == {"mention_style": "minimax_tags"}

    def test_list_workflow_bindings(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        make_workflow(wdir, "sd15", "image", preset={
            "inputs": {"3": {"seed": {"from": "option:seed", "required": True}}},
        })
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))
        out = wdb.list_workflow_bindings()
        assert len(out) == 1
        assert out[0]["kind"] == "image"
        assert out[0]["bindings"] == [{"from": "option:seed", "required": True}]

    def test_get_workflow_state_paths(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        make_workflow(wdir, "sd15", "image")
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))
        state = wdb.get_workflow_state("image", "sd15")
        assert state is not None
        assert state["has_api"] is False
        assert state["file_exists"] is True

    def test_get_workflow_state_invalidates_on_mtime_change(
            self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        make_workflow(wdir, "sd15", "image")
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))
        wdb.set_api_json("image", "sd15", {"3": {}}, 1.0)
        # Now the file gets re-touched; mtime changes.
        fpath = wdir / "image" / "sd15.json"
        fpath.write_text(json.dumps({"nodes": [{"id": 1}]}))  # bumps mtime
        state = wdb.get_workflow_state("image", "sd15")
        # has_api should now be False because mtime mismatch invalidated cache.
        assert state["has_api"] is False

    def test_get_workflow_state_unknown(self, reset_db):
        assert wdb.get_workflow_state("image", "Nope") is None

    def test_get_workflow_state_wipes_stale_api_json(
            self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        kind_dir = wdir / "image"
        kind_dir.mkdir(parents=True)
        (kind_dir / "sd15.json").write_text(json.dumps({
            "nodes": [{"id": 158, "type": "SaveImage"},
                      {"id": 98,  "type": "Subgraph"}],
        }))
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))

        stale_api = {str(i): {"class_type": "X", "inputs": {}} for i in range(24, 30)}
        mtime = (kind_dir / "sd15.json").stat().st_mtime
        wdb.set_api_json("image", "sd15", stale_api, mtime)

        state = wdb.get_workflow_state("image", "sd15")
        assert state is not None
        assert state["has_api"] is False

        again = wdb.get_workflow_state("image", "sd15")
        assert again["has_api"] is False

    def test_get_workflow_state_keeps_matching_api_json(
            self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        kind_dir = wdir / "image"
        kind_dir.mkdir(parents=True)
        (kind_dir / "sd15.json").write_text(json.dumps({
            "nodes": [{"id": 158, "type": "SaveImage"},
                      {"id": 98,  "type": "Subgraph"}],
        }))
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))

        good_api = {
            "158": {"class_type": "SaveImage", "inputs": {}},
            "98:9": {"class_type": "VAELoader", "inputs": {}},
        }
        mtime = (kind_dir / "sd15.json").stat().st_mtime
        wdb.set_api_json("image", "sd15", good_api, mtime)

        state = wdb.get_workflow_state("image", "sd15")
        assert state["has_api"] is True

    def test_read_workflow_file_happy(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        make_workflow(wdir, "sd15", "image")
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))
        pair = wdb.read_workflow_file("image", "sd15")
        assert pair is not None
        content, mtime = pair
        assert json.loads(content) == {"nodes": []}
        assert isinstance(mtime, float)

    def test_read_workflow_file_unknown(self, reset_db):
        assert wdb.read_workflow_file("image", "Nope") is None


class TestListWorkflowsOverview:
    def _seed_one(self, tmp_path, monkeypatch, name="sd15", kind="image",
                  content: str | None = None) -> None:
        from pathlib import Path
        wdir = tmp_path / "workflows"
        kind_dir = wdir / kind
        kind_dir.mkdir(parents=True, exist_ok=True)
        (kind_dir / f"{name}.json").write_text(
            content if content is not None else json.dumps({"nodes": []})
        )
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk((kind,))

    def test_fields_for_healthy_workflow(self, reset_db, tmp_path, monkeypatch):
        self._seed_one(tmp_path, monkeypatch, "sd15", "image")
        rows = wdb.list_workflows_overview()
        row = next(r for r in rows if r["kind"] == "image" and r["label"] == "sd15")
        assert row["file_exists"] is True
        assert row["gui_valid"] is True
        assert row["has_api"] is False
        assert row["link_type"] == 0
        assert row["file_path"].endswith("sd15.json")
        assert isinstance(row["id"], int)
        assert row["file_mtime"] is not None

    def test_kind_filter(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        for kind, name in (("image", "a"), ("video", "b")):
            kd = wdir / kind
            kd.mkdir(parents=True, exist_ok=True)
            (kd / f"{name}.json").write_text(json.dumps({"nodes": []}))
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image", "video"))

        rows = wdb.list_workflows_overview("video")
        assert rows and all(r["kind"] == "video" for r in rows)

    def test_non_gui_file_flagged_invalid(self, reset_db, tmp_path, monkeypatch):
        api_format = json.dumps({"3": {"class_type": "KSampler", "inputs": {}}})
        self._seed_one(tmp_path, monkeypatch, "apionly", "image", content=api_format)
        rows = wdb.list_workflows_overview("image")
        row = next(r for r in rows if r["label"] == "apionly")
        assert row["file_exists"] is True
        assert row["gui_valid"] is False

    def test_missing_file_reported(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        self._seed_one(tmp_path, monkeypatch, "gone", "image")
        (tmp_path / "workflows" / "image" / "gone.json").unlink()
        rows = wdb.list_workflows_overview("image")
        row = next(r for r in rows if r["label"] == "gone")
        assert row["file_exists"] is False
        assert row["gui_valid"] is None

    def test_user_dropped_file_not_builtin(self, reset_db, tmp_path, monkeypatch):
        self._seed_one(tmp_path, monkeypatch, "userwf", "image")
        rows = wdb.list_workflows_overview("image")
        row = next(r for r in rows if r["label"] == "userwf")
        assert row["builtin"] is False

    def test_git_tracked_file_marked_builtin(self, reset_db, tmp_path, monkeypatch):
        self._seed_one(tmp_path, monkeypatch, "shipped", "image")
        tracked_path = str(
            (tmp_path / "workflows" / "image" / "shipped.json").resolve()
        )
        monkeypatch.setattr(
            wdb.bindings, "_git_tracked_workflow_paths",
            lambda: (frozenset({tracked_path}), frozenset()),
        )
        rows = wdb.list_workflows_overview("image")
        row = next(r for r in rows if r["label"] == "shipped")
        assert row["builtin"] is True
