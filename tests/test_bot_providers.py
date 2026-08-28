from __future__ import annotations

import json

import pytest

from conftest import wait_bot_done as _wait_done
from ComfyTV.bot.claude_code import _StreamParser, _tool_result_text
from ComfyTV.bot.providers import BotEvent, TurnRequest


@pytest.fixture()
def client(bot_client):
    return bot_client


def _line(obj) -> str:
    return json.dumps(obj)


class TestStreamParser:
    def test_init_sets_session_id(self):
        p = _StreamParser()
        p.parse_line(_line({"type": "system", "subtype": "init",
                            "session_id": "sid-1"}))
        assert p.session_id == "sid-1"

    def test_text_delta_emits(self):
        p = _StreamParser()
        events = p.parse_line(_line({
            "type": "stream_event",
            "event": {"type": "content_block_delta",
                      "delta": {"type": "text_delta", "text": "hel"}},
        }))
        assert [(e.t, e.text) for e in events] == [("delta", "hel")]

    def test_thinking_delta_ignored(self):
        p = _StreamParser()
        events = p.parse_line(_line({
            "type": "stream_event",
            "event": {"type": "content_block_delta",
                      "delta": {"type": "thinking_delta", "thinking": "hmm"}},
        }))
        assert events == []

    def test_tool_use_dedupes_across_snapshots(self):
        p = _StreamParser()
        msg = {"content": [{"type": "tool_use", "id": "tu-1",
                            "name": "mcp__comfytv__server_info", "input": {}}]}
        first = p.parse_line(_line({"type": "assistant", "message": msg}))
        second = p.parse_line(_line({"type": "assistant", "message": msg}))
        assert [(e.t, e.name) for e in first] == [
            ("tool_use", "mcp__comfytv__server_info")]
        assert second == []

    def test_tool_result_maps_name(self):
        p = _StreamParser()
        p.parse_line(_line({"type": "assistant", "message": {"content": [
            {"type": "tool_use", "id": "tu-1", "name": "mcp__comfytv__assets",
             "input": {"q": 1}},
        ]}}))
        events = p.parse_line(_line({"type": "user", "message": {"content": [
            {"type": "tool_result", "tool_use_id": "tu-1",
             "content": [{"type": "text", "text": "ok"}]},
        ]}}))
        assert [(e.t, e.name, e.text) for e in events] == [
            ("tool_result", "mcp__comfytv__assets", "ok")]

    def test_result_error_and_session(self):
        p = _StreamParser()
        p.parse_line(_line({"type": "result", "subtype": "success",
                            "is_error": True, "result": "boom",
                            "session_id": "sid-9"}))
        assert p.result_seen
        assert p.result_error == "boom"
        assert p.session_id == "sid-9"

    def test_garbage_lines_ignored(self):
        p = _StreamParser()
        assert p.parse_line("not json") == []
        assert p.parse_line("") == []
        assert p.parse_line(_line(["array"])) == []

    def test_tool_result_text_shapes(self):
        assert _tool_result_text("plain") == "plain"
        assert _tool_result_text([{"type": "text", "text": "a"},
                                  {"type": "text", "text": "b"}]) == "a\nb"
        assert _tool_result_text(None) == ""

    def test_tool_events_carry_id_and_error_flag(self):
        p = _StreamParser()
        use_events = p.parse_line(_line({"type": "assistant", "message": {
            "content": [{"type": "tool_use", "id": "tu-9",
                         "name": "mcp__comfytv__run_stage", "input": {}}]}}))
        result_events = p.parse_line(_line({"type": "user", "message": {
            "content": [{"type": "tool_result", "tool_use_id": "tu-9",
                         "is_error": True,
                         "content": [{"type": "text", "text": "nope"}]}]}}))
        assert use_events[0].id == "tu-9"
        assert use_events[0].is_error is False
        assert result_events[0].id == "tu-9"
        assert result_events[0].is_error is True

    def test_result_captures_usage(self):
        p = _StreamParser()
        p.parse_line(_line({"type": "result", "session_id": "s",
                            "total_cost_usd": 0.0123,
                            "usage": {"input_tokens": 100, "output_tokens": 20,
                                      "cache_read_input_tokens": 5}}))
        assert p.usage == {"input_tokens": 100, "output_tokens": 20,
                           "cache_read_input_tokens": 5, "cost_usd": 0.0123}


class TestUsageHelpers:
    def test_normalize_maps_openai_aliases(self):
        from ComfyTV.bot._cli_common import normalize_usage
        assert normalize_usage({"prompt_tokens": 7, "completion_tokens": 2}) \
            == {"input_tokens": 7, "output_tokens": 2}

    def test_normalize_empty_returns_none(self):
        from ComfyTV.bot._cli_common import normalize_usage
        assert normalize_usage({}) is None
        assert normalize_usage(None) is None
        assert normalize_usage("garbage") is None

    def test_merge_accumulates(self):
        from ComfyTV.bot._cli_common import merge_usage
        total = merge_usage(None, {"prompt_tokens": 5, "completion_tokens": 1})
        total = merge_usage(total, {"prompt_tokens": 3, "completion_tokens": 2})
        assert total == {"input_tokens": 8, "output_tokens": 3}
        assert merge_usage(total, None) == total



