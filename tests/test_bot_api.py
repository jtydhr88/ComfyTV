from __future__ import annotations

import asyncio
import json

import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

from ComfyTV.bot.claude_code import _StreamParser, _tool_result_text
from ComfyTV.bot.providers import (
    AgentProvider,
    BotEvent,
    ProviderCaps,
    ProviderStatus,
    TurnRequest,
    TurnResult,
    register_provider,
)


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


class FakeProvider(AgentProvider):
    id = "fake-test"
    label = "Fake"

    def __init__(self):
        self.script: list[BotEvent] = []
        self.result = TurnResult(resume_token="tok-1")
        self.gate: asyncio.Event | None = None
        self.stopped = False
        self.last_turn = None

    async def probe(self):
        return ProviderStatus(available=True, version="0.0", logged_in=True)

    def capabilities(self):
        return ProviderCaps(stateful=True, tools="mcp")

    async def send(self, turn, emit, handle):
        self.last_turn = turn
        for ev in self.script:
            await emit(ev)
        if self.gate is not None:
            await self.gate.wait()
        if handle.stop_requested:
            return TurnResult(resume_token="tok-abort", aborted=True)
        return self.result

    async def stop(self, handle):
        self.stopped = True
        handle.stop_requested = True
        if self.gate is not None:
            self.gate.set()


class FakeStatelessProvider(FakeProvider):
    id = "fake-stateless"

    def capabilities(self):
        return ProviderCaps(stateful=False, tools="mcp")


@pytest.fixture()
def fake_provider():
    provider = FakeProvider()
    register_provider(provider)
    return provider


@pytest.fixture()
def fake_stateless():
    provider = FakeStatelessProvider()
    register_provider(provider)
    return provider


@pytest.fixture()
async def client(reset_db):
    from ComfyTV import storage as _storage
    _storage.set_settings({"enable-mcp": True, "enable-bot": True})
    from ComfyTV import api  # noqa: F401
    from ComfyTV.api import bot_asks
    from ComfyTV.api.bot import ACTIVE_TURNS, QUEUED
    import server
    ACTIVE_TURNS.clear()
    QUEUED.clear()
    bot_asks.PENDING.clear()
    app = web.Application()
    app.router.add_routes(server.PromptServer.instance.routes)
    test_server = TestServer(app)
    test_client = TestClient(test_server)
    await test_client.start_server()
    yield test_client
    ACTIVE_TURNS.clear()
    QUEUED.clear()
    bot_asks.PENDING.clear()
    await test_client.close()


async def _wait_done(client, chat_id, timeout=5.0):
    loop = asyncio.get_event_loop()
    deadline = loop.time() + timeout
    while loop.time() < deadline:
        resp = await client.get(f"/comfytv/bot/chats/{chat_id}")
        data = await resp.json()
        msgs = data["messages"]
        if msgs and all(m["status"] != "streaming" for m in msgs):
            return data
        await asyncio.sleep(0.02)
    raise AssertionError("turn did not finish")


