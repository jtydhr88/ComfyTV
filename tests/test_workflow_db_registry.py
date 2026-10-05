from __future__ import annotations

import json
import pytest

from ComfyTV.runners import workflow_db as wdb


class TestProvidedApiSidecar:
    _GUI = {"nodes": [{"id": 9, "type": "SaveImage"},
                      {"id": 57, "type": "sub-uuid"}]}
    _API = {
        "9":     {"class_type": "SaveImage",  "inputs": {"images": ["57:8", 0]}},
        "57:3":  {"class_type": "KSampler",   "inputs": {"seed": 1}},
        "57:8":  {"class_type": "VAEDecode",  "inputs": {}},
    }

    def _seed(self, monkeypatch, tmp_path, *, with_sidecar: bool,
              name="byo", kind="image"):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        kdir = wdir / kind
        kdir.mkdir(parents=True, exist_ok=True)
        (kdir / f"{name}.json").write_text(json.dumps(self._GUI), encoding="utf-8")
        if with_sidecar:
            (kdir / f"{name}.api.json").write_text(json.dumps(self._API), encoding="utf-8")
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk((kind,))
        return kdir

    def test_sidecar_path_for_gui_file(self):
        from pathlib import Path
        assert wdb.bindings._sidecar_api_path("/a/b/foo.json") == Path("/a/b/foo.api.json")

    def test_sidecar_path_none_for_api_or_empty(self):
        assert wdb.bindings._sidecar_api_path("/a/b/foo.api.json") is None
        assert wdb.bindings._sidecar_api_path("") is None

    def test_load_api_format_accepts_api(self):
        assert wdb.bindings._load_api_format(json.dumps(self._API)) == self._API

    def test_load_api_format_rejects_gui_graph(self):
        assert wdb.bindings._load_api_format(json.dumps(self._GUI)) is None

    def test_load_api_format_rejects_junk(self):
        assert wdb.bindings._load_api_format("not json") is None
        assert wdb.bindings._load_api_format(json.dumps({"3": {"foo": 1}})) is None
        assert wdb.bindings._load_api_format(json.dumps({})) is None

    def test_seed_does_not_register_sidecar_as_workflow(self, reset_db, tmp_path, monkeypatch):
        self._seed(monkeypatch, tmp_path, with_sidecar=True)
        rows = wdb.list_workflows()
        labels = [r["label"] for r in rows if r["kind"] == "image"]
        assert "byo" in labels
        assert all("api" not in l.lower() for l in labels)
        assert len(labels) == 1

    def test_state_uses_sidecar_directly(self, reset_db, tmp_path, monkeypatch):
        self._seed(monkeypatch, tmp_path, with_sidecar=True)
        state = wdb.get_workflow_state("image", "byo")
        assert state["has_api"] is True
        cfg = wdb.get_workflow_config("image", "byo")
        assert cfg["api_json"] == self._API

    def test_state_no_sidecar_has_no_api(self, reset_db, tmp_path, monkeypatch):
        self._seed(monkeypatch, tmp_path, with_sidecar=False)
        state = wdb.get_workflow_state("image", "byo")
        assert state["has_api"] is False

    def test_sidecar_survives_gui_mtime_change(self, reset_db, tmp_path, monkeypatch):
        kdir = self._seed(monkeypatch, tmp_path, with_sidecar=True)
        assert wdb.get_workflow_state("image", "byo")["has_api"] is True
        import os, time
        gui = kdir / "byo.json"
        os.utime(gui, (time.time() + 50, time.time() + 50))
        state = wdb.get_workflow_state("image", "byo")
        assert state["has_api"] is True

    def test_sidecar_dropped_at_runtime_is_picked_up(self, reset_db, tmp_path, monkeypatch):
        kdir = self._seed(monkeypatch, tmp_path, with_sidecar=False)
        assert wdb.get_workflow_state("image", "byo")["has_api"] is False
        (kdir / "byo.api.json").write_text(json.dumps(self._API), encoding="utf-8")
        assert wdb.get_workflow_state("image", "byo")["has_api"] is True

    def test_sidecar_prunes_orphaned_bindings(self, reset_db, tmp_path, monkeypatch):
        self._seed(monkeypatch, tmp_path, with_sidecar=False)
        cfg = wdb.get_workflow_config("image", "byo")
        wid = cfg["id"]
        wdb.upsert_input_binding(wid, "999", "text", "main_prompt")
        wdb.upsert_input_binding(wid, "57:3", "seed", "option:seed")
        from pathlib import Path
        Path(cfg["file_path"]).parent.joinpath("byo.api.json").write_text(
            json.dumps(self._API), encoding="utf-8")
        wdb.get_workflow_state("image", "byo")
        cfg2 = wdb.get_workflow_config("image", "byo")
        node_ids = {b["node_id"] for b in cfg2["bindings"]}
        assert "999" not in node_ids
        assert "57:3" in node_ids

    def test_invalid_sidecar_is_ignored(self, reset_db, tmp_path, monkeypatch):
        kdir = self._seed(monkeypatch, tmp_path, with_sidecar=False)
        (kdir / "byo.api.json").write_text(json.dumps(self._GUI), encoding="utf-8")
        state = wdb.get_workflow_state("image", "byo")
        assert state["has_api"] is False

    def test_save_api_sidecar_writes_and_adopts(self, reset_db, tmp_path, monkeypatch):
        kdir = self._seed(monkeypatch, tmp_path, with_sidecar=False)
        res = wdb.save_api_sidecar("image", "byo", json.dumps(self._API))
        assert res["ok"] is True
        assert res["node_count"] == len(self._API)
        assert res["sidecar"] == "byo.api.json"
        assert (kdir / "byo.api.json").exists()
        cfg = wdb.get_workflow_config("image", "byo")
        assert cfg["has_api"] is True
        assert cfg["api_json"] == self._API

    def test_save_api_sidecar_rejects_non_api(self, reset_db, tmp_path, monkeypatch):
        self._seed(monkeypatch, tmp_path, with_sidecar=False)
        with pytest.raises(ValueError, match="API-format"):
            wdb.save_api_sidecar("image", "byo", json.dumps(self._GUI))

    def test_save_api_sidecar_unknown_workflow(self, reset_db, tmp_path, monkeypatch):
        self._seed(monkeypatch, tmp_path, with_sidecar=False)
        with pytest.raises(ValueError, match="not found"):
            wdb.save_api_sidecar("image", "Nope", json.dumps(self._API))


