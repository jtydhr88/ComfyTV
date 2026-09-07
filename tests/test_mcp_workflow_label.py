import pytest


@pytest.fixture()
def two_workflows(reset_db, tmp_path):
    from ComfyTV import db
    with db.get_session() as s:
        for label, hidden in (("Shown", False), ("Ghost", True)):
            f = tmp_path / f"{label}.json"
            f.write_text("{}", encoding="utf-8")
            s.add(db.Workflow(kind="image", label=label, file_path=str(f),
                              api_json="{}", is_hidden=hidden))
        s.commit()


def test_hidden_workflow_is_rejected_with_its_own_message(two_workflows):
    from ComfyTV.api.mcp_tools.stages import _validate_workflow_label
    _validate_workflow_label("ComfyTV.ImageStage", "Shown")
    with pytest.raises(ValueError, match="'Ghost' is hidden for kind 'image'.*pick one of: Shown"):
        _validate_workflow_label("ComfyTV.ImageStage", "Ghost")
    with pytest.raises(ValueError, match="'Nope' not found.*valid labels: Shown$"):
        _validate_workflow_label("ComfyTV.ImageStage", "Nope")


@pytest.fixture()
def variations_workflows(reset_db, tmp_path):
    from ComfyTV import db
    with db.get_session() as s:
        for kind, label in (("multiview", "Face 3-View"), ("sequence", "Story 4")):
            f = tmp_path / f"{label}.json"
            f.write_text("{}", encoding="utf-8")
            s.add(db.Workflow(kind=kind, label=label, file_path=str(f), api_json="{}"))
        s.commit()


def test_stage_spanning_two_kinds_accepts_both_and_lists_both(variations_workflows):
    from ComfyTV.api.mcp_tools.stages import _validate_workflow_label, _workflow_kinds_of
    assert _workflow_kinds_of("ComfyTV.ImageVariationsStage") == ["multiview", "sequence"]
    assert _workflow_kinds_of("ComfyTV.ImageStage") == ["image"]
    _validate_workflow_label("ComfyTV.ImageVariationsStage", "Face 3-View")
    _validate_workflow_label("ComfyTV.ImageVariationsStage", "Story 4")
    with pytest.raises(ValueError, match=r"valid labels: Face 3-View, Story 4"):
        _validate_workflow_label("ComfyTV.ImageVariationsStage", "Nope")