class TestBotEndpoints:
    async def test_status_lists_providers(self, client, fake_provider):
        resp = await client.get("/comfytv/bot/status")
        data = await resp.json()
        ids = {p["id"] for p in data["providers"]}
        assert "fake-test" in ids
        entry = next(p for p in data["providers"] if p["id"] == "fake-test")
        assert entry["available"] is True
        assert entry["stateful"] is True

    async def test_chat_crud(self, client, fake_provider):
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat = (await resp.json())["chat"]
        assert chat["provider"] == "fake-test"

        resp = await client.get("/comfytv/bot/chats")
        chats = (await resp.json())["chats"]
        assert [c["id"] for c in chats] == [chat["id"]]

        resp = await client.patch(f"/comfytv/bot/chats/{chat['id']}",
                                  json={"title": "renamed", "pinned": True})
        updated = (await resp.json())["chat"]
        assert updated["title"] == "renamed"
        assert updated["pinned"] is True

        resp = await client.patch(f"/comfytv/bot/chats/{chat['id']}",
                                  json={"archived": True})
        assert (await resp.json())["chat"]["archived"] is True
        resp = await client.get("/comfytv/bot/chats")
        assert (await resp.json())["chats"] == []

        resp = await client.delete(f"/comfytv/bot/chats/{chat['id']}")
        assert (await resp.json())["ok"] is True
        resp = await client.get(f"/comfytv/bot/chats/{chat['id']}")
        assert resp.status == 404

    async def test_unknown_provider_rejected(self, client):
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "nope"})
        assert resp.status == 400

    async def test_send_assembles_blocks_and_title(self, client, fake_provider):
        fake_provider.script = [
            BotEvent(t="delta", text="I will "),
            BotEvent(t="delta", text="check."),
            BotEvent(t="tool_use", name="mcp__comfytv__get_canvas", input={}),
            BotEvent(t="tool_result", name="mcp__comfytv__get_canvas",
                     text="{}"),
            BotEvent(t="delta", text="Done."),
        ]
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat = (await resp.json())["chat"]
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"text": "看下画布"})
        assert resp.status == 200
        body = await resp.json()
        assert body["assistant_message"]["status"] == "streaming"

        data = await _wait_done(client, chat["id"])
        assistant = data["messages"][-1]
        blocks = json.loads(assistant["content"])
        assert [b["type"] for b in blocks] == [
            "text", "tool_use", "tool_result", "text"]
        assert blocks[0]["text"] == "I will check."
        assert assistant["status"] == "done"
        assert assistant["resume_token_after"] == "tok-1"
        assert data["chat"]["resume_token"] == "tok-1"
        assert data["chat"]["title"] == "看下画布"
        assert fake_provider.last_turn.allowed_tools == ["mcp__comfytv__*"]
        assert "/comfytv/mcp?bot_chat=" in fake_provider.last_turn.mcp_endpoint

    def test_claude_argv_disallows_builtin_tools(self):
        from ComfyTV.bot.claude_code import ClaudeCodeProvider
        provider = ClaudeCodeProvider()
        argv = provider._build_argv(TurnRequest(
            chat_id="c", user_text="hi",
            mcp_endpoint="http://x/comfytv/mcp?bot_chat=c",
            allowed_tools=["mcp__comfytv__*"]))
        flag = argv[argv.index("--disallowedTools") + 1]
        for tool in ("Write", "Edit", "Bash", "Read", "WebFetch"):
            assert tool in flag.split(",")

    async def test_second_turn_resumes(self, client, fake_provider):
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat = (await resp.json())["chat"]
        await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                          json={"text": "one"})
        await _wait_done(client, chat["id"])
        await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                          json={"text": "two"})
        await _wait_done(client, chat["id"])
        assert fake_provider.last_turn.resume_token == "tok-1"

    async def test_busy_chat_queues_send_and_drains(self, client, fake_provider):
        fake_provider.gate = asyncio.Event()
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat = (await resp.json())["chat"]
        await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                          json={"text": "first"})
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"text": "second"})
        assert resp.status == 200
        body = await resp.json()
        assert body["queued"] is True
        assert body["user_message"]["status"] == "queued"
        fake_provider.gate.set()
        fake_provider.gate = None
        data = await _wait_done(client, chat["id"])
        roles = [m["role"] for m in data["messages"]]
        assert roles == ["user", "assistant", "user", "assistant"]
        statuses = [m["status"] for m in data["messages"]]
        assert "queued" not in statuses

    async def test_branch_copies_history_and_resume_token(
            self, client, fake_provider):
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat = (await resp.json())["chat"]
        await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                          json={"text": "one"})
        data = await _wait_done(client, chat["id"])
        assistant_id = next(m["id"] for m in data["messages"]
                            if m["role"] == "assistant")

        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/branch",
                                 json={"message_id": assistant_id})
        assert resp.status == 200
        body = await resp.json()
        branch = body["chat"]
        assert branch["id"] != chat["id"]
        assert branch["resume_token"] == "tok-1"
        assert [m["role"] for m in body["messages"]] == ["user", "assistant"]
        assert {m["chat_id"] for m in body["messages"]} == {branch["id"]}

        missing = await client.post(
            f"/comfytv/bot/chats/{chat['id']}/branch",
            json={"message_id": "nope"})
        assert missing.status == 404

    async def test_stop_aborts_turn(self, client, fake_provider):
        fake_provider.gate = asyncio.Event()
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat = (await resp.json())["chat"]
        await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                          json={"text": "long task"})
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/stop")
        assert (await resp.json())["ok"] is True
        assert fake_provider.stopped is True
        data = await _wait_done(client, chat["id"])
        assert data["messages"][-1]["status"] == "aborted"

    async def test_stop_without_turn_409(self, client, fake_provider):
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat = (await resp.json())["chat"]
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/stop")
        assert resp.status == 409

    async def test_empty_text_rejected(self, client, fake_provider):
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat = (await resp.json())["chat"]
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"text": "  "})
        assert resp.status == 400

    async def test_turn_persists_tool_metadata_and_usage(
            self, client, fake_provider, monkeypatch):
        from ComfyTV.api import bot as bot_api
        broadcasts: list[tuple[str, dict]] = []
        monkeypatch.setattr(
            bot_api, "_broadcast",
            lambda ev, payload: broadcasts.append((ev, payload)))

        fake_provider.script = [
            BotEvent(t="tool_use", name="mcp__comfytv__get_canvas",
                     input={}, id="tu-1"),
            BotEvent(t="tool_result", name="mcp__comfytv__get_canvas",
                     text="{}", id="tu-1"),
            BotEvent(t="tool_use", name="mcp__comfytv__run_stage",
                     input={"uid": "s1"}, id="tu-2"),
            BotEvent(t="tool_result", name="mcp__comfytv__run_stage",
                     text="boom", id="tu-2", is_error=True),
            BotEvent(t="delta", text="done"),
        ]
        usage = {"input_tokens": 10, "output_tokens": 3, "cost_usd": 0.01}
        fake_provider.result = TurnResult(resume_token="tok-1", usage=usage)

        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat_id = (await resp.json())["chat"]["id"]
        await client.post(f"/comfytv/bot/chats/{chat_id}/send",
                          json={"text": "go"})
        data = await _wait_done(client, chat_id)

        assistant = next(m for m in data["messages"]
                         if m["role"] == "assistant")
        assert assistant["usage"] == usage
        blocks = json.loads(assistant["content"])
        results = [b for b in blocks if b["type"] == "tool_result"]
        assert results[0]["id"] == "tu-1"
        assert results[0]["status"] == "success"
        assert isinstance(results[0]["duration_ms"], int)
        assert results[1]["id"] == "tu-2"
        assert results[1]["status"] == "error"

        tool_use_events = [p for ev, p in broadcasts if ev == "turn_tool_use"]
        assert [p["id"] for p in tool_use_events] == ["tu-1", "tu-2"]
        result_events = [p for ev, p in broadcasts if ev == "turn_tool_result"]
        assert result_events[0]["status"] == "success"
        assert "duration_ms" in result_events[0]
        assert result_events[1]["status"] == "error"
        turn_done = next(p for ev, p in broadcasts if ev == "turn_done")
        assert turn_done["usage"] == usage

    async def test_send_with_refs_builds_blocks_and_manifest(
            self, client, fake_provider, reset_db):
        from ComfyTV import storage
        asset = storage.create_asset(
            name="hero.png", media_type="image", payload_url="/x/hero.png")
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat_id = (await resp.json())["chat"]["id"]
        resp = await client.post(
            f"/comfytv/bot/chats/{chat_id}/send",
            json={"text": "use these", "refs": [
                {"kind": "stage", "uid": "st-1", "title": "Hero shot",
                 "stage_class": "ImageStage"},
                {"kind": "asset", "asset_id": asset["id"]},
            ]})
        assert resp.status == 200
        user_msg = (await resp.json())["user_message"]
        blocks = json.loads(user_msg["content"])
        kinds = [(b["type"], b.get("kind")) for b in blocks]
        assert ("ref", "stage") in kinds and ("ref", "asset") in kinds
        await _wait_done(client, chat_id)
        sent = fake_provider.last_turn.user_text
        assert "Referenced stage: st-1" in sent
        assert f'asset_refs [{{"asset_id": {asset["id"]}}}]' in sent

    async def test_send_rejects_bad_refs(self, client, fake_provider):
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat_id = (await resp.json())["chat"]["id"]
        resp = await client.post(
            f"/comfytv/bot/chats/{chat_id}/send",
            json={"text": "x", "refs": [{"kind": "asset", "asset_id": 999999}]})
        assert resp.status == 400

    async def test_turn_error_persists_notice_block(self, client, fake_provider):
        fake_provider.script = [BotEvent(t="delta", text="partial")]
        fake_provider.result = TurnResult(error="model exploded")
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat_id = (await resp.json())["chat"]["id"]
        await client.post(f"/comfytv/bot/chats/{chat_id}/send",
                          json={"text": "go"})
        data = await _wait_done(client, chat_id)
        assistant = next(m for m in data["messages"]
                         if m["role"] == "assistant")
        assert assistant["status"] == "error"
        blocks = json.loads(assistant["content"])
        assert blocks[-1] == {"type": "notice", "level": "error",
                              "text": "model exploded"}

    async def test_reap_marks_stale_streaming(self, client, fake_provider):
        from ComfyTV import storage
        from ComfyTV.api.bot import _reap_stale_messages
        chat = storage.create_bot_chat(provider="fake-test")
        msg = storage.create_bot_message(
            chat_id=chat["id"], role="assistant", status="streaming")
        _reap_stale_messages()
        msgs = storage.list_bot_messages(chat["id"])
        assert msgs[0]["id"] == msg["id"]
        assert msgs[0]["status"] == "aborted"


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


