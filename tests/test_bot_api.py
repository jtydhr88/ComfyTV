from __future__ import annotations

import asyncio
import json

import pytest

from conftest import wait_bot_done as _wait_done
from ComfyTV.bot.providers import BotEvent, TurnRequest, TurnResult

@pytest.fixture()
def client(bot_client):
    return bot_client


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
        from ComfyTV.api import bot_media
        broadcasts: list[tuple[str, dict]] = []
        monkeypatch.setattr(
            bot_api.bot_turns, "_broadcast",
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

