from __future__ import annotations

import json

import pytest

from ComfyTV.bot._cli_common import (
    COMFY_MCP_ALLOWED_TOOLS,
    CORE_MCP_TOOLS,
    resolve_comfy_mcp_argv,
)
from ComfyTV.bot.providers import TurnRequest


class TestResolveComfyMcpArgv:
    def test_splits_explicit_command(self):
        assert resolve_comfy_mcp_argv("comfy-mcp --debug") == \
            ["comfy-mcp", "--debug"]

    def test_quoted_path_survives(self):
        argv = resolve_comfy_mcp_argv('"comfy mcp launcher" -m comfy_mcp')
        assert argv == ["comfy mcp launcher", "-m", "comfy_mcp"]

    def test_blank_falls_back_to_path_lookup(self, monkeypatch):
        import shutil
        monkeypatch.setattr(shutil, "which",
                            lambda name: "/bin/comfy-mcp"
                            if name == "comfy-mcp" else None)
        assert resolve_comfy_mcp_argv("") == ["/bin/comfy-mcp"]

    def test_blank_and_not_installed(self, monkeypatch):
        import shutil
        monkeypatch.setattr(shutil, "which", lambda name: None)
        assert resolve_comfy_mcp_argv("  ") == []


class TestAllowlists:
    def test_comfy_allowlist_is_read_only(self):
        for banned in ("run_workflow", "stop_comfyui", "restart_comfyui",
                       "update_comfyui", "switch_comfyui_version",
                       "download_model", "install_node", "launch_comfyui",
                       "upload_file", "free_memory"):
            assert banned not in COMFY_MCP_ALLOWED_TOOLS
        assert "nodes" in COMFY_MCP_ALLOWED_TOOLS
        assert "validate_workflow" in COMFY_MCP_ALLOWED_TOOLS

    def test_core_tools_cover_workflow_authoring(self):
        for tool in ("node_info", "workflow_create", "workflow_get",
                     "workflow_edit", "stage_params"):
            assert tool in CORE_MCP_TOOLS


class TestBotWiring:
    def test_disabled_by_default(self, reset_db):
        from ComfyTV.api.bot import _comfy_mcp_argv
        assert _comfy_mcp_argv() == []

    def test_enabled_with_command(self, reset_db):
        from ComfyTV import storage
        from ComfyTV.api.bot import _comfy_mcp_argv
        storage.set_settings({"bot-enable-comfy-mcp": True,
                              "bot-comfy-mcp-command": "comfy-mcp --debug"})
        assert _comfy_mcp_argv() == ["comfy-mcp", "--debug"]

    def test_enabled_but_missing_executable(self, reset_db, monkeypatch):
        import shutil
        from ComfyTV import storage
        from ComfyTV.api.bot import _comfy_mcp_argv
        storage.set_settings({"bot-enable-comfy-mcp": True})
        monkeypatch.setattr(shutil, "which", lambda name: None)
        assert _comfy_mcp_argv() == []

    def test_allowed_tools_extended_only_when_mounted(self, reset_db):
        from ComfyTV.api.bot import _allowed_tools
        assert _allowed_tools([]) == ["mcp__comfytv__*"]
        extended = _allowed_tools(["comfy-mcp"])
        assert extended[0] == "mcp__comfytv__*"
        assert "mcp__comfy__nodes" in extended
        assert "mcp__comfy__validate_workflow" in extended
        assert len(extended) == 1 + len(COMFY_MCP_ALLOWED_TOOLS)


class TestClaudeArgv:
    @pytest.fixture()
    def provider(self, monkeypatch):
        from ComfyTV.bot import claude_code
        monkeypatch.setattr(claude_code, "resolve_claude_command",
                            lambda: ["claude"])
        return claude_code.ClaudeCodeProvider()

    def _mcp_config(self, argv: list[str]) -> dict:
        return json.loads(argv[argv.index("--mcp-config") + 1])

    def test_single_server_without_comfy(self, provider):
        argv = provider._build_argv(TurnRequest(
            chat_id="c", user_text="hi",
            mcp_endpoint="http://127.0.0.1:8188/comfytv/mcp"))
        servers = self._mcp_config(argv)["mcpServers"]
        assert set(servers) == {"comfytv"}
        assert servers["comfytv"]["type"] == "http"
        assert "--strict-mcp-config" in argv

    def test_dual_servers_with_comfy(self, provider):
        argv = provider._build_argv(TurnRequest(
            chat_id="c", user_text="hi",
            mcp_endpoint="http://127.0.0.1:8188/comfytv/mcp",
            allowed_tools=["mcp__comfytv__*", "mcp__comfy__nodes"],
            comfy_mcp_argv=["comfy-mcp", "--debug"]))
        servers = self._mcp_config(argv)["mcpServers"]
        assert set(servers) == {"comfytv", "comfy"}
        assert servers["comfy"] == {"type": "stdio", "command": "comfy-mcp",
                                    "args": ["--debug"]}
        allowed = argv[argv.index("--allowedTools") + 1]
        assert "mcp__comfy__nodes" in allowed.split(",")
