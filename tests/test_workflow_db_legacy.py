from __future__ import annotations

import json

from ComfyTV.runners import workflow_db as wdb


class TestLegacyMigration:
    def _setup_dirs(self, tmp_path, monkeypatch):
        from pathlib import Path
        legacy = tmp_path / "legacy"
        (legacy / "image").mkdir(parents=True)
        user_root = tmp_path / "user-workflows"
        monkeypatch.setattr(wdb.seed, "_LEGACY_WORKFLOWS_DIR", Path(legacy))
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(user_root))
        return legacy, user_root

    def test_sync_copies_legacy_tree_and_registers(self, reset_db, tmp_path, monkeypatch):
        legacy, user_root = self._setup_dirs(tmp_path, monkeypatch)
        (legacy / "image" / "sd15.json").write_text(json.dumps({"nodes": []}))
        (legacy / "image" / "sd15_preset.json").write_text(json.dumps({"label": "SD 1.5"}))
        (legacy / "image" / "sd15.api.json").write_text(
            json.dumps({"3": {"class_type": "KSampler", "inputs": {}}}))

        result = wdb.seed_workflows_from_disk(("image",))

        assert sorted(result["synced"]) == [
            "image/sd15.api.json", "image/sd15.json", "image/sd15_preset.json",
        ]
        assert (user_root / "image" / "sd15.json").exists()
        assert (user_root / "image" / "sd15_preset.json").exists()
        assert (user_root / "image" / "sd15.api.json").exists()

        rows = wdb.list_workflows_overview("image")
        assert len(rows) == 1
        assert rows[0]["label"] == "SD 1.5"
        assert str(user_root) in rows[0]["file_path"]

    def test_sync_is_one_way_and_never_overwrites(self, reset_db, tmp_path, monkeypatch):
        legacy, user_root = self._setup_dirs(tmp_path, monkeypatch)
        (legacy / "image" / "wf.json").write_text(json.dumps({"nodes": []}))

        r1 = wdb.seed_workflows_from_disk(("image",))
        assert r1["synced"] == ["image/wf.json"]

        edited = json.dumps({"nodes": [{"id": 1, "type": "UserEdit"}]})
        (user_root / "image" / "wf.json").write_text(edited)

        r2 = wdb.seed_workflows_from_disk(("image",))
        assert r2["synced"] == []
        assert (user_root / "image" / "wf.json").read_text() == edited

    def test_existing_rows_repointed_with_state_kept(self, reset_db, tmp_path, monkeypatch):
        from ComfyTV import db
        legacy, user_root = self._setup_dirs(tmp_path, monkeypatch)
        legacy_file = legacy / "image" / "old.json"
        legacy_file.write_text(json.dumps({"nodes": []}))

        with db.get_session() as s:
            row = db.Workflow(kind="image", label="Old",
                              file_path=str(legacy_file),
                              file_mtime=legacy_file.stat().st_mtime,
                              api_json="{}", is_default=True, order_=100)
            s.add(row)
            s.flush()
            s.add(db.WorkflowInputBinding(
                workflow_id=row.id, node_id="3", input_name="seed",
                from_="option:seed",
            ))
            s.commit()
            row_id = row.id

        wdb.seed_workflows_from_disk(("image",))

        rows = wdb.list_workflows_overview("image")
        assert len(rows) == 1
        assert rows[0]["id"] == row_id
        assert rows[0]["label"] == "Old"
        assert str(user_root) in rows[0]["file_path"]
        assert rows[0]["is_default"] is True
        cfg = wdb.get_workflow_config("image", "Old")
        assert len(cfg["bindings"]) == 1
        assert wdb.get_default_label("image") == "Old"

    def test_orphan_rows_under_either_root_are_pruned(self, reset_db, tmp_path, monkeypatch):
        from ComfyTV import db
        legacy, user_root = self._setup_dirs(tmp_path, monkeypatch)
        (user_root / "image").mkdir(parents=True)
        with db.get_session() as s:
            s.add(db.Workflow(kind="image", label="GhostLegacy",
                              file_path=str(legacy / "image" / "gone.json")))
            s.add(db.Workflow(kind="image", label="GhostUser",
                              file_path=str(user_root / "image" / "gone2.json")))
            s.commit()

        result = wdb.seed_workflows_from_disk(("image",))
        assert result["pruned"] == 2
        assert wdb.list_workflows_overview("image") == []

    def test_import_writes_into_user_root(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        legacy, user_root = self._setup_dirs(tmp_path, monkeypatch)
        res = wdb.import_workflow("image", "fresh.json", json.dumps({"nodes": []}))
        assert Path(res["file_path"]).parent == user_root / "image"
        assert not (legacy / "image" / "fresh.json").exists()

    def test_builtin_detected_via_relative_path(self, reset_db, tmp_path, monkeypatch):
        _, user_root = self._setup_dirs(tmp_path, monkeypatch)
        (user_root / "image").mkdir(parents=True)
        (user_root / "image" / "ship.json").write_text(json.dumps({"nodes": []}))
        monkeypatch.setattr(
            wdb.bindings, "_git_tracked_cache",
            (frozenset(), frozenset({"image/ship.json"})),
        )
        wdb.seed_workflows_from_disk(("image",))
        rows = wdb.list_workflows_overview("image")
        assert len(rows) == 1
        assert rows[0]["builtin"] is True

    def test_shipped_update_propagates_to_untouched_copy(self, reset_db, tmp_path, monkeypatch):
        legacy, user_root = self._setup_dirs(tmp_path, monkeypatch)
        (legacy / "image" / "wf.json").write_text(json.dumps({"nodes": []}))
        wdb.seed_workflows_from_disk(("image",))
        assert wdb.set_api_json(
            "image", "wf", {"3": {"class_type": "K", "inputs": {}}},
            (user_root / "image" / "wf.json").stat().st_mtime)

        v2 = json.dumps({"nodes": [{"id": 1, "type": "NewShipped"}]})
        (legacy / "image" / "wf.json").write_text(v2)

        result = wdb.seed_workflows_from_disk(("image",))
        assert result["updated"] == ["image/wf.json"]
        assert result["synced"] == []
        assert (user_root / "image" / "wf.json").read_text() == v2
        assert wdb.get_workflow_config("image", "wf")["has_api"] is False

    def test_user_edited_copy_blocks_shipped_update(self, reset_db, tmp_path, monkeypatch):
        legacy, user_root = self._setup_dirs(tmp_path, monkeypatch)
        (legacy / "image" / "wf.json").write_text(json.dumps({"nodes": []}))
        wdb.seed_workflows_from_disk(("image",))

        edited = json.dumps({"nodes": [{"id": 9, "type": "UserEdit"}]})
        (user_root / "image" / "wf.json").write_text(edited)
        (legacy / "image" / "wf.json").write_text(
            json.dumps({"nodes": [{"id": 1, "type": "NewShipped"}]}))

        result = wdb.seed_workflows_from_disk(("image",))
        assert result["updated"] == []
        assert (user_root / "image" / "wf.json").read_text() == edited

    def test_copy_without_manifest_entry_is_never_overwritten(self, reset_db, tmp_path, monkeypatch):
        legacy, user_root = self._setup_dirs(tmp_path, monkeypatch)
        (legacy / "image" / "wf.json").write_text(json.dumps({"nodes": []}))
        pre_existing = json.dumps({"nodes": [{"id": 5, "type": "Unknown"}]})
        (user_root / "image").mkdir(parents=True)
        (user_root / "image" / "wf.json").write_text(pre_existing)

        result = wdb.seed_workflows_from_disk(("image",))
        assert result["synced"] == []
        assert result["updated"] == []
        assert (user_root / "image" / "wf.json").read_text() == pre_existing

    def test_user_dir_move_repoints_rows(self, reset_db, tmp_path, monkeypatch):
        from ComfyTV import db
        legacy, user_root = self._setup_dirs(tmp_path, monkeypatch)
        old_user = tmp_path / "old-user" / "comfytv" / "workflows" / "image"
        old_user.mkdir(parents=True)
        content = json.dumps({"nodes": []})
        (old_user / "wf.json").write_text(content)
        (user_root / "image").mkdir(parents=True)
        (user_root / "image" / "wf.json").write_text(content)

        with db.get_session() as s:
            row = db.Workflow(kind="image", label="wf",
                              file_path=str(old_user / "wf.json"),
                              is_default=True, order_=100)
            s.add(row)
            s.commit()
            row_id = row.id

        wdb.seed_workflows_from_disk(("image",))

        rows = wdb.list_workflows_overview("image")
        assert len(rows) == 1
        assert rows[0]["id"] == row_id
        assert str(user_root) in rows[0]["file_path"]
        assert rows[0]["is_default"] is True

    def test_user_dir_move_keeps_preset_label_and_id(self, reset_db, tmp_path, monkeypatch):
        from ComfyTV import db
        legacy, user_root = self._setup_dirs(tmp_path, monkeypatch)
        old_user = tmp_path / "prev" / "comfytv" / "workflows" / "image"
        old_user.mkdir(parents=True)
        content = json.dumps({"nodes": []})
        (old_user / "sd15.json").write_text(content)
        (user_root / "image").mkdir(parents=True)
        (user_root / "image" / "sd15.json").write_text(content)
        (user_root / "image" / "sd15_preset.json").write_text(
            json.dumps({"label": "SD 1.5"}))

        with db.get_session() as s:
            row = db.Workflow(kind="image", label="SD 1.5",
                              file_path=str(old_user / "sd15.json"), order_=100)
            s.add(row)
            s.commit()
            row_id = row.id

        wdb.seed_workflows_from_disk(("image",))

        rows = wdb.list_workflows_overview("image")
        assert len(rows) == 1
        assert rows[0]["id"] == row_id
        assert rows[0]["label"] == "SD 1.5"
        assert str(user_root) in rows[0]["file_path"]

    def test_two_stale_rows_for_same_rel_do_not_collide(self, reset_db, tmp_path, monkeypatch):
        from ComfyTV import db
        legacy, user_root = self._setup_dirs(tmp_path, monkeypatch)
        content = json.dumps({"nodes": []})
        (legacy / "image" / "wf.json").write_text(content)
        old_user = tmp_path / "prev" / "comfytv" / "workflows" / "image"
        old_user.mkdir(parents=True)
        (old_user / "wf.json").write_text(content)

        with db.get_session() as s:
            s.add(db.Workflow(kind="image", label="wf",
                              file_path=str(legacy / "image" / "wf.json")))
            s.add(db.Workflow(kind="image", label="wf (old)",
                              file_path=str(old_user / "wf.json")))
            s.commit()

        wdb.seed_workflows_from_disk(("image",))

        rows = wdb.list_workflows_overview("image")
        under_new = [r for r in rows if str(user_root) in r["file_path"]]
        assert len(under_new) == 1
