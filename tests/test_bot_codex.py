from __future__ import annotations

import base64
import json

from ComfyTV.bot.codex import (
    CodexCodeProvider,
    _CodexStreamParser,
    _flatten_mcp_content,
)
from ComfyTV.bot.providers import TurnRequest


def _line(obj) -> str:
    return json.dumps(obj)


class TestCodexParser:
    def test_thread_started_sets_session(self):
        p = _CodexStreamParser()
        assert p.parse_line(_line({"type": "thread.started",
                                   "thread_id": "th-1"})) == []
        assert p.session_id == "th-1"

    def test_agent_message_streams_incremental_deltas(self):
        p = _CodexStreamParser()
        first = p.parse_line(_line({"type": "item.updated", "item": {
            "id": "m1", "type": "agent_message", "text": "hel"}}))
        second = p.parse_line(_line({"type": "item.updated", "item": {
            "id": "m1", "type": "agent_message", "text": "hello"}}))
        done = p.parse_line(_line({"type": "item.completed", "item": {
            "id": "m1", "type": "agent_message", "text": "hello"}}))
        assert [(e.t, e.text) for e in first] == [("delta", "hel")]
        assert [(e.t, e.text) for e in second] == [("delta", "lo")]
        assert done == []

    def test_tool_use_emitted_once(self):
        p = _CodexStreamParser()
        item = {"id": "t1", "type": "mcp_tool_call",
                "tool": "mcp__comfytv__get_canvas", "arguments": {},
                "status": "in_progress"}
        first = p.parse_line(_line({"type": "item.started", "item": item}))
        again = p.parse_line(_line({"type": "item.updated", "item": item}))
        assert [(e.t, e.name) for e in first] == [
            ("tool_use", "mcp__comfytv__get_canvas")]
        assert again == []

    def test_tool_result_from_completed(self):
        p = _CodexStreamParser()
        p.parse_line(_line({"type": "item.started", "item": {
            "id": "t1", "type": "mcp_tool_call", "tool": "srv",
            "arguments": {}, "status": "in_progress"}}))
        events = p.parse_line(_line({"type": "item.completed", "item": {
            "id": "t1", "type": "mcp_tool_call", "tool": "srv",
            "status": "completed",
            "result": {"content": [{"type": "text", "text": "ok"}]}}}))
        assert [(e.t, e.name, e.text) for e in events] == [
            ("tool_result", "srv", "ok")]

    def test_tool_result_structured_content_fallback(self):
        p = _CodexStreamParser()
        events = p.parse_line(_line({"type": "item.completed", "item": {
            "id": "t2", "type": "mcp_tool_call", "tool": "srv",
            "status": "completed",
            "result": {"structured_content": {"a": 1}}}}))
        assert events[0].text == json.dumps({"a": 1})

    def test_tool_failure_surfaces_message(self):
        p = _CodexStreamParser()
        events = p.parse_line(_line({"type": "item.completed", "item": {
            "id": "t3", "type": "mcp_tool_call", "tool": "srv",
            "status": "failed", "error": {"message": "boom"}}}))
        assert [(e.t, e.text) for e in events] == [("tool_result", "boom")]

    def test_turn_completed_and_failed(self):
        p = _CodexStreamParser()
        p.parse_line(_line({"type": "turn.completed"}))
        assert p.result_seen and not p.result_error
        q = _CodexStreamParser()
        q.parse_line(_line({"type": "turn.failed",
                            "error": {"message": "nope"}}))
        assert q.result_seen and q.result_error == "nope"

    def test_flatten_mixed_content(self):
        assert _flatten_mcp_content("plain") == "plain"
        assert _flatten_mcp_content(None) == ""
        assert _flatten_mcp_content([
            {"type": "text", "text": "a"}, "b",
        ]) == "a\nb"


