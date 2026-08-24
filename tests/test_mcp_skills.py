from __future__ import annotations

import json

import pytest

from ComfyTV import skill_store, storage

from test_skill_store import make_skill


@pytest.fixture()
def skill_dirs(tmp_path, monkeypatch, reset_db):
    builtin = tmp_path / "builtin-skills"
    user = tmp_path / "user-skills"
    builtin.mkdir()
    user.mkdir()
    monkeypatch.setattr(skill_store, "BUILTIN_SKILLS_DIR", builtin)
    monkeypatch.setattr(skill_store, "user_skills_dir", lambda: user)
    return builtin, user


async def _dispatch(method: str, params: dict | None = None) -> dict:
    from ComfyTV.api import mcp
    return await mcp._dispatch({
        "jsonrpc": "2.0", "id": 1, "method": method, "params": params or {},
    })


def _tool_payload(response: dict) -> dict:
    content = response["result"]["content"]
    assert response["result"]["isError"] is False, content
    return json.loads(content[0]["text"])


class TestToolsList:
    async def test_skill_tool_carries_dynamic_index(self, skill_dirs):
        builtin, _ = skill_dirs
        make_skill(builtin, "alpha", description="Cut trailers like a pro")
        response = await _dispatch("tools/list")
        tools = {t["name"]: t for t in response["result"]["tools"]}
        assert "skill" in tools
        assert "alpha: Cut trailers like a pro" in tools["skill"]["description"]

    async def test_disabled_skill_left_out_of_index(self, skill_dirs):
        builtin, _ = skill_dirs
        make_skill(builtin, "alpha")
        make_skill(builtin, "beta")
        skill_store.set_skill_enabled("beta", False)
        response = await _dispatch("tools/list")
        desc = next(t for t in response["result"]["tools"]
                    if t["name"] == "skill")["description"]
        assert "alpha" in desc
        assert "beta" not in desc

    async def test_global_toggle_hides_tool(self, skill_dirs):
        storage.set_settings({skill_store.ENABLE_SETTING: False})
        response = await _dispatch("tools/list")
        names = [t["name"] for t in response["result"]["tools"]]
        assert "skill" not in names
        call = await _dispatch("tools/call",
                               {"name": "skill", "arguments": {"action": "list"}})
        assert "error" in call

    async def test_initialize_advertises_prompts(self, skill_dirs):
        response = await _dispatch("initialize", {"protocolVersion": "2025-06-18"})
        assert "prompts" in response["result"]["capabilities"]


class TestSkillTool:
    async def test_list_action(self, skill_dirs):
        builtin, _ = skill_dirs
        make_skill(builtin, "alpha", description="First")
        payload = _tool_payload(await _dispatch(
            "tools/call", {"name": "skill", "arguments": {"action": "list"}}))
        assert payload["skills"] == [{"name": "alpha", "description": "First"}]

    async def test_read_skill_and_reference(self, skill_dirs):
        builtin, _ = skill_dirs
        d = make_skill(builtin, "alpha", body="Follow these steps.\n")
        (d / "references").mkdir()
        (d / "references" / "deep.md").write_text("deep info", encoding="utf-8")
        payload = _tool_payload(await _dispatch(
            "tools/call",
            {"name": "skill", "arguments": {"action": "read", "name": "alpha"}}))
        assert "Follow these steps." in payload["content"]
        payload = _tool_payload(await _dispatch(
            "tools/call",
            {"name": "skill", "arguments": {
                "action": "read", "name": "alpha",
                "path": "references/deep.md"}}))
        assert payload["content"] == "deep info"

    async def test_read_errors(self, skill_dirs):
        builtin, _ = skill_dirs
        make_skill(builtin, "alpha")
        skill_store.set_skill_enabled("alpha", False)
        response = await _dispatch(
            "tools/call",
            {"name": "skill", "arguments": {"action": "read", "name": "alpha"}})
        assert response["result"]["isError"] is True
        response = await _dispatch(
            "tools/call",
            {"name": "skill", "arguments": {"action": "read"}})
        assert response["result"]["isError"] is True
        response = await _dispatch(
            "tools/call",
            {"name": "skill", "arguments": {"action": "explode"}})
        assert response["result"]["isError"] is True


class TestPrompts:
    async def test_prompts_roundtrip(self, skill_dirs):
        builtin, _ = skill_dirs
        d = make_skill(builtin, "alpha", description="First",
                       body="Prompt body.\n")
        (d / "agents").mkdir()
        (d / "agents" / "openai.yaml").write_text(
            "interface:\n  display_name: Alpha Studio\n", encoding="utf-8")
        response = await _dispatch("prompts/list")
        prompts = response["result"]["prompts"]
        assert prompts == [{"name": "alpha", "title": "Alpha Studio",
                            "description": "First"}]
        response = await _dispatch("prompts/get", {"name": "alpha"})
        message = response["result"]["messages"][0]
        assert message["role"] == "user"
        assert "Prompt body." in message["content"]["text"]

    async def test_prompts_respect_disable(self, skill_dirs):
        builtin, _ = skill_dirs
        make_skill(builtin, "alpha")
        skill_store.set_skill_enabled("alpha", False)
        response = await _dispatch("prompts/list")
        assert response["result"]["prompts"] == []
        response = await _dispatch("prompts/get", {"name": "alpha"})
        assert "error" in response

    async def test_unknown_prompt(self, skill_dirs):
        response = await _dispatch("prompts/get", {"name": "ghost"})
        assert response["error"]["code"] == -32602


class TestBotWiring:
    def test_skill_in_core_mcp_tools(self):
        from ComfyTV.bot._cli_common import CORE_MCP_TOOLS
        assert "skill" in CORE_MCP_TOOLS

