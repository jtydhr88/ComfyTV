"""Tests for db.py — engine init, schema creation, session lifecycle."""

from __future__ import annotations

import os


class TestDbInit:
    def test_creates_engine_and_tables(self, reset_db):
        # reset_db fixture already called init(); just confirm a session works
        # and tables exist.
        with reset_db.get_session() as s:
            # Insert a Project to prove the schema is in place.
            proj = reset_db.Project(id="t", name="Test")
            s.add(proj)
            s.commit()
            assert s.get(reset_db.Project, "t").name == "Test"

    def test_init_idempotent(self, reset_db):
        # Calling init() again should not raise or rebuild.
        engine_before = reset_db._engine
        reset_db.init()
        assert reset_db._engine is engine_before

    def test_get_session_lazy_inits(self, reset_db, monkeypatch):
        # Clear singletons and confirm get_session() re-inits via init().
        monkeypatch.setattr(reset_db, "_engine", None)
        monkeypatch.setattr(reset_db, "_Session", None)
        s = reset_db.get_session()
        assert s is not None
        s.close()
        assert reset_db._engine is not None
        assert reset_db._Session is not None

    def test_fallback_path_resolves_under_user_dir(self, reset_db, tmp_path):
        # The fixture pushes folder_paths.get_user_directory at tmp_path.
        # Confirm the db file landed somewhere under user/default/comfytv/.
        url = str(reset_db._engine.url)
        assert "comfytv" in url
        assert url.startswith("sqlite:///")


class TestWorkflowSchema:
    def test_workflow_with_bindings_cascades_on_delete(self, reset_db):
        with reset_db.get_session() as s:
            wf = reset_db.Workflow(kind="image", label="X",
                                   file_path="/tmp/x.json")
            s.add(wf)
            s.flush()
            s.add(reset_db.WorkflowInputBinding(
                workflow_id=wf.id, node_id="3", input_name="seed",
                from_="main_prompt",
            ))
            s.commit()
            wid = wf.id

        with reset_db.get_session() as s:
            # SQLite respects PRAGMA foreign_keys=ON (we set it).
            wf = s.get(reset_db.Workflow, wid)
            s.delete(wf)
            s.commit()

        with reset_db.get_session() as s:
            from sqlalchemy import select
            rows = s.execute(
                select(reset_db.WorkflowInputBinding).where(
                    reset_db.WorkflowInputBinding.workflow_id == wid
                )
            ).all()
            assert rows == []

    def test_unique_constraint_on_kind_label(self, reset_db):
        from sqlalchemy.exc import IntegrityError
        import pytest

        with reset_db.get_session() as s:
            s.add(reset_db.Workflow(kind="image", label="X", file_path="/a"))
            s.commit()

        with reset_db.get_session() as s:
            s.add(reset_db.Workflow(kind="image", label="X", file_path="/b"))
            with pytest.raises(IntegrityError):
                s.commit()
