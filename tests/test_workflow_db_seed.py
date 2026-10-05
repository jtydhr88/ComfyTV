from __future__ import annotations

import json
import pytest

from ComfyTV.runners import workflow_db as wdb

from workflow_db_helpers import make_workflow


class TestSeed:
    def test_seed_creates_row(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        make_workflow(wdir, "sd15", "image")
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))
        rows = wdb.list_workflows()
        assert any(r["kind"] == "image" and r["label"] == "sd15" for r in rows)

    def test_seed_applies_preset_on_new_row(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        make_workflow(wdir, "fancy", "image", preset={
            "label": "Fancy Workflow",
            "order": 5,
            "description": "test desc",
            "result": {"type": "ui_save_batch", "node": "9"},
            "sizing": {"base": 512, "snap": 8},
            "prune_when_missing": [],
            "inputs": {"3": {"seed": {"from": "option:seed", "default": "random_int31", "cast": "int"}}},
        })
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))

        cfg = wdb.get_workflow_config("image", "Fancy Workflow")
        assert cfg is not None
        assert cfg["description"] == "test desc"
        assert cfg["result_node"] == "9"
        assert cfg["sizing"] == {"base": 512, "snap": 8}
        assert len(cfg["bindings"]) == 1
        assert cfg["bindings"][0]["from"] == "option:seed"

    def test_import_workflow_writes_and_upserts(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        wdir.mkdir(parents=True, exist_ok=True)
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))

        gui = json.dumps({"nodes": [{"id": 1, "type": "KSampler"}], "links": []})
        result = wdb.import_workflow("inpaint", "My Cool Upload.json", gui)

        assert result["kind"] == "inpaint"
        assert result["label"] == "My Cool Upload"

        written = Path(wdir / "inpaint" / "My-Cool-Upload.json")
        assert written.exists()

        rows = wdb.list_workflows()
        assert any(r["kind"] == "inpaint" and r["label"] == "My Cool Upload" for r in rows)

    def test_import_workflow_does_not_prune_other_kinds(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        make_workflow(wdir, "wan", "video")
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("video",))
        assert any(r["kind"] == "video" for r in wdb.list_workflows())

        wdb.import_workflow("image", "fresh.json",
                            json.dumps({"nodes": [{"id": 1}]}))

        labels = {(r["kind"], r["label"]) for r in wdb.list_workflows()}
        assert ("image", "fresh") in labels
        assert ("video", "wan") in labels  # untouched — targeted upsert, no prune

    def test_import_workflow_rejects_non_gui(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(tmp_path / "workflows"))
        api_format = json.dumps({"3": {"class_type": "KSampler", "inputs": {}}})
        with pytest.raises(ValueError, match="GUI-format"):
            wdb.import_workflow("image", "bad.json", api_format)

    def test_import_workflow_rejects_preset_name(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(tmp_path / "workflows"))
        with pytest.raises(ValueError, match="_preset"):
            wdb.import_workflow("image", "thing_preset.json",
                                json.dumps({"nodes": []}))

    def test_import_then_registry_lists_it(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        from ComfyTV.runners import refresh_registry, RUNNER_REGISTRY
        wdir = tmp_path / "workflows"
        wdir.mkdir(parents=True, exist_ok=True)
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))

        wdb.import_workflow("inpaint", "Flux Fill Inpaint33.json",
                            json.dumps({"nodes": [{"id": 1}]}))
        refresh_registry()
        assert "Flux Fill Inpaint33" in RUNNER_REGISTRY.labels_for_kind("inpaint")

    def test_seed_new_row_survives_stem_label_collision(
            self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        make_workflow(wdir, "first", "image", preset={"label": "second"})
        make_workflow(wdir, "second", "image")
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))
        labels = {r["label"] for r in wdb.list_workflows() if r["kind"] == "image"}
        assert labels == {"second", "second-2"}

    def test_import_survives_label_collision(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        make_workflow(wdir, "fancy", "image", preset={"label": "Nice"})
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))

        res = wdb.import_workflow("image", "Nice.json",
                                  json.dumps({"nodes": [{"id": 1}]}))
        assert res["label"] == "Nice-2"

    def test_reimport_same_file_keeps_own_label(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        wdir.mkdir(parents=True, exist_ok=True)
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        gui = json.dumps({"nodes": [{"id": 1}]})
        first = wdb.import_workflow("image", "mine.json", gui)
        again = wdb.import_workflow("image", "mine.json", gui)
        assert first["label"] == again["label"] == "mine"

    def test_reset_survives_stem_label_collision(
            self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        from ComfyTV import db as cdb
        wdir = tmp_path / "workflows"
        make_workflow(wdir, "sage", "video", preset={"order": 5})
        make_workflow(wdir, "other", "video")
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("video",))

        from sqlalchemy import select
        with cdb.get_session() as s:
            sage = s.execute(select(cdb.Workflow).where(
                cdb.Workflow.label == "sage")).scalar_one()
            other = s.execute(select(cdb.Workflow).where(
                cdb.Workflow.label == "other")).scalar_one()
            sage_id = sage.id
            sage.label = "my custom name"
            s.flush()
            other.label = "sage"
            s.commit()

        result = wdb.reset_workflow_to_preset(sage_id)
        assert result is not None and result["ok"]
        assert result["label"] == "sage-2"

    def test_safe_stem(self):
        assert wdb._safe_stem("My Cool Upload.json") == "My-Cool-Upload"
        assert wdb._safe_stem("../../etc/passwd") == "passwd"
        assert wdb._safe_stem("a/b/c.JSON") == "c"
        assert wdb._safe_stem("  spaced name .json") == "spaced-name"

    def test_seed_skips_preset_on_existing_row(self, reset_db, tmp_path, monkeypatch):
        """The whole point of the once-only preset rule — user edits survive
        the next seed."""
        from pathlib import Path
        wdir = tmp_path / "workflows"
        make_workflow(wdir, "fancy", "image", preset={
            "label": "Fancy",
            "inputs": {"3": {"seed": {"from": "option:seed"}}},
        })
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))

        cfg1 = wdb.get_workflow_config("image", "Fancy")
        wid = cfg1["id"]
        # User edits the binding via sidebar — re-seed must not clobber it.
        wdb.upsert_input_binding(
            workflow_id=wid, node_id="3", input_name="seed",
            from_="main_prompt",  # user changed it
        )
        wdb.seed_workflows_from_disk(("image",))

        cfg2 = wdb.get_workflow_config("image", "Fancy")
        seed_b = next(b for b in cfg2["bindings"] if b["node_id"] == "3" and b["input_name"] == "seed")
        assert seed_b["from"] == "main_prompt"

    def test_seed_ignores_preset_files_as_workflows(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        kind_dir = wdir / "image"
        kind_dir.mkdir(parents=True)
        # Only a preset, no actual workflow — must not produce a phantom row.
        (kind_dir / "foo_preset.json").write_text(json.dumps({"label": "X"}))
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))
        rows = wdb.list_workflows()
        assert all("X" != r["label"] for r in rows)

    def test_no_workflows_dir(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(tmp_path / "missing"))
        wdb.seed_workflows_from_disk(("image",))  # should not raise

    def test_seed_reclaims_label_from_orphan(self, reset_db, tmp_path, monkeypatch):
        """Stale row whose file is gone must yield its label to a new file."""
        from pathlib import Path
        from ComfyTV import db

        stale_path = str(tmp_path / "ghost" / "old.json")
        with db.get_session() as s:
            stale = db.Workflow(kind="image", label="Shared",
                                file_path=stale_path, order_=100)
            s.add(stale)
            s.flush()
            s.add(db.WorkflowInputBinding(
                workflow_id=stale.id, node_id="3", input_name="seed",
                from_="option:seed",
            ))
            s.commit()
            stale_id = stale.id

        wdir = tmp_path / "workflows"
        make_workflow(wdir, "new", "image", preset={"label": "Shared"})
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))

        rows = [r for r in wdb.list_workflows() if r["kind"] == "image"]
        labels = [r["label"] for r in rows]
        assert labels.count("Shared") == 1
        with db.get_session() as s:
            from sqlalchemy import select
            assert s.get(db.Workflow, stale_id) is None
            bindings = s.execute(
                select(db.WorkflowInputBinding).where(
                    db.WorkflowInputBinding.workflow_id == stale_id
                )
            ).scalars().all()
            assert bindings == []

    def test_seed_keeps_default_label_when_live_row_owns_preset_label(
            self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        make_workflow(wdir, "first",  "image", preset={"label": "Shared"})
        make_workflow(wdir, "second", "image", preset={"label": "Shared"})
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))  # must not raise

        rows = [r for r in wdb.list_workflows() if r["kind"] == "image"]
        labels = sorted(r["label"] for r in rows)
        assert "Shared" in labels
        assert "second" in labels
        assert labels.count("Shared") == 1


