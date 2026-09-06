from datetime import datetime, timedelta, timezone

import pytest


def _persist(stage_node_id, stage_class="ImageStage", uid=None, url="/x"):
    from ComfyTV import storage
    return storage.persist_output(
        project_id="default", stage_class=stage_class, stage_node_id=stage_node_id,
        output_type="images", payload_url=url, stage_uid=uid,
    )


class TestAdopt:
    def test_adopts_only_the_newest_orphan(self, reset_db):
        from ComfyTV import storage
        old = _persist("7", url="/old")
        new = _persist("7", url="/new")
        row = storage.adopt_outputs("default", "7", "ImageStage", "uid-a", since="2000-01-01")
        assert row["id"] == new["id"] and row["stage_uid"] == "uid-a"
        assert storage.latest_output("default", "7", orphans_only=True)["id"] == old["id"]

    def test_since_bounds_adoption_to_the_stage_lifetime(self, reset_db):
        from ComfyTV import storage
        _persist("255", url="/dead-stage")
        later = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
        assert storage.adopt_outputs("default", "255", "ImageStage", "uid-b", since=later) is None
        earlier = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
        assert storage.adopt_outputs("default", "255", "ImageStage", "uid-b", since=earlier) is not None
        assert storage.adopt_outputs("default", "255", "ImageStage", "uid-c", since="2000-01-01") is None
        _persist("256", url="/no-since")
        assert storage.adopt_outputs("default", "256", "ImageStage", "uid-e") is None
        assert storage.adopt_outputs("default", "256", "ImageStage", "uid-e", since="garbage") is None

    def test_class_and_owned_rows_are_never_adopted(self, reset_db):
        from ComfyTV import storage
        _persist("3", stage_class="PanoramaStage")
        _persist("3", stage_class="ImageStage", uid="someone-else")
        assert storage.adopt_outputs("default", "3", "ImageStage", "uid-d", since="2000-01-01") is None


class TestPersistWithUid:
    def test_persist_stamps_uid_at_creation(self, reset_db):
        row = _persist("9", uid="uid-live")
        assert row["stage_uid"] == "uid-live"

    def test_emit_resolves_uid_from_the_canvas_mirror(self, reset_db):
        from ComfyTV.api.canvas_state import clear_canvas_state, store_canvas_state
        from ComfyTV.nodes.stages.common import emit
        clear_canvas_state()
        store_canvas_state("default", [
            {"uid": "mirror-uid", "graph_node_id": "12", "stage_class": "ImageStage"},
            {"uid": "other-uid", "graph_node_id": "12", "stage_class": "PanoramaStage"},
        ], client_id="tab-1")
        try:
            assert emit._mirror_uid("default", "12", "ImageStage") == "mirror-uid"
            assert emit._mirror_uid("default", "12", "VideoStage") is None
            assert emit._mirror_uid("default", "99", "ImageStage") is None
        finally:
            clear_canvas_state()
        assert emit._mirror_uid("default", "12", "ImageStage") is None


class TestReadFallback:
    def test_latest_output_can_require_class_and_orphans(self, reset_db):
        from ComfyTV import storage
        _persist("273", stage_class="PanoramaStage", uid="pano-uid", url="/pano")
        assert storage.latest_output("default", "273")["payload_url"] == "/pano"
        assert storage.latest_output("default", "273", stage_class="ImageStage") is None
        assert storage.latest_output("default", "273", stage_class="PanoramaStage",
                                     orphans_only=True) is None

    def test_mcp_summary_never_borrows_another_stage_output(self, reset_db):
        from ComfyTV.api.mcp_tools.stages import _latest_output_summary
        _persist("273", stage_class="PanoramaStage", uid="pano-uid", url="/pano")
        assert _latest_output_summary("default", "acd9f439", "273", "ComfyTV.ImageStage") is None
        assert _latest_output_summary("default", None, "273", None) is None
        orphan = _persist("273", stage_class="ImageStage", url="/orphan")
        out = _latest_output_summary("default", "acd9f439", "273", "ComfyTV.ImageStage")
        assert out["id"] == orphan["id"]
        own = _persist("273", stage_class="ImageStage", uid="acd9f439", url="/own")
        assert _latest_output_summary("default", "acd9f439", "273", "ComfyTV.ImageStage")["id"] == own["id"]