class TestSpawnEnv:
    def test_sets_mcp_tool_timeout(self, monkeypatch):
        from ComfyTV.bot.claude_code import spawn_env
        monkeypatch.delenv("MCP_TOOL_TIMEOUT", raising=False)
        env = spawn_env()
        assert int(env["MCP_TOOL_TIMEOUT"]) >= 120_000
        assert "PATH" in env or "Path" in env

    def test_respects_user_override(self, monkeypatch):
        from ComfyTV.bot.claude_code import spawn_env
        monkeypatch.setenv("MCP_TOOL_TIMEOUT", "5000")
        assert spawn_env()["MCP_TOOL_TIMEOUT"] == "5000"


class TestStreamInput:
    def test_envelope_shape(self):
        from ComfyTV.bot.claude_code import build_stream_input
        from ComfyTV.bot.providers import TurnRequest
        turn = TurnRequest(chat_id="c", user_text="what is this?", attachments=[
            {"data": "QUJD", "media_type": "image/jpeg"},
            {"data": "REVG", "media_type": "image/png"},
            {"data": ""},
        ])
        line = build_stream_input(turn)
        assert line.endswith("\n")
        env = json.loads(line)
        assert env["type"] == "user"
        content = env["message"]["content"]
        assert [b["type"] for b in content] == ["image", "image", "text"]
        assert content[0]["source"] == {"type": "base64",
                                        "media_type": "image/jpeg",
                                        "data": "QUJD"}
        assert content[1]["source"]["media_type"] == "image/png"
        assert content[2]["text"] == "what is this?"

    def test_argv_switches_to_stream_input(self):
        from ComfyTV.bot.claude_code import ClaudeCodeProvider
        from ComfyTV.bot.providers import TurnRequest
        provider = ClaudeCodeProvider(home_dir=".")
        plain = provider._build_argv(TurnRequest(chat_id="c", user_text="hi"))
        assert "hi" in plain
        assert "--input-format" not in plain
        withatt = provider._build_argv(TurnRequest(
            chat_id="c", user_text="hi",
            attachments=[{"data": "QUJD"}]))
        assert "hi" not in withatt
        i = withatt.index("--input-format")
        assert withatt[i + 1] == "stream-json"


class TestModelOverride:
    def test_claude_argv_model(self):
        from ComfyTV.bot.claude_code import ClaudeCodeProvider
        from ComfyTV.bot.providers import TurnRequest
        provider = ClaudeCodeProvider(home_dir=".")
        plain = provider._build_argv(TurnRequest(chat_id="c", user_text="hi"))
        assert "--model" not in plain
        argv = provider._build_argv(TurnRequest(
            chat_id="c", user_text="hi", model="sonnet"))
        i = argv.index("--model")
        assert argv[i + 1] == "sonnet"

    async def test_claude_model_aliases(self):
        from ComfyTV.bot.claude_code import ClaudeCodeProvider
        models = await ClaudeCodeProvider(home_dir=".").list_models()
        assert models == ["sonnet", "opus", "haiku"]

    async def test_status_reports_models(self, client, fake_provider):
        resp = await client.get("/comfytv/bot/status")
        data = await resp.json()
        entry = next(p for p in data["providers"] if p["id"] == "fake-test")
        assert entry["models"] == []

    async def test_setting_reaches_provider(self, client, fake_provider,
                                            monkeypatch):
        from ComfyTV import settings, storage
        monkeypatch.setitem(settings.SETTINGS_SPEC, "bot-model-fake-test",
                            {"type": "string", "default": ""})
        storage.set_settings({"bot-model-fake-test": "shiny-model"})
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat = (await resp.json())["chat"]
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"text": "hello"})
        assert resp.status == 200
        await _wait_done(client, chat["id"])
        assert fake_provider.last_turn.model == "shiny-model"

    async def test_stateless_provider_gets_history(self, client, fake_stateless):
        fake_stateless.script = [BotEvent(t="delta", text="first answer")]
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-stateless"})
        chat = (await resp.json())["chat"]
        await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                          json={"text": "first question"})
        await _wait_done(client, chat["id"])
        assert fake_stateless.last_turn.history == []
        fake_stateless.script = [BotEvent(t="delta", text="second answer")]
        await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                          json={"text": "second question"})
        await _wait_done(client, chat["id"])
        assert fake_stateless.last_turn.history == [
            {"role": "user", "text": "first question"},
            {"role": "assistant", "text": "first answer"},
        ]

    async def test_stateful_provider_gets_no_history(self, client, fake_provider):
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat = (await resp.json())["chat"]
        await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                          json={"text": "one"})
        await _wait_done(client, chat["id"])
        assert fake_provider.last_turn.history is None

    async def test_blank_setting_means_default(self, client, fake_provider):
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat = (await resp.json())["chat"]
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"text": "hello"})
        assert resp.status == 200
        await _wait_done(client, chat["id"])
        assert fake_provider.last_turn.model == ""