class TestDefaultWorkflow:
    def _seed_two(self, tmp_path, monkeypatch, kind="image"):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        kind_dir = wdir / kind
        kind_dir.mkdir(parents=True, exist_ok=True)
        (kind_dir / "aaa.json").write_text(json.dumps({"nodes": []}))
        (kind_dir / "bbb.json").write_text(json.dumps({"nodes": []}))
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk((kind,))
        rows = [r for r in wdb.list_workflows_overview(kind)]
        return wdir, {r["label"]: r["id"] for r in rows}

    def test_set_default_marks_single_row(self, reset_db, tmp_path, monkeypatch):
        _, ids = self._seed_two(tmp_path, monkeypatch)
        res = wdb.set_default_workflow(ids["bbb"], True)
        assert res == {"ok": True, "kind": "image", "label": "bbb", "is_default": True}
        assert wdb.get_default_label("image") == "bbb"

        overview = {r["label"]: r["is_default"] for r in wdb.list_workflows_overview("image")}
        assert overview == {"aaa": False, "bbb": True}

    def test_setting_another_clears_previous(self, reset_db, tmp_path, monkeypatch):
        _, ids = self._seed_two(tmp_path, monkeypatch)
        wdb.set_default_workflow(ids["bbb"], True)
        wdb.set_default_workflow(ids["aaa"], True)
        overview = {r["label"]: r["is_default"] for r in wdb.list_workflows_overview("image")}
        assert overview == {"aaa": True, "bbb": False}

    def test_unset_default(self, reset_db, tmp_path, monkeypatch):
        _, ids = self._seed_two(tmp_path, monkeypatch)
        wdb.set_default_workflow(ids["bbb"], True)
        res = wdb.set_default_workflow(ids["bbb"], False)
        assert res["is_default"] is False
        assert wdb.get_default_label("image") is None

    def test_default_is_per_kind(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        for kind, name in (("image", "img"), ("video", "vid")):
            kd = wdir / kind
            kd.mkdir(parents=True, exist_ok=True)
            (kd / f"{name}.json").write_text(json.dumps({"nodes": []}))
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image", "video"))
        img_id = wdb.list_workflows_overview("image")[0]["id"]
        wdb.set_default_workflow(img_id, True)
        assert wdb.get_default_label("image") == "img"
        assert wdb.get_default_label("video") is None

    def test_unknown_id_returns_none(self, reset_db):
        assert wdb.set_default_workflow(99999, True) is None

    def test_default_ignored_when_file_deleted(self, reset_db, tmp_path, monkeypatch):
        wdir, ids = self._seed_two(tmp_path, monkeypatch)
        wdb.set_default_workflow(ids["bbb"], True)
        (wdir / "image" / "bbb.json").unlink()
        assert wdb.get_default_label("image") is None

    def test_default_gone_after_rescan_prunes_row(self, reset_db, tmp_path, monkeypatch):
        wdir, ids = self._seed_two(tmp_path, monkeypatch)
        wdb.set_default_workflow(ids["bbb"], True)
        (wdir / "image" / "bbb.json").unlink()
        wdb.seed_workflows_from_disk(("image",))
        labels = [r["label"] for r in wdb.list_workflows_overview("image")]
        assert labels == ["aaa"]
        assert wdb.get_default_label("image") is None

    def test_default_for_prefers_chosen_then_falls_back(self, reset_db, tmp_path, monkeypatch):
        from ComfyTV.runners import refresh_registry
        from ComfyTV.nodes.stages.common.workflow_lists import default_for

        wdir, ids = self._seed_two(tmp_path, monkeypatch)
        refresh_registry()
        assert default_for("image") == "aaa"

        wdb.set_default_workflow(ids["bbb"], True)
        assert default_for("image") == "bbb"

        (wdir / "image" / "bbb.json").unlink()
        assert default_for("image") == "aaa"


class TestHiddenWorkflow:
    def _seed_two(self, tmp_path, monkeypatch, kind="image"):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        kind_dir = wdir / kind
        kind_dir.mkdir(parents=True, exist_ok=True)
        (kind_dir / "aaa.json").write_text(json.dumps({"nodes": []}))
        (kind_dir / "bbb.json").write_text(json.dumps({"nodes": []}))
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk((kind,))
        rows = [r for r in wdb.list_workflows_overview(kind)]
        return wdir, {r["label"]: r["id"] for r in rows}

    def test_set_hidden_marks_row(self, reset_db, tmp_path, monkeypatch):
        _, ids = self._seed_two(tmp_path, monkeypatch)
        res = wdb.set_hidden_workflow(ids["bbb"], True)
        assert res == {"ok": True, "kind": "image", "label": "bbb", "is_hidden": True}
        overview = {r["label"]: r["is_hidden"] for r in wdb.list_workflows_overview("image")}
        assert overview == {"aaa": False, "bbb": True}
        flags = {r["label"]: r["hidden"] for r in wdb.list_workflows()}
        assert flags == {"aaa": False, "bbb": True}

    def test_unhide_restores(self, reset_db, tmp_path, monkeypatch):
        _, ids = self._seed_two(tmp_path, monkeypatch)
        wdb.set_hidden_workflow(ids["bbb"], True)
        res = wdb.set_hidden_workflow(ids["bbb"], False)
        assert res["is_hidden"] is False
        overview = {r["label"]: r["is_hidden"] for r in wdb.list_workflows_overview("image")}
        assert overview == {"aaa": False, "bbb": False}

    def test_unknown_id_returns_none(self, reset_db):
        assert wdb.set_hidden_workflow(99999, True) is None

    def test_hidden_excluded_from_labels_but_still_invokable(
            self, reset_db, tmp_path, monkeypatch):
        from ComfyTV.runners import RUNNER_REGISTRY, refresh_registry

        _, ids = self._seed_two(tmp_path, monkeypatch)
        wdb.set_hidden_workflow(ids["bbb"], True)
        refresh_registry()
        assert RUNNER_REGISTRY.labels_for_kind("image") == ["aaa"]
        assert RUNNER_REGISTRY.by_label("bbb", "image") is not None

    def test_hidden_survives_rescan(self, reset_db, tmp_path, monkeypatch):
        _, ids = self._seed_two(tmp_path, monkeypatch)
        wdb.set_hidden_workflow(ids["bbb"], True)
        wdb.seed_workflows_from_disk(("image",))
        overview = {r["label"]: r["is_hidden"] for r in wdb.list_workflows_overview("image")}
        assert overview == {"aaa": False, "bbb": True}

    def test_default_for_skips_hidden_default(self, reset_db, tmp_path, monkeypatch):
        from ComfyTV.runners import refresh_registry
        from ComfyTV.nodes.stages.common.workflow_lists import default_for

        _, ids = self._seed_two(tmp_path, monkeypatch)
        wdb.set_default_workflow(ids["bbb"], True)
        wdb.set_hidden_workflow(ids["bbb"], True)
        refresh_registry()
        assert default_for("image") == "aaa"
