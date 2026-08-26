from __future__ import annotations

from ComfyTV.nodes.stages.common.provenance import (
    build_provenance,
    consume_last_provenance,
    set_last_provenance,
)


class TestBuildProvenance:
    def test_collects_workflow_prompt_and_options(self):
        params = build_provenance(
            label="Local SD1.5",
            main_prompt="a red boat",
            options={"resolution": "720p", "duration_s": 10,
                     "project_id": "default", "__server": "2",
                     "empty": "", "none": None},
        )
        assert params == {
            "workflow": "Local SD1.5",
            "prompt": "a red boat",
            "resolution": "720p",
            "duration_s": 10,
        }

    def test_empty_everything_is_none(self):
        assert build_provenance(label="", main_prompt="", options={}) is None


class TestHandOff:
    def test_consume_clears(self):
        set_last_provenance({"workflow": "X"})
        assert consume_last_provenance() == {"workflow": "X"}
        assert consume_last_provenance() is None

    def test_persist_defaults_to_provenance(self, reset_db):
        from ComfyTV import storage
        from ComfyTV.nodes.stages.common.emit import _persist

        class FakeStage:
            __name__ = "ImageStage"

        set_last_provenance({"workflow": "Local SD1.5", "prompt": "a red boat"})
        row_id = _persist(
            cls=FakeStage, project_id="", output_type="image",
            payload_url="/view?filename=p.png&type=output")
        rows = storage.list_outputs(storage.DEFAULT_PROJECT_ID)
        row = next(r for r in rows if r["id"] == row_id)
        assert row["params_json"] == {"workflow": "Local SD1.5",
                                      "prompt": "a red boat"}
        assert consume_last_provenance() is None

    def test_explicit_params_win_and_still_consume(self, reset_db):
        from ComfyTV import storage
        from ComfyTV.nodes.stages.common.emit import _persist

        class FakeStage:
            __name__ = "DirectorStage"

        set_last_provenance({"workflow": "leak-me"})
        row_id = _persist(
            cls=FakeStage, project_id="", output_type="video",
            payload_url="/view?filename=v.mp4&type=output",
            params={"clip_id": "c1"})
        rows = storage.list_outputs(storage.DEFAULT_PROJECT_ID)
        row = next(r for r in rows if r["id"] == row_id)
        assert row["params_json"] == {"clip_id": "c1"}
        # spent either way — a later transform emit must not inherit it
        assert consume_last_provenance() is None
