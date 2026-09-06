from ComfyTV.api.stages import _compute_input_usage


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
