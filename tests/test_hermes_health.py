"""Layered health with local fake brokers; never probe real providers."""

import json

import pytest
from aiohttp import web
from aiohttp.test_utils import TestServer
from ComfyTV import storage
from ComfyTV.bot.hermes import HermesProvider
from test_bot_hermes import contract  # noqa: F401 -- shared pytest fixture


async def test_old_broker_explicit_unknown_diagnostics(contract):  # noqa: F811
    status = await HermesProvider().probe()
    assert status.available and status.logged_in
    assert getattr(status, "health", None) is not None
    assert status.health["api"]["broker_auth"] is True
    assert status.health["api"]["upstream_auth"] is None
    assert status.health["inference"]["state"] == "not_tested"
    assert "diagnostics_unsupported" in [e["code"] for e in status.health["errors"]]
    assert [c[1] for c in contract["calls"]] == [
        "/v1/comfytv/health",
        "/v1/capabilities",
    ]


@pytest.fixture
async def health_contract(monkeypatch):
    from ComfyTV.bot.hermes_health import empty

    data = empty("canvas", "pinned")
    data["checked_at"] = "2026-10-03T00:00:00Z"
    data["api"] = dict.fromkeys(
        ("broker_auth", "upstream_reachable", "upstream_auth", "contract"), True
    )
    state = {
        "data": data,
        "calls": [],
        "settings": {
            "bot-hermes-mcp-server": "canvas",
            "bot-model-hermes": "",
            "bot-hermes-image-attachments": False,
        },
    }

    async def route(request):
        state["calls"].append((request.method, request.path))
        return web.json_response(state["data"], status=state.get("status", 200))

    app = web.Application()
    app.router.add_route("*", "/{tail:.*}", route)
    async with TestServer(app) as server:
        state["settings"]["bot-hermes-url"] = str(server.make_url("/")).rstrip("/")
        monkeypatch.setattr(
            storage, "get_setting", lambda key: state["settings"].get(key)
        )
        monkeypatch.setenv("COMFYTV_HERMES_API_KEY", "test-only-secret")
        yield state


async def test_new_health_projects_schema_saved_binding_gate_model(health_contract):
    state = health_contract
    state["data"]["secret"] = "test-only-secret"
    state["data"]["model"]["secret"] = "test-only-secret"
    p = HermesProvider()
    status = await p.probe()
    assert status.available and status.logged_in
    assert status.health["model"]["selection_mode"] == "broker_override"
    assert status.health["media"]["image"]["gate_enabled"] is False
    assert "image_gate_disabled" in [e["code"] for e in status.health["errors"]]
    assert "test-only-secret" not in json.dumps(status.health)
    assert state["calls"] == [("GET", "/v1/comfytv/health")]
    state["settings"]["bot-hermes-mcp-server"] = "other"
    state["settings"]["bot-model-hermes"] = "not-authorized"
    status = await p.probe()
    assert not status.available
    assert {"mcp_binding_mismatch", "model_override_not_authorized"} <= {
        e["code"] for e in status.health["errors"]
    }


async def test_preflight_uses_known_saved_policy_without_network(health_contract):
    p = HermesProvider()
    await p.probe()
    with pytest.raises(ValueError, match="model"):
        p.preflight_input("text", "unauthorized")
    assert p.preflight_input("text", "")
    assert len(health_contract["calls"]) == 1


@pytest.mark.parametrize(
    "kind", ["auth", "down", "bad_schema", "secret", "bad_contract"]
)
async def test_unverified_broker_never_green_and_fixed_diagnostics(
    health_contract, kind
):
    state = health_contract
    if kind == "auth":
        state["status"] = 401
    if kind == "down":
        state["status"] = 503
    if kind == "bad_schema":
        state["data"]["limits"]["work"] = True
    if kind == "secret":
        state["data"]["model"]["authorized_override"] = "test-only-secret"
    if kind == "bad_contract":
        state["data"]["api"]["contract"] = False
    status = await HermesProvider().probe()
    assert not status.available
    assert status.health is not None
    assert "test-only-secret" not in json.dumps(status.health)
    assert len(state["calls"]) == 1


