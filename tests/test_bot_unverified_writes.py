def test_zero_tool_turn_that_claims_a_write_gets_a_notice():
    from ComfyTV.api.bot_turns import unverified_write_notice
    blocks = [{"type": "text", "text": "已调用 add_stage，成功创建 ImageStage，graph_node_id 为 2"}]
    notice = unverified_write_notice(blocks, "Live canvas right now: 6 stage(s) — A, B.")
    assert notice["type"] == "notice" and notice["level"] == "warn"
    assert "no tool calls" in notice["text"]
    assert notice["text"].endswith("Live canvas right now: 6 stage(s) — A, B.")


def test_turns_with_tools_or_without_claims_are_left_alone():
    from ComfyTV.api.bot_turns import unverified_write_notice
    assert unverified_write_notice([{"type": "text", "text": "There are 6 stages."}]) is None
    assert unverified_write_notice([
        {"type": "tool_use", "name": "mcp__comfytv__add_stage", "input": {}},
        {"type": "text", "text": "add_stage done"},
    ]) is None


def test_notice_reaches_the_next_turn_through_history():
    import json
    from ComfyTV.api.bot_turns import _blocks_text
    content = json.dumps([
        {"type": "text", "text": "add_stage done, node 2"},
        {"type": "notice", "level": "warn", "text": "This turn made no tool calls."},
    ])
    assert _blocks_text(content) == "add_stage done, node 2\n[notice: This turn made no tool calls.]"