class TestAttachments:
    def _make_image_asset(self, tmp_path, monkeypatch, name="ref"):
        from PIL import Image
        from ComfyTV import storage
        from ComfyTV.runners import media
        src = tmp_path / f"{name}.png"
        Image.new("RGB", (2400, 1200), (10, 200, 60)).save(src)
        monkeypatch.setattr(media, "localize", lambda url: src)
        return storage.create_asset(
            name=name, payload_url=f"/view?filename={name}.png",
            media_type="image")

    async def test_send_with_attachment(self, client, fake_provider,
                                        tmp_path, monkeypatch):
        import base64
        asset = self._make_image_asset(tmp_path, monkeypatch)
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat = (await resp.json())["chat"]
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"text": "what colour?",
                                       "attachments": [{"asset_id": asset["id"]}]})
        assert resp.status == 200
        user_msg = (await resp.json())["user_message"]
        blocks = json.loads(user_msg["content"])
        assert blocks[0]["type"] == "image"
        assert blocks[0]["asset_id"] == asset["id"]
        assert blocks[1] == {"type": "text", "text": "what colour?"}

        await _wait_done(client, chat["id"])
        turn = fake_provider.last_turn
        assert len(turn.attachments) == 1
        att = turn.attachments[0]
        assert att["media_type"] == "image/jpeg"
        raw = base64.b64decode(att["data"])
        assert raw[:2] == b"\xff\xd8"
        assert "asset_refs" in turn.user_text
        assert f"asset #{asset['id']}" in turn.user_text

    async def test_attachment_only_no_text(self, client, fake_provider,
                                           tmp_path, monkeypatch):
        asset = self._make_image_asset(tmp_path, monkeypatch, "solo")
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat = (await resp.json())["chat"]
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"attachments": [{"asset_id": asset["id"]}]})
        assert resp.status == 200
        await _wait_done(client, chat["id"])
        assert "attached image" in fake_provider.last_turn.user_text.lower()

    async def test_attachment_validation(self, client, fake_provider):
        from ComfyTV import storage
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat = (await resp.json())["chat"]
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"text": "x",
                                       "attachments": [{"asset_id": 99999}]})
        assert resp.status == 400
        assert "not found" in (await resp.json())["error"]

        mesh = storage.create_asset(name="m", payload_url="/view?m.glb",
                                    media_type="model")
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"text": "x",
                                       "attachments": [{"asset_id": mesh["id"]}]})
        assert resp.status == 400
        assert "attachable types" in (await resp.json())["error"]

        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"attachments": []})
        assert resp.status == 400