class TestCodexArgv:
    def _provider(self, monkeypatch, tmp_path):
        from ComfyTV.bot import codex
        monkeypatch.setattr(codex, "resolve_codex_command", lambda: ["codex"])
        monkeypatch.setattr(CodexCodeProvider, "_mcp_lockdown_args",
                            lambda self: [])
        return CodexCodeProvider(home_dir=str(tmp_path))

    def test_first_turn_shape(self, monkeypatch, tmp_path):
        provider = self._provider(monkeypatch, tmp_path)
        argv, temp = provider._build_argv(
            TurnRequest(chat_id="c", user_text="hi",
                        mcp_endpoint="http://127.0.0.1:8188/comfytv/mcp"),
            str(tmp_path))
        assert argv[:2] == ["codex", "exec"]
        assert "--json" in argv
        assert "--skip-git-repo-check" in argv
        assert "--sandbox" in argv
        assert argv[argv.index("--sandbox") + 1] == "workspace-write"
        assert 'mcp_servers.comfytv.url="http://127.0.0.1:8188/comfytv/mcp"' in argv
        assert "mcp_servers.comfytv.tool_timeout_sec=180" in argv
        assert "features.shell_tool=false" in argv
        assert 'web_search="disabled"' in argv
        assert 'approvals_reviewer="auto_review"' in argv
        assert argv[-1] == "hi"
        assert temp == []

    def test_resume_turn(self, monkeypatch, tmp_path):
        provider = self._provider(monkeypatch, tmp_path)
        argv, _ = provider._build_argv(
            TurnRequest(chat_id="c", user_text="hi", resume_token="th-9"),
            str(tmp_path))
        assert argv[:3] == ["codex", "exec", "resume"]
        assert "--sandbox" not in argv
        assert 'approvals_reviewer="auto_review"' in argv
        assert argv[-2] == "th-9"
        assert argv[-1] == "hi"

    def test_attachments_written_and_flagged(self, monkeypatch, tmp_path):
        provider = self._provider(monkeypatch, tmp_path)
        data = base64.b64encode(b"jpegbytes").decode("ascii")
        argv, temp = provider._build_argv(
            TurnRequest(chat_id="c", user_text="hi", attachments=[
                {"data": data, "media_type": "image/jpeg"},
                {"data": data, "media_type": "image/jpeg"},
            ]),
            str(tmp_path))
        assert len(temp) == 2
        assert len(set(temp)) == 2
        assert argv.count("-i") == 2
        for path in temp:
            with open(path, "rb") as fh:
                assert fh.read() == b"jpegbytes"

    def test_bad_attachment_skipped(self, monkeypatch, tmp_path):
        provider = self._provider(monkeypatch, tmp_path)
        argv, temp = provider._build_argv(
            TurnRequest(chat_id="c", user_text="hi", attachments=[
                {"data": "", "media_type": "image/jpeg"},
                {"media_type": "image/jpeg"},
            ]),
            str(tmp_path))
        assert temp == []
        assert "-i" not in argv


class TestCodexCaps:
    def test_capabilities(self):
        caps = CodexCodeProvider(home_dir=".").capabilities()
        assert caps.stateful is True
        assert caps.attachments is True

    def test_home_writes_agent_instructions(self, tmp_path, monkeypatch):
        provider = CodexCodeProvider(home_dir=str(tmp_path / "h"))
        home = provider._resolve_home()
        assert home.endswith("h")
        import os
        assert os.path.isdir(home)
        path = os.path.join(home, "AGENTS.md")
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
        assert "get_canvas" in text
        assert "MCP" in text
        assert "resource" not in text.lower()

    def test_agent_instructions_rewritten_when_stale(self, tmp_path):
        from ComfyTV.bot.codex import write_agent_instructions
        (tmp_path / "AGENTS.md").write_text("old resource bridge text",
                                            encoding="utf-8")
        path = write_agent_instructions(str(tmp_path))
        text = path.read_text(encoding="utf-8")
        assert "old resource" not in text
        assert "get_canvas" in text
