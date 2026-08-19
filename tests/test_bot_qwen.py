from __future__ import annotations

import json

import pytest

from ComfyTV.bot.qwen_code import (
    _EXCLUDED_CORE_TOOLS,
    QwenCodeProvider,
    _QwenStreamParser,
    write_project_settings,
)
from ComfyTV.bot.providers import TurnRequest


def _line(obj) -> str:
    return json.dumps(obj)


class TestQwenParser:
    def test_assistant_text_blocks_stream_as_deltas(self):
        p = _QwenStreamParser()
        events = p.parse_line(_line({"type": "assistant", "message": {
            "content": [{"type": "text", "text": "hello there"}]}}))
        assert [(e.t, e.text) for e in events] == [("delta", "hello there")]

    def test_assistant_text_suppressed_after_stream_deltas(self):
        p = _QwenStreamParser()
        p.parse_line(_line({
            "type": "stream_event",
            "event": {"type": "content_block_delta",
                      "delta": {"type": "text_delta", "text": "hel"}},
        }))
        events = p.parse_line(_line({"type": "assistant", "message": {
            "content": [{"type": "text", "text": "hello"}]}}))
        assert events == []

    def test_tool_use_and_result_flow(self):
        p = _QwenStreamParser()
        first = p.parse_line(_line({"type": "assistant", "message": {"content": [
            {"type": "tool_use", "id": "t1",
             "name": "mcp__comfytv__get_canvas", "input": {}},
        ]}}))
        assert [(e.t, e.name) for e in first] == [
            ("tool_use", "mcp__comfytv__get_canvas")]
        results = p.parse_line(_line({"type": "user", "message": {"content": [
            {"type": "tool_result", "tool_use_id": "t1", "content": "ok"},
        ]}}))
        assert [(e.t, e.name, e.text) for e in results] == [
            ("tool_result", "mcp__comfytv__get_canvas", "ok")]

    def test_result_and_session(self):
        p = _QwenStreamParser()
        p.parse_line(_line({"type": "system", "subtype": "init",
                            "session_id": "q-1"}))
        p.parse_line(_line({"type": "result", "subtype": "success",
                            "is_error": False}))
        assert p.result_seen
        assert p.session_id == "q-1"


class TestProjectSettings:
    def test_writes_isolated_config(self, tmp_path):
        path = write_project_settings(str(tmp_path),
                                      "http://127.0.0.1:8188/comfytv/mcp")
        assert path == tmp_path / ".qwen" / "settings.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        server = data["mcpServers"]["comfytv"]
        assert server["httpUrl"] == "http://127.0.0.1:8188/comfytv/mcp"
        assert server["trust"] is True
        assert data["allowMCPServers"] == ["comfytv"]
        assert "run_shell_command" in data["excludeTools"]
        assert "write_file" in data["excludeTools"]
        assert set(data["excludeTools"]) == set(_EXCLUDED_CORE_TOOLS)
        include = server["includeTools"]
        for name in ("get_canvas", "add_stage", "run_stage", "wait_stage",
                     "view_image"):
            assert name in include
        assert "scene_edit" not in include
        assert data["contentGenerator"]["timeout"] == 180_000

    def test_preserves_user_content_generator_timeout(self, tmp_path):
        target = tmp_path / ".qwen" / "settings.json"
        target.parent.mkdir(parents=True)
        target.write_text(json.dumps({
            "contentGenerator": {"timeout": 300000},
        }), encoding="utf-8")
        write_project_settings(str(tmp_path), "http://x/mcp")
        data = json.loads(target.read_text(encoding="utf-8"))
        assert data["contentGenerator"]["timeout"] == 300000

    def test_merges_existing_settings(self, tmp_path):
        target = tmp_path / ".qwen" / "settings.json"
        target.parent.mkdir(parents=True)
        target.write_text(json.dumps({
            "theme": "dark",
            "mcpServers": {"other": {"command": "x"}},
        }), encoding="utf-8")
        write_project_settings(str(tmp_path), "http://127.0.0.1:9/mcp")
        data = json.loads(target.read_text(encoding="utf-8"))
        assert data["theme"] == "dark"
        assert "other" in data["mcpServers"]
        assert "comfytv" in data["mcpServers"]

    def test_recovers_from_corrupt_file(self, tmp_path):
        target = tmp_path / ".qwen" / "settings.json"
        target.parent.mkdir(parents=True)
        target.write_text("{broken", encoding="utf-8")
        write_project_settings(str(tmp_path), "http://x/mcp")
        data = json.loads(target.read_text(encoding="utf-8"))
        assert "comfytv" in data["mcpServers"]

    def test_mounts_comfy_mcp_when_given(self, tmp_path):
        from ComfyTV.bot._cli_common import COMFY_MCP_ALLOWED_TOOLS
        path = write_project_settings(str(tmp_path), "http://x/mcp",
                                      ["comfy-mcp", "--debug"])
        data = json.loads(path.read_text(encoding="utf-8"))
        comfy = data["mcpServers"]["comfy"]
        assert comfy["command"] == "comfy-mcp"
        assert comfy["args"] == ["--debug"]
        assert comfy["includeTools"] == list(COMFY_MCP_ALLOWED_TOOLS)
        assert data["allowMCPServers"] == ["comfytv", "comfy"]

    def test_unmounts_stale_comfy_mcp(self, tmp_path):
        write_project_settings(str(tmp_path), "http://x/mcp", ["comfy-mcp"])
        path = write_project_settings(str(tmp_path), "http://x/mcp")
        data = json.loads(path.read_text(encoding="utf-8"))
        assert "comfy" not in data["mcpServers"]
        assert data["allowMCPServers"] == ["comfytv"]