class TestAVAttachments:
    def _make_asset(self, media_type, name="clip"):
        from ComfyTV import storage
        return storage.create_asset(
            name=name, payload_url=f"/view?filename={name}",
            media_type=media_type)

    async def test_video_attachment_frame_and_facts(self, client, fake_provider,
                                                    tmp_path, monkeypatch):
        from PIL import Image
        from ComfyTV.runners import media
        frame = tmp_path / "frame.png"
        Image.new("RGB", (640, 360), (5, 5, 5)).save(frame)
        monkeypatch.setattr(media, "get_video_info", lambda url: {
            "duration": 12.5, "fps": 24.0, "width": 1280, "height": 720,
            "has_audio": True})
        monkeypatch.setattr(media, "extract_frame",
                            lambda url, pos: "/view?frame.png")
        monkeypatch.setattr(media, "localize", lambda url: frame)

        asset = self._make_asset("video", "mv-take")
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat = (await resp.json())["chat"]
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"text": "看看这条",
                                       "attachments": [{"asset_id": asset["id"]}]})
        assert resp.status == 200
        blocks = json.loads((await resp.json())["user_message"]["content"])
        assert blocks[0]["type"] == "video"
        await _wait_done(client, chat["id"])
        turn = fake_provider.last_turn
        assert len(turn.attachments) == 1
        assert "12.50s 1280x720 @24fps with audio" in turn.user_text
        assert "middle frame" in turn.user_text
        assert f"asset #{asset['id']}" in turn.user_text

    async def test_audio_attachment_waveform_and_duration(
            self, client, fake_provider, tmp_path, monkeypatch):
        from PIL import Image
        from ComfyTV.api import bot as bot_api
        from ComfyTV.runners import audio_render, media
        wave = tmp_path / "wave.png"
        Image.new("RGB", (1200, 320), (0, 0, 0)).save(wave)
        monkeypatch.setattr(bot_api, "_audio_duration_s", lambda url: 187.4)
        monkeypatch.setattr(audio_render, "render_waveform_image",
                            lambda url, w, h: "/view?wave.png")
        monkeypatch.setattr(media, "localize", lambda url: wave)

        asset = self._make_asset("audio", "my-song")
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat = (await resp.json())["chat"]
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"attachments": [{"asset_id": asset["id"]}]})
        assert resp.status == 200
        blocks = json.loads((await resp.json())["user_message"]["content"])
        assert blocks[0]["type"] == "audio"
        await _wait_done(client, chat["id"])
        turn = fake_provider.last_turn
        assert len(turn.attachments) == 1
        assert "187.40s" in turn.user_text
        assert "waveform" in turn.user_text

    async def test_audio_degrades_without_waveform(self, client, fake_provider,
                                                   monkeypatch):
        from ComfyTV.api import bot as bot_api
        from ComfyTV.runners import audio_render

        def boom(url, w, h):
            raise RuntimeError("no decoder")

        monkeypatch.setattr(bot_api, "_audio_duration_s", lambda url: None)
        monkeypatch.setattr(audio_render, "render_waveform_image", boom)
        asset = self._make_asset("audio", "raw")
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat = (await resp.json())["chat"]
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"attachments": [{"asset_id": asset["id"]}]})
        assert resp.status == 200
        await _wait_done(client, chat["id"])
        turn = fake_provider.last_turn
        assert turn.attachments == []
        assert f"asset #{asset['id']}" in turn.user_text

    async def test_model_asset_rejected(self, client, fake_provider):
        asset = self._make_asset("model", "mesh")
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat = (await resp.json())["chat"]
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"text": "x",
                                       "attachments": [{"asset_id": asset["id"]}]})
        assert resp.status == 400
        assert "attachable types" in (await resp.json())["error"]


