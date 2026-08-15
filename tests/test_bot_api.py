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


@pytest.fixture()
def fake_provider():
    provider = FakeProvider()
    register_provider(provider)
    return provider


@pytest.fixture()
async def client(reset_db):
    from ComfyTV import storage as _storage
    _storage.set_settings({"enable-mcp": True, "enable-bot": True})
    from ComfyTV import api  # noqa: F401
    from ComfyTV.api.bot import ACTIVE_TURNS
    import server
    ACTIVE_TURNS.clear()
    app = web.Application()
    app.router.add_routes(server.PromptServer.instance.routes)
    test_server = TestServer(app)
    test_client = TestClient(test_server)
    await test_client.start_server()
    yield test_client
    ACTIVE_TURNS.clear()
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
        assert fake_provider.last_turn.mcp_endpoint.endswith("/comfytv/mcp")

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

    async def test_busy_chat_rejects_send(self, client, fake_provider):
        fake_provider.gate = asyncio.Event()
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat = (await resp.json())["chat"]
        await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                          json={"text": "first"})
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"text": "second"})
        assert resp.status == 409
        fake_provider.gate.set()
        await _wait_done(client, chat["id"])

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

        vid = storage.create_asset(name="v", payload_url="/view?v.mp4",
                                   media_type="video")
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"text": "x",
                                       "attachments": [{"asset_id": vid["id"]}]})
        assert resp.status == 400
        assert "only images" in (await resp.json())["error"]

        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"attachments": []})
        assert resp.status == 400