class TestListModels:
    async def test_reads_model_providers(self, tmp_path, monkeypatch):
        from pathlib import Path
        home = tmp_path / "home"
        (home / ".qwen").mkdir(parents=True)
        (home / ".qwen" / "settings.json").write_text(json.dumps({
            "modelProviders": {"openai": [
                {"id": "local-27b"}, {"id": "cloud-x"}, {"id": "local-27b"},
            ]},
        }), encoding="utf-8")
        monkeypatch.setattr(Path, "home", lambda: home)
        models = await QwenCodeProvider(home_dir=".").list_models()
        assert models == ["local-27b", "cloud-x"]

    async def test_missing_or_corrupt_settings(self, tmp_path, monkeypatch):
        from pathlib import Path
        monkeypatch.setattr(Path, "home", lambda: tmp_path / "nope")
        assert await QwenCodeProvider(home_dir=".").list_models() == []
        home = tmp_path / "home"
        (home / ".qwen").mkdir(parents=True)
        (home / ".qwen" / "settings.json").write_text("{broken",
                                                      encoding="utf-8")
        monkeypatch.setattr(Path, "home", lambda: home)
        assert await QwenCodeProvider(home_dir=".").list_models() == []


class TestQwenArgv:
    def _argv(self, turn, monkeypatch):
        from ComfyTV.bot import qwen_code
        monkeypatch.setattr(qwen_code, "resolve_qwen_command",
                            lambda: ["qwen"])
        provider = QwenCodeProvider(home_dir=".")
        return provider._build_argv(turn)

    def test_basic_shape(self, monkeypatch):
        argv = self._argv(TurnRequest(chat_id="c", user_text="hi"), monkeypatch)
        assert argv[:2] == ["qwen", "-p"]
        assert "hi" in argv
        assert "--output-format" in argv
        assert "-y" in argv
        assert "--verbose" not in argv
        assert "--resume" not in argv

    def test_resume(self, monkeypatch):
        argv = self._argv(TurnRequest(chat_id="c", user_text="hi",
                                      resume_token="q-9"), monkeypatch)
        i = argv.index("--resume")
        assert argv[i + 1] == "q-9"

    def test_model_override(self, monkeypatch):
        argv = self._argv(TurnRequest(chat_id="c", user_text="hi",
                                      model="qwen3.8-27b-uncensored"),
                          monkeypatch)
        i = argv.index("-m")
        assert argv[i + 1] == "qwen3.8-27b-uncensored"
        plain = self._argv(TurnRequest(chat_id="c", user_text="hi"),
                           monkeypatch)
        assert "-m" not in plain

    def test_no_attachments_capability(self):
        caps = QwenCodeProvider(home_dir=".").capabilities()
        assert caps.attachments is False
        assert caps.stateful is True
