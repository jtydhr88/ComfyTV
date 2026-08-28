import asyncio
import json

import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

from ComfyTV.api import bot_asks


SPEC_ARGS = {
    "prompt": "Pick a direction",
    "options": [
        {"id": "a", "label": "Option A"},
        {"id": "b", "label": "Option B", "description": "the safe one"},
    ],
}


class TestValidateSpec:
    def test_happy_path_defaults(self):
        spec = bot_asks.validate_spec(SPEC_ARGS)
        assert spec["min_selections"] == 1
        assert spec["max_selections"] == 1
        assert spec["allow_other"] is False
        assert [o["id"] for o in spec["options"]] == ["a", "b"]

    def test_rejects_bad_input(self):
        with pytest.raises(ValueError, match="prompt"):
            bot_asks.validate_spec({"options": SPEC_ARGS["options"]})
        with pytest.raises(ValueError, match="options"):
            bot_asks.validate_spec({"prompt": "x", "options": [{"id": "a", "label": "A"}]})
        with pytest.raises(ValueError, match="duplicate"):
            bot_asks.validate_spec({"prompt": "x", "options": [
                {"id": "a", "label": "A"}, {"id": "a", "label": "B"}]})
        with pytest.raises(ValueError, match="min/max"):
            bot_asks.validate_spec({**SPEC_ARGS, "min_selections": 3})


class TestValidateAnswer:
    def test_bounds_and_ids(self):
        spec = bot_asks.validate_spec(SPEC_ARGS)
        bot_asks.validate_answer(spec, ["a"], "")
        with pytest.raises(ValueError, match="unknown"):
            bot_asks.validate_answer(spec, ["zzz"], "")
        with pytest.raises(ValueError, match="at most"):
            bot_asks.validate_answer(spec, ["a", "b"], "")
        with pytest.raises(ValueError, match="at least"):
            bot_asks.validate_answer(spec, [], "")
        with pytest.raises(ValueError, match="not allowed"):
            bot_asks.validate_answer(spec, ["a"], "custom")

    def test_other_text_substitutes_selection(self):
        spec = bot_asks.validate_spec({**SPEC_ARGS, "allow_other": True})
        bot_asks.validate_answer(spec, [], "my own words")


class TestPendingLifecycle:
    async def test_answer_resolves_future_once(self):
        spec = bot_asks.validate_spec(SPEC_ARGS)
        ask = bot_asks.create_ask("c1", "m1", spec)
        resolved = bot_asks.resolve_ask(ask.id, "answered", ["a"], "")
        assert resolved is ask
        assert await ask.future == {"status": "answered", "selected": ["a"]}
        assert bot_asks.resolve_ask(ask.id, "answered", ["b"], "") is None

    async def test_cancel_chat_asks(self):
        spec = bot_asks.validate_spec(SPEC_ARGS)
        a1 = bot_asks.create_ask("c1", "m1", spec)
        a2 = bot_asks.create_ask("c2", "m2", spec)
        cancelled = bot_asks.cancel_chat_asks("c1")
        assert [a.id for a in cancelled] == [a1.id]
        assert (await a1.future)["status"] == "cancelled"
        assert a2.id in bot_asks.PENDING
        bot_asks.resolve_ask(a2.id, "cancelled")


@pytest.fixture()
def turn_context(reset_db, monkeypatch):
    from ComfyTV import storage
    from ComfyTV.api import bot as bot_api
    from ComfyTV.api.mcp import BOT_CHAT_ID
    from ComfyTV.bot.providers import TurnHandle

    storage.set_settings({"enable-mcp": True, "enable-bot": True,
                          "bot-always-allow-runs": False})
    chat = storage.create_bot_chat(provider="claude-code")
    msg = storage.create_bot_message(
        chat_id=chat["id"], role="assistant", status="streaming")
    state = bot_api._TurnState(TurnHandle(), msg["id"])
    bot_api.ACTIVE_TURNS[chat["id"]] = state

    broadcasts: list[tuple[str, dict]] = []
    monkeypatch.setattr(bot_api.bot_turns, "_broadcast",
                        lambda ev, payload: broadcasts.append((ev, payload)))
    token = BOT_CHAT_ID.set(chat["id"])
    yield {"chat": chat, "message": msg, "state": state,
           "broadcasts": broadcasts}
    BOT_CHAT_ID.reset(token)
    bot_api.ACTIVE_TURNS.pop(chat["id"], None)
    for ask in list(bot_asks.PENDING.values()):
        bot_asks.resolve_ask(ask.id, "cancelled")


