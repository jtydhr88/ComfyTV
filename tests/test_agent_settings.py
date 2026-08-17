from __future__ import annotations

import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer


@pytest.fixture()
async def client(reset_db):
    from ComfyTV import api  # noqa: F401
    import server
    app = web.Application()
    app.router.add_routes(server.PromptServer.instance.routes)
    test_server = TestServer(app)
    test_client = TestClient(test_server)
    await test_client.start_server()
    yield test_client
    await test_client.close()


def _enable(**flags):
    from ComfyTV import storage
    storage.set_settings(flags)


class TestDefaults:
    def test_specs_default_off(self, reset_db):
        from ComfyTV import storage
        assert storage.get_setting("enable-mcp") is False
        assert storage.get_setting("enable-bot") is False

    def test_model_overrides_default_blank(self, reset_db):
        from ComfyTV import storage
        for key in ("bot-model-claude-code", "bot-model-codex",
                    "bot-model-qwen-code", "bot-model-local-llm",
                    "bot-local-llm-url"):
            assert storage.get_setting(key) == ""


class TestBotModelSetting:
    async def test_save_and_readback(self, client):
        resp = await client.put("/comfytv/settings", json={
            "values": {"bot-model-claude-code": "sonnet"}})
        assert resp.status == 200
        rows = {r["key"]: r["value"] for r in (await resp.json())["settings"]}
        assert rows["bot-model-claude-code"] == "sonnet"


class TestMcpGate:
    async def test_disabled_by_default(self, client):
        resp = await client.post("/comfytv/mcp", json={
            "jsonrpc": "2.0", "id": 1, "method": "ping"})
        assert resp.status == 403
        body = await resp.json()
        assert "disabled" in body["error"]["message"]

    async def test_enabled_allows(self, client):
        _enable(**{"enable-mcp": True})
        resp = await client.post("/comfytv/mcp", json={
            "jsonrpc": "2.0", "id": 1, "method": "ping"})
        assert resp.status == 200
        assert (await resp.json())["result"] == {}


class TestBotGate:
    async def test_status_reports_disabled(self, client):
        resp = await client.get("/comfytv/bot/status")
        data = await resp.json()
        assert data == {"enabled": False, "providers": []}

    async def test_chats_blocked_when_disabled(self, client):
        assert (await client.get("/comfytv/bot/chats")).status == 403
        assert (await client.post("/comfytv/bot/chats", json={})).status == 403

    async def test_bot_needs_mcp_too(self, client):
        from ComfyTV import storage
        from ComfyTV.api.bot import bot_enabled
        storage.set_settings({"enable-bot": True})
        assert bot_enabled() is False
        storage.set_settings({"enable-mcp": True})
        assert bot_enabled() is True

    async def test_enabled_status_lists_providers(self, client):
        _enable(**{"enable-mcp": True, "enable-bot": True})
        resp = await client.get("/comfytv/bot/status")
        data = await resp.json()
        assert data["enabled"] is True
        assert isinstance(data["providers"], list)


class TestSettingsDependency:
    async def test_bot_on_requires_mcp(self, client):
        resp = await client.put("/comfytv/settings", json={
            "values": {"enable-bot": True}})
        assert resp.status == 400
        assert "enable-mcp" in (await resp.json())["error"]

    async def test_bot_on_with_mcp_same_call(self, client):
        resp = await client.put("/comfytv/settings", json={
            "values": {"enable-mcp": True, "enable-bot": True}})
        assert resp.status == 200
        rows = {r["key"]: r["value"] for r in (await resp.json())["settings"]}
        assert rows["enable-mcp"] is True
        assert rows["enable-bot"] is True

    async def test_disabling_mcp_cascades_bot_off(self, client):
        await client.put("/comfytv/settings", json={
            "values": {"enable-mcp": True, "enable-bot": True}})
        resp = await client.put("/comfytv/settings", json={
            "values": {"enable-mcp": False}})
        assert resp.status == 200
        rows = {r["key"]: r["value"] for r in (await resp.json())["settings"]}
        assert rows["enable-mcp"] is False
        assert rows["enable-bot"] is False
