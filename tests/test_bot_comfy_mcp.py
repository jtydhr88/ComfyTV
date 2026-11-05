from __future__ import annotations

from ComfyTV.bot.agent_host import COMFY_MCP_ALLOWED_TOOLS
from ComfyTV.bot.guide import CORE_MCP_TOOLS


class TestAllowlists:
    def test_core_tools_cover_workflow_authoring(self):
        for tool in ("node_info", "workflow_create", "workflow_get",
                     "workflow_edit", "stage_params"):
            assert tool in CORE_MCP_TOOLS

    def test_core_tools_cover_every_registered_mcp_tool(self):
        from ComfyTV.api.mcp_tools import TOOLS
        missing = sorted(set(TOOLS) - set(CORE_MCP_TOOLS))
        assert not missing, (
            f"new MCP tools invisible to Qwen/Local LLM bots: {missing} — "
            "add them to CORE_MCP_TOOLS")
        stale = sorted(set(CORE_MCP_TOOLS) - set(TOOLS))
        assert not stale, f"CORE_MCP_TOOLS lists unregistered tools: {stale}"


class TestBotWiring:
    def test_disabled_by_default(self, reset_db):
        from ComfyTV.api.bot_turns import _comfy_mcp_argv
        assert _comfy_mcp_argv() == []

    def test_enabled_with_command(self, reset_db):
        from ComfyTV import storage
        from ComfyTV.api.bot_turns import _comfy_mcp_argv
        storage.set_settings({"bot-enable-comfy-mcp": True,
                              "bot-comfy-mcp-command": "comfy-mcp --debug"})
        assert _comfy_mcp_argv() == ["comfy-mcp", "--debug"]

    def test_enabled_but_missing_executable(self, reset_db, monkeypatch):
        import shutil

        from ComfyTV import storage
        from ComfyTV.api.bot_turns import _comfy_mcp_argv
        storage.set_settings({"bot-enable-comfy-mcp": True})
        monkeypatch.setattr(shutil, "which", lambda name: None)
        assert _comfy_mcp_argv() == []

    def test_allowed_tools_extended_only_when_mounted(self, reset_db):
        from ComfyTV.bot.turns import allowed_tools
        assert allowed_tools("comfytv", []) == ["mcp__comfytv__*"]
        extended = allowed_tools("comfytv", ["comfy-mcp"])
        assert extended[0] == "mcp__comfytv__*"
        assert "mcp__comfy__nodes" in extended
        assert "mcp__comfy__validate_workflow" in extended
        assert len(extended) == 1 + len(COMFY_MCP_ALLOWED_TOOLS)