class NoAttachProvider(FakeProvider):
    id = "fake-noattach"
    label = "FakeNoAttach"

    def capabilities(self):
        return ProviderCaps(stateful=True, tools="mcp", attachments=False)


class TestAttachmentCapability:
    async def test_status_exposes_attachments_cap(self, client, fake_provider):
        register_provider(NoAttachProvider())
        resp = await client.get("/comfytv/bot/status")
        entries = {p["id"]: p for p in (await resp.json())["providers"]}
        assert entries["fake-test"]["attachments"] is True
        assert entries["fake-noattach"]["attachments"] is False

    async def test_send_rejects_attachments_for_incapable_provider(
            self, client, fake_provider):
        from ComfyTV import storage
        register_provider(NoAttachProvider())
        asset = storage.create_asset(name="i", payload_url="/view?i.png",
                                     media_type="image")
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-noattach"})
        chat = (await resp.json())["chat"]
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"text": "look",
                                       "attachments": [{"asset_id": asset["id"]}]})
        assert resp.status == 400
        assert "does not support attachments" in (await resp.json())["error"]


class TestSendWithSkill:
    @pytest.fixture()
    def skill_dirs(self, tmp_path, monkeypatch):
        from ComfyTV import skill_store
        builtin = tmp_path / "builtin-skills"
        user = tmp_path / "user-skills"
        builtin.mkdir()
        user.mkdir()
        monkeypatch.setattr(skill_store, "BUILTIN_SKILLS_DIR", builtin)
        monkeypatch.setattr(skill_store, "user_skills_dir", lambda: user)
        return builtin, user

    async def test_send_with_skill_prepends_directive(
            self, client, fake_provider, skill_dirs):
        from test_skill_store import make_skill
        builtin, _ = skill_dirs
        make_skill(builtin, "trailer-cutter")
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat = (await resp.json())["chat"]
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"text": "cut a trailer",
                                       "skill": "trailer-cutter"})
        assert resp.status == 200
        user_msg = (await resp.json())["user_message"]
        blocks = json.loads(user_msg["content"])
        assert blocks[0] == {"type": "skill", "name": "trailer-cutter"}
        assert blocks[1] == {"type": "text", "text": "cut a trailer"}

        await _wait_done(client, chat["id"])
        sent = fake_provider.last_turn.user_text
        assert sent.startswith("Use the ComfyTV skill 'trailer-cutter'")
        assert "action='read'" in sent
        assert sent.endswith("cut a trailer")

    async def test_send_with_unknown_or_disabled_skill(
            self, client, fake_provider, skill_dirs):
        from ComfyTV import skill_store
        from test_skill_store import make_skill
        builtin, _ = skill_dirs
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat = (await resp.json())["chat"]
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"text": "x", "skill": "ghost"})
        assert resp.status == 400
        make_skill(builtin, "off-skill")
        skill_store.set_skill_enabled("off-skill", False)
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"text": "x", "skill": "off-skill"})
        assert resp.status == 400