class TestAskUserTool:
    async def test_requires_bot_context(self, reset_db):
        from ComfyTV.api.mcp_tools import _ask_user
        with pytest.raises(ValueError, match="bot chats"):
            await _ask_user(dict(SPEC_ARGS))

    async def test_full_answer_flow(self, turn_context):
        from ComfyTV import storage
        from ComfyTV.api.mcp_tools import _ask_user

        task = asyncio.ensure_future(_ask_user(dict(SPEC_ARGS)))
        await asyncio.sleep(0.05)
        ask_id = next(iter(bot_asks.PENDING))
        events = [ev for ev, _ in turn_context["broadcasts"]]
        assert "turn_ask" in events

        bot_asks.resolve_ask(ask_id, "answered", ["b"], "")
        result = await task
        assert result == {"status": "answered", "selected": ["b"],
                          "other_text": ""}
        events = [ev for ev, _ in turn_context["broadcasts"]]
        assert "turn_ask_resolved" in events

        rows = storage.list_bot_messages(turn_context["chat"]["id"])
        blocks = json.loads(rows[0]["content"])
        assert blocks[-1]["type"] == "ask"
        assert blocks[-1]["status"] == "answered"
        assert blocks[-1]["selected"] == ["b"]

    async def test_expiry(self, turn_context, monkeypatch):
        from ComfyTV.api.mcp_tools import _ask_user
        monkeypatch.setattr(bot_asks, "ASK_TIMEOUT_S", 0.05)
        result = await _ask_user(dict(SPEC_ARGS))
        assert result["status"] == "expired"


class TestRememberTool:
    async def test_requires_bot_context(self, reset_db):
        from ComfyTV.api.mcp_tools import _remember
        with pytest.raises(ValueError, match="bot chats"):
            await _remember({"note": "always 16:9"})

    async def test_add_dedupe_and_clear(self, turn_context):
        from ComfyTV import storage
        from ComfyTV.api.mcp_tools import _remember

        out = await _remember({"note": "always 16:9"})
        assert out["prefs"] == ["always 16:9"]
        out = await _remember({"note": "always 16:9"})
        assert out["prefs"] == ["always 16:9"]
        out = await _remember({"note": "prefer minimax for video"})
        assert out["prefs"] == ["always 16:9", "prefer minimax for video"]
        chat = storage.get_bot_chat(turn_context["chat"]["id"])
        assert chat["prefs"] == ["always 16:9", "prefer minimax for video"]
        out = await _remember({"action": "clear"})
        assert out["prefs"] == []

    async def test_prefs_are_injected_into_the_next_turn(self, turn_context):
        from ComfyTV import storage
        from ComfyTV.api import bot as bot_api
        from ComfyTV.bot.providers import (
            ProviderCaps, ProviderStatus, TurnResult,
        )
        from ComfyTV.bot.providers import AgentProvider, register_provider

        chat = turn_context["chat"]
        storage.update_bot_chat(chat["id"], prefs=["always 16:9"])
        bot_api.ACTIVE_TURNS.pop(chat["id"], None)

        seen = {}

        class _Probe(AgentProvider):
            id = "claude-code"
            label = "probe"

            async def probe(self):
                return ProviderStatus(available=True)

            def capabilities(self):
                return ProviderCaps(stateful=True)

            async def send(self, turn, emit, handle):
                seen["text"] = turn.user_text
                return TurnResult()

            async def stop(self, handle):
                pass

        register_provider(_Probe())
        from aiohttp import web
        from aiohttp.test_utils import TestClient, TestServer
        from ComfyTV import api  # noqa: F401
        import server
        app = web.Application()
        app.router.add_routes(server.PromptServer.instance.routes)
        client = TestClient(TestServer(app))
        await client.start_server()
        try:
            resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                     json={"text": "make a shot"})
            assert resp.status == 200
            for _ in range(100):
                if "text" in seen:
                    break
                await asyncio.sleep(0.02)
        finally:
            await client.close()
        assert "Saved chat preferences" in seen["text"]
        assert "- always 16:9" in seen["text"]


