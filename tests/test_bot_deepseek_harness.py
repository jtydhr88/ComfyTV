from __future__ import annotations

import json

from ComfyTV.bot.providers import (
    AgentProvider,
    BotEvent,
    ProviderCaps,
    ProviderStatus,
    TurnResult,
    register_provider,
)
from conftest import wait_bot_done as _wait_done

ACCOUNT_PRO = '["deepseek-account","deepseek-v4-pro"]'


class _ModelOptionsProvider(AgentProvider):
    id = "fake-model-options"
    label = "Fake Models"

    async def probe(self) -> ProviderStatus:
        return ProviderStatus(available=True, version="1.2.3")

    def capabilities(self) -> ProviderCaps:
        return ProviderCaps(stateful=True, tools="mcp")

    def model_options(self) -> list[dict]:
        return [{"value": ACCOUNT_PRO, "label": "DeepSeek-V4-Pro", "group": "deepseek-account"}]

    async def send(self, turn, emit, handle) -> TurnResult:
        return TurnResult()

    async def stop(self, handle) -> None:
        handle.stop_requested = True


class _SessionEventProvider(AgentProvider):
    id = "fake-session-event"
    label = "Session Event Fake"

    async def probe(self) -> ProviderStatus:
        return ProviderStatus(available=True, version="1")

    def capabilities(self) -> ProviderCaps:
        return ProviderCaps(stateful=True, tools="mcp")

    async def send(self, turn, emit, handle) -> TurnResult:
        await emit(BotEvent(t="session", id="sess-internal"))
        await emit(BotEvent(t="delta", text="done"))
        return TurnResult()

    async def stop(self, handle) -> None:
        handle.stop_requested = True


class TestApi:
    async def test_status_publishes_model_options(self, bot_client):
        register_provider(_ModelOptionsProvider())
        data = await (await bot_client.get("/comfytv/bot/status")).json()
        entry = next(p for p in data["providers"] if p["id"] == "fake-model-options")
        assert entry["model_options"] == [
            {"value": ACCOUNT_PRO, "label": "DeepSeek-V4-Pro", "group": "deepseek-account"}]
        assert entry["models"] == []

    async def test_status_omits_model_options_for_plain_providers(self, bot_client, fake_provider):
        data = await (await bot_client.get("/comfytv/bot/status")).json()
        entry = next(p for p in data["providers"] if p["id"] == "fake-test")
        assert "model_options" not in entry

    async def test_branch_is_refused_for_the_harness_provider(self, bot_client):
        from ComfyTV import storage

        chat = (await (await bot_client.post("/comfytv/bot/chats",
                                             json={"provider": "deepseek-harness"})).json())["chat"]
        message = storage.create_bot_message(chat_id=chat["id"], role="assistant",
                                             content="[]", status="done")
        resp = await bot_client.post(f"/comfytv/bot/chats/{chat['id']}/branch",
                                     json={"message_id": message["id"]})
        assert resp.status == 400
        assert "cannot be branched" in (await resp.json())["error"]

    async def test_branch_still_works_for_other_providers(self, bot_client, fake_provider):
        chat = (await (await bot_client.post("/comfytv/bot/chats",
                                             json={"provider": "fake-test"})).json())["chat"]
        await bot_client.post(f"/comfytv/bot/chats/{chat['id']}/send", json={"text": "one"})
        data = await _wait_done(bot_client, chat["id"])
        assistant_id = next(m["id"] for m in data["messages"] if m["role"] == "assistant")
        resp = await bot_client.post(f"/comfytv/bot/chats/{chat['id']}/branch",
                                     json={"message_id": assistant_id})
        assert resp.status == 200

    async def test_session_event_is_persisted_and_not_streamed(self, bot_client):
        register_provider(_SessionEventProvider())
        chat = (await (await bot_client.post("/comfytv/bot/chats",
                                             json={"provider": "fake-session-event"})).json())["chat"]
        await bot_client.post(f"/comfytv/bot/chats/{chat['id']}/send", json={"text": "hi"})
        data = await _wait_done(bot_client, chat["id"])
        assert data["chat"]["resume_token"] == "sess-internal"
        assistant = next(m for m in data["messages"] if m["role"] == "assistant")
        assert assistant["resume_token_after"] == "sess-internal"
        assert "sess-internal" not in json.dumps(assistant["content"])