class TestSeedAddedReporting:
    def _write(self, wdir, kind: str, name: str) -> None:
        kd = wdir / kind
        kd.mkdir(parents=True, exist_ok=True)
        (kd / f"{name}.json").write_text(json.dumps({"nodes": []}))

    def test_first_population_reports_no_added(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        self._write(wdir, "image", "a")
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        result = wdb.seed_workflows_from_disk(("image",))
        assert result["added"] == []
        assert result["total"] == 1
        assert result["pruned"] == 0

    def test_rescan_reports_new_files(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        self._write(wdir, "image", "a")
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))

        self._write(wdir, "image", "b")
        self._write(wdir, "video", "c")
        result = wdb.seed_workflows_from_disk(("image", "video"))
        assert {(a["kind"], a["label"]) for a in result["added"]} \
            == {("image", "b"), ("video", "c")}
        assert result["total"] == 3

    def test_rescan_reports_pruned(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        self._write(wdir, "image", "a")
        self._write(wdir, "image", "b")
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))

        (wdir / "image" / "b.json").unlink()
        result = wdb.seed_workflows_from_disk(("image",))
        assert result["added"] == []
        assert result["pruned"] == 1
        assert result["total"] == 1

    def test_unchanged_rescan_adds_nothing(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        self._write(wdir, "image", "a")
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))
        result = wdb.seed_workflows_from_disk(("image",))
        assert result == {"added": [], "pruned": 0, "total": 1,
                          "synced": [], "updated": []}