async def test_dedicated_endpoint_disabled_no_other_provider_probe(
    bot_client, monkeypatch
):
    from ComfyTV.api import bot as api
    from ComfyTV.bot.hermes_health import empty
    from ComfyTV.bot.providers import ProviderCaps, ProviderStatus

    class Selected:
        id = "hermes"
        label = "Hermes"
        calls = 0

        async def probe(self):
            self.calls += 1
            return ProviderStatus(True, logged_in=True, health=empty("canvas"))

        def capabilities(self):
            return ProviderCaps()

        async def list_models(self):
            return []

        def model_options(self):
            return []

    selected = Selected()
    monkeypatch.setattr(
        api, "get_provider", lambda name: selected if name == "hermes" else None
    )
    monkeypatch.setattr(
        api,
        "list_providers",
        lambda: (_ for _ in ()).throw(AssertionError("other providers accessed")),
    )
    async with bot_client.get("/comfytv/bot/providers/hermes/health") as r:
        assert r.status == 200
        body = await r.json()
        assert body["provider"]["health"]["schema_version"] == 1
        assert r.headers["Cache-Control"] == "no-store"
    assert selected.calls == 1
    monkeypatch.setattr(api, "bot_enabled", lambda: False)
    async with bot_client.get("/comfytv/bot/providers/hermes/health") as r:
        assert await r.json() == {"enabled": False, "provider": None}
    assert selected.calls == 1


async def test_all_provider_status_isolates_exception_and_preserves_optional_health(
    bot_client, fake_provider, monkeypatch, caplog
):
    from ComfyTV.api import bot as api
    from ComfyTV.bot.hermes_health import empty
    from ComfyTV.bot.providers import ProviderStatus

    class Broken:
        id = "broken"
        label = "Broken"

        async def probe(self):
            raise RuntimeError("credential-canary")

    async def probe():
        return ProviderStatus(True, health=empty("canvas"))

    monkeypatch.setattr(fake_provider, "probe", probe)
    monkeypatch.setattr(api, "list_providers", lambda: [Broken(), fake_provider])
    async with bot_client.get("/comfytv/bot/status") as r:
        assert r.status == 200
        body = await r.json()
    assert len(body["providers"]) == 2
    assert body["providers"][0]["available"] is False
    assert body["providers"][1]["health"]["schema_version"] == 1
    assert "health" not in body["providers"][0]
    assert "credential-canary" not in json.dumps(body) + caplog.text


async def test_unknown_upstream_auth_stays_unknown(health_contract):
    health_contract["data"]["api"]["upstream_auth"] = None
    status = await HermesProvider().probe()
    assert status.logged_in is None
    assert not status.available


async def test_late_probe_cannot_install_policy_for_changed_configuration(
    health_contract, monkeypatch
):
    from ComfyTV.bot import hermes_health

    original = hermes_health.validate

    def changing(raw, key):
        health_contract["settings"]["bot-hermes-url"] = "http://127.0.0.1:1"
        return original(raw, key)

    monkeypatch.setattr(hermes_health, "validate", changing)
    p = HermesProvider()
    status = await p.probe()
    assert not status.available
    assert getattr(p, "_health_policy", None) is None


async def test_failed_probe_retains_local_image_gate(health_contract):
    health_contract["settings"]["bot-hermes-image-attachments"] = True
    health_contract["status"] = 401
    status = await HermesProvider().probe()
    assert status.health["media"]["image"]["gate_enabled"] is True


async def test_old_broker_does_not_invent_model_denial(contract):  # noqa: F811
    contract["settings"]["bot-model-hermes"] = "admin-may-authorize"
    status = await HermesProvider().probe()
    assert status.available
    assert "model_override_not_authorized" not in {
        e["code"] for e in status.health["errors"]
    }


async def test_local_server_name_cannot_reflect_broker_credential(health_contract):
    health_contract["settings"]["bot-hermes-mcp-server"] = "test-only-secret"
    health_contract["data"]["mcp"]["server"] = "test-only-secret"
    status = await HermesProvider().probe()
    assert "test-only-secret" not in json.dumps(status.health)
