from pathlib import Path

from ComfyTV.api.stages import _compute_input_usage, workflow_info_payload
from ComfyTV.runners import workflow_db as wdb

from workflow_db_helpers import make_workflow


def test_usage_reports_computed_bindings():
    out = _compute_input_usage([
        {"from": "computed:width"}, {"from": "computed:height"},
        {"from": "upstream_image:annotated[0]", "required": True},
    ])
    assert out["uses_computed"] == {"width": True, "height": True, "length": False}
    assert out["uses"]["image"] is True


def test_usage_without_computed_bindings():
    out = _compute_input_usage([{"from": "main_prompt"}, {"from": "option:seed"}])
    assert out["uses_computed"] == {"width": False, "height": False, "length": False}


def _custom_usage(tmp_path, monkeypatch, inputs):
    wdir = tmp_path / "workflows"
    make_workflow(wdir, "wf", "custom")
    monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
    wdb.seed_workflows_from_disk(("custom",))
    wid = wdb.get_workflow_config("custom", "wf")["id"]
    wdb.set_custom_io(wid, {"inputs": inputs, "outputs": [{"node": "2", "kind": "text"}]})
    return workflow_info_payload()["custom"]["wf"]


def test_custom_exposed_text_counts_as_text_input(reset_db, tmp_path, monkeypatch):
    usage = _custom_usage(tmp_path, monkeypatch, [
        {"node": "1", "input": "a", "kind": "text"},
        {"node": "1", "input": "b", "kind": "text"},
        {"node": "1", "input": "c", "kind": "param", "ptype": "INT"},
    ])
    assert usage["uses"]["text"] is True
    assert usage["max_inputs"]["text"] == 2


def test_custom_prompt_text_stays_unbounded(reset_db, tmp_path, monkeypatch):
    usage = _custom_usage(tmp_path, monkeypatch, [
        {"node": "1", "input": "a", "kind": "text", "prompt": True},
        {"node": "1", "input": "b", "kind": "text"},
    ])
    assert usage["max_inputs"]["text"] is None


def test_custom_without_text_consumes_none(reset_db, tmp_path, monkeypatch):
    usage = _custom_usage(tmp_path, monkeypatch, [
        {"node": "1", "input": "c", "kind": "param", "ptype": "INT"},
    ])
    assert usage["uses"]["text"] is False
    assert usage["max_inputs"]["text"] == 0