class TestRunApprovalGate:
    async def test_auto_mode_skips_gate(self, turn_context, monkeypatch):
        from ComfyTV.api import mcp_tools
        calls = []

        async def fake_submit(name, payload, timeout=60.0):
            calls.append(name)
            return {"started": True, "uid": "s1"}

        monkeypatch.setattr(mcp_tools._shared, "submit_command", fake_submit)
        result = await mcp_tools._run_stage({"node": "s1"})
        assert result.get("started") is True
        assert calls == ["run_stage"]

    async def test_ask_mode_cancel_blocks_run(self, turn_context, monkeypatch):
        from ComfyTV import storage
        from ComfyTV.api import mcp_tools

        storage.update_bot_chat(turn_context["chat"]["id"], run_mode="ask")
        calls = []

        async def fake_submit(name, payload, timeout=60.0):
            calls.append(name)
            return {"started": True}

        monkeypatch.setattr(mcp_tools._shared, "submit_command", fake_submit)
        task = asyncio.ensure_future(mcp_tools._run_stage({"node": "s1"}))
        await asyncio.sleep(0.05)
        ask_id = next(iter(bot_asks.PENDING))
        bot_asks.resolve_ask(ask_id, "answered", ["cancel"], "")
        result = await task
        assert result["cancelled"] is True
        assert calls == []

    async def test_ask_mode_run_proceeds(self, turn_context, monkeypatch):
        from ComfyTV import storage
        from ComfyTV.api import mcp_tools

        storage.update_bot_chat(turn_context["chat"]["id"], run_mode="ask")

        async def fake_submit(name, payload, timeout=60.0):
            return {"started": True, "uid": "s1"}

        monkeypatch.setattr(mcp_tools._shared, "submit_command", fake_submit)
        task = asyncio.ensure_future(mcp_tools._run_stage({"node": "s1"}))
        await asyncio.sleep(0.05)
        ask_id = next(iter(bot_asks.PENDING))
        bot_asks.resolve_ask(ask_id, "answered", ["run"], "")
        result = await task
        assert result.get("started") is True
        assert storage.get_bot_chat(
            turn_context["chat"]["id"])["run_mode"] == "ask"

    async def test_always_allow_setting_skips_gate(
            self, turn_context, monkeypatch):
        from ComfyTV import storage
        from ComfyTV.api import mcp_tools

        chat_id = turn_context["chat"]["id"]
        storage.update_bot_chat(chat_id, run_mode="ask")
        storage.set_settings({"enable-mcp": True, "enable-bot": True,
                              "bot-always-allow-runs": True})

        async def fake_submit(name, payload, timeout=60.0):
            return {"started": True, "uid": "s1"}

        monkeypatch.setattr(mcp_tools._shared, "submit_command", fake_submit)
        result = await mcp_tools._run_stage({"node": "s1"})
        assert result.get("started") is True
        assert not bot_asks.PENDING

    async def test_always_runs_and_flips_chat_to_auto(
            self, turn_context, monkeypatch):
        from ComfyTV import storage
        from ComfyTV.api import mcp_tools

        chat_id = turn_context["chat"]["id"]
        storage.update_bot_chat(chat_id, run_mode="ask")

        async def fake_submit(name, payload, timeout=60.0):
            return {"started": True, "uid": "s1"}

        monkeypatch.setattr(mcp_tools._shared, "submit_command", fake_submit)
        task = asyncio.ensure_future(mcp_tools._run_stage({"node": "s1"}))
        await asyncio.sleep(0.05)
        ask_id = next(iter(bot_asks.PENDING))
        ask = bot_asks.PENDING[ask_id]
        assert [o["id"] for o in ask.spec["options"]] == \
            ["run", "always", "cancel"]
        bot_asks.resolve_ask(ask_id, "answered", ["always"], "")
        result = await task
        assert result.get("started") is True
        assert storage.get_bot_chat(chat_id)["run_mode"] == "auto"

        second = await mcp_tools._run_stage({"node": "s1"})
        assert second.get("started") is True
        assert not bot_asks.PENDING


@pytest.fixture()
async def client(reset_db):
    from ComfyTV import storage as _storage
    _storage.set_settings({"enable-mcp": True, "enable-bot": True})
    from ComfyTV import api  # noqa: F401
    import server
    app = web.Application()
    app.router.add_routes(server.PromptServer.instance.routes)
    test_server = TestServer(app)
    test_client = TestClient(test_server)
    await test_client.start_server()
    yield test_client
    await test_client.close()


class TestAnswerEndpoint:
    async def test_answer_unknown_ask_409(self, client):
        from ComfyTV import storage
        chat = storage.create_bot_chat(provider="claude-code")
        resp = await client.post(
            f"/comfytv/bot/chats/{chat['id']}/asks/nope/answer",
            json={"selected": ["a"]})
        assert resp.status == 409

    async def test_answer_validates_and_resolves(self, client):
        from ComfyTV import storage
        chat = storage.create_bot_chat(provider="claude-code")
        spec = bot_asks.validate_spec(SPEC_ARGS)
        ask = bot_asks.create_ask(chat["id"], "m1", spec)

        bad = await client.post(
            f"/comfytv/bot/chats/{chat['id']}/asks/{ask.id}/answer",
            json={"selected": ["zzz"]})
        assert bad.status == 422

        ok = await client.post(
            f"/comfytv/bot/chats/{chat['id']}/asks/{ask.id}/answer",
            json={"selected": ["a"]})
        assert ok.status == 202
        assert (await ask.future)["selected"] == ["a"]

        again = await client.post(
            f"/comfytv/bot/chats/{chat['id']}/asks/{ask.id}/answer",
            json={"selected": ["b"]})
        assert again.status == 409

    async def test_run_mode_patch(self, client):
        from ComfyTV import storage
        chat = storage.create_bot_chat(provider="claude-code")
        resp = await client.patch(f"/comfytv/bot/chats/{chat['id']}",
                                  json={"run_mode": "ask"})
        assert resp.status == 200
        assert (await resp.json())["chat"]["run_mode"] == "ask"
        bad = await client.patch(f"/comfytv/bot/chats/{chat['id']}",
                                 json={"run_mode": "yolo"})
        assert bad.status == 400
