from __future__ import annotations

import json
import os
import time
from pathlib import Path

import pytest

from ComfyTV.runners import workflow_db as wdb


GUI = json.dumps({"nodes": [{"id": 1, "type": "X"}], "groups": []})
API = json.dumps({"3": {"class_type": "KSampler", "inputs": {}}})


@pytest.fixture()
def native_dir(tmp_path, monkeypatch):
    d = tmp_path / "native" / "workflows"
    d.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(wdb.link, "_native_workflows_dir", lambda: d)
    return d


class TestLinkWorkflow:
    def test_link_creates_linked_row(self, reset_db, native_dir):
        from ComfyTV import db
        (native_dir / "my_flow.json").write_text(GUI, encoding="utf-8")
        res = wdb.link_workflow("image", "my_flow.json")
        assert res["link_type"] == db.LINK_TYPE_NATIVE
        assert res["label"] == "My Flow"

        rows = [r for r in wdb.list_workflows() if r["kind"] == "image"]
        row = next(r for r in rows if r["label"] == "My Flow")
        assert row["link_type"] == db.LINK_TYPE_NATIVE

    def test_link_points_at_native_file_path(self, reset_db, native_dir):
        (native_dir / "a.json").write_text(GUI, encoding="utf-8")
        wdb.link_workflow("video", "a.json")
        pair = wdb.read_workflow_file("video", "A")
        assert pair is not None
        content, _ = pair
        assert json.loads(content) == json.loads(GUI)

    def test_link_custom_label(self, reset_db, native_dir):
        (native_dir / "a.json").write_text(GUI, encoding="utf-8")
        res = wdb.link_workflow("image", "a.json", label="Fancy Name")
        assert res["label"] == "Fancy Name"

    def test_link_rejects_non_gui(self, reset_db, native_dir):
        (native_dir / "bad.json").write_text(API, encoding="utf-8")
        with pytest.raises(ValueError):
            wdb.link_workflow("image", "bad.json")

    def test_link_rejects_missing_file(self, reset_db, native_dir):
        with pytest.raises(ValueError):
            wdb.link_workflow("image", "nope.json")

    def test_link_rejects_path_traversal(self, reset_db, native_dir, tmp_path):
        outside = tmp_path / "secret.json"
        outside.write_text(GUI, encoding="utf-8")
        with pytest.raises(ValueError):
            wdb.link_workflow("image", "../secret.json")

    def test_link_duplicate_label_raises(self, reset_db, native_dir):
        (native_dir / "a.json").write_text(GUI, encoding="utf-8")
        (native_dir / "b.json").write_text(GUI, encoding="utf-8")
        wdb.link_workflow("image", "a.json", label="Same")
        with pytest.raises(ValueError):
            wdb.link_workflow("image", "b.json", label="Same")

    def test_link_same_file_twice_raises(self, reset_db, native_dir):
        (native_dir / "a.json").write_text(GUI, encoding="utf-8")
        wdb.link_workflow("image", "a.json", label="One")
        with pytest.raises(ValueError):
            wdb.link_workflow("image", "a.json", label="Two")

    def test_same_file_different_kinds_ok(self, reset_db, native_dir):
        (native_dir / "a.json").write_text(GUI, encoding="utf-8")
        wdb.link_workflow("image", "a.json")
        wdb.link_workflow("video", "a.json")
        labels = {(r["kind"], r["label"]) for r in wdb.list_workflows()}
        assert ("image", "A") in labels and ("video", "A") in labels


class TestUnlinkWorkflow:
    def test_unlink_removes_row_keeps_file(self, reset_db, native_dir):
        f = native_dir / "a.json"
        f.write_text(GUI, encoding="utf-8")
        res = wdb.link_workflow("image", "a.json")
        wid = res["id"]
        out = wdb.unlink_workflow(wid)
        assert out and out["ok"]
        assert f.exists()
        assert not any(r["label"] == "A" for r in wdb.list_workflows())

    def test_unlink_missing_returns_none(self, reset_db, native_dir):
        assert wdb.unlink_workflow(999999) is None

    def test_unlink_managed_raises(self, reset_db, tmp_path, monkeypatch):
        wdir = tmp_path / "workflows"
        (wdir / "image").mkdir(parents=True)
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", wdir)
        res = wdb.import_workflow("image", "managed.json", GUI)
        from ComfyTV import db
        with db.get_session() as s:
            from sqlalchemy import select
            row = s.execute(
                select(db.Workflow).where(db.Workflow.label == res["label"])
            ).scalar_one()
            wid = row.id
        with pytest.raises(ValueError):
            wdb.unlink_workflow(wid)


class TestListNativeWorkflows:
    def test_lists_and_flags_linked(self, reset_db, native_dir):
        (native_dir / "a.json").write_text(GUI, encoding="utf-8")
        (native_dir / "b.json").write_text(GUI, encoding="utf-8")
        (native_dir / "a_preset.json").write_text("{}", encoding="utf-8")
        wdb.link_workflow("image", "a.json")

        items = wdb.list_native_workflows()
        by_name = {it["name"]: it for it in items}
        assert "a" in by_name and "b" in by_name
        assert "a_preset" not in by_name
        assert by_name["a"]["is_linked"] is True
        assert by_name["b"]["is_linked"] is False


class TestLinkedMtimeSync:
    def test_native_edit_invalidates_api_json(self, reset_db, native_dir):
        f = native_dir / "a.json"
        f.write_text(GUI, encoding="utf-8")
        wdb.link_workflow("image", "a.json")

        assert wdb.set_api_json(
            "image", "A", {"1": {"class_type": "X", "inputs": {}}}, f.stat().st_mtime
        )
        st = wdb.get_workflow_state("image", "A")
        assert st and st["has_api"] is True

        time.sleep(0.01)
        new = json.dumps({"nodes": [{"id": 1, "type": "X"}, {"id": 2, "type": "Y"}]})
        f.write_text(new, encoding="utf-8")
        os.utime(f, (f.stat().st_atime, f.stat().st_mtime + 5))

        st2 = wdb.get_workflow_state("image", "A")
        assert st2 and st2["has_api"] is False
