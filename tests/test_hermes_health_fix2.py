"""R2-L1: validate bounded diagnostics on the actual final TV HTTP projection."""
import copy
import json
import os
from pathlib import Path

import pytest
from ComfyTV.bot.hermes import HermesProvider
from ComfyTV.bot import hermes_health as health
from test_hermes_health import health_contract  # noqa: F401
from test_bot_hermes import contract  # noqa: F401

LOCAL = [
    health.diagnostic("mcp_binding_mismatch", "mcp", "check_mcp_config"),
    health.diagnostic("model_override_not_authorized", "model", "check_model_policy"),
    health.diagnostic("image_gate_disabled", "media", "check_media_config"),
]


def upstream_entries():
    # Same code with distinct layer/action/retryability is NOT a duplicate.
    return [health.diagnostic("health_stale", layer, action, retryable)
            for layer in ("api", "gateway")
            for action in health.ACTIONS
            for retryable in (False, True)]


def record(name, body):
    if output := os.environ.get("COMFYTV_FIX2_OUTPUT"):
        path = Path(output)
        path.mkdir(parents=True, exist_ok=True)
        (path / f"{name}.json").write_text(json.dumps(body, indent=2))


@pytest.mark.parametrize("all_local", [False, True], ids=["original33", "all3"])
async def test_final_http_boundary(health_contract, bot_client, monkeypatch, all_local):
    from ComfyTV.api import bot
    state = health_contract
    original = upstream_entries() if all_local else [health.diagnostic("health_stale", "api")] * 32
    state["data"]["errors"] = copy.deepcopy(original)
    if all_local:
        state["settings"]["bot-hermes-mcp-server"] = "other"
        state["settings"]["bot-model-hermes"] = "not-authorized"
    monkeypatch.setattr(bot, "get_provider", lambda name: HermesProvider() if name == "hermes" else None)
    monkeypatch.setattr(bot, "bot_enabled", lambda: True)
    monkeypatch.setattr(bot, "list_providers", lambda: pytest.fail("dedicated route accessed other providers"))
    async with bot_client.get("/comfytv/bot/providers/hermes/health") as response:
        assert response.status == 200
        assert response.headers["Cache-Control"] == "no-store"
        body = await response.json()
    record("all3" if all_local else "original33", body)
    final = body["provider"]["health"]
    assert len(final["errors"]) <= 32
    assert final["errors"] == (LOCAL + original[:29] if all_local else [LOCAL[2], original[0]])
    assert health.validate(final, "test-only-secret") == final
    assert body["provider"]["available"] is (not all_local)
    assert body["provider"]["logged_in"] is True
    assert final["media"]["image"]["gate_enabled"] is False
    assert state["calls"] == [("GET", "/v1/comfytv/health")]


@pytest.mark.parametrize("upstream_status", [200, 401])
async def test_validation_covers_final_augmented_projection(health_contract, monkeypatch, upstream_status):
    health_contract["status"] = upstream_status
    validated = []
    original = health.validate

    def tracking(raw, key):
        validated.append(copy.deepcopy(raw))
        return original(raw, key)

    monkeypatch.setattr(health, "validate", tracking)
    status = await HermesProvider().probe()
    assert validated
    assert validated[-1] == status.health
    assert LOCAL[2] in validated[-1]["errors"]
    if upstream_status == 401:
        assert any(e["code"] == "broker_auth_rejected" for e in validated[-1]["errors"])


async def test_invalid_local_augmentation_fails_closed(health_contract, monkeypatch):
    original = health.local_policy
    calls = 0

    def poisoned(data, *args):
        nonlocal calls
        mismatch = original(data, *args)
        calls += 1
        if calls == 1:
            data["age_ms"] = -1
        return mismatch

    monkeypatch.setattr(health, "local_policy", poisoned)
    status = await HermesProvider().probe()
    assert status.available is False
    assert status.health["age_ms"] == 0
    assert any(e["code"] == "upstream_contract_invalid" for e in status.health["errors"])


def test_exact_duplicates_collapse_without_losing_diagnostic_distinctions():
    data = health.empty("canvas", "pinned")
    variants = [
        health.diagnostic("mcp_binding_mismatch", "mcp", "none"),
        health.diagnostic("mcp_binding_mismatch", "api", "check_mcp_config"),
        health.diagnostic("mcp_binding_mismatch", "mcp", "check_mcp_config", True),
    ]
    data["errors"] = [LOCAL[0], LOCAL[0], *variants, variants[0], LOCAL[2]]
    assert health.local_policy(data, "other", "other-model", False) is True
    assert data["errors"] == LOCAL + variants


def test_repeated_local_policy_is_bounded_deterministic_and_idempotent():
    data = health.empty("canvas", "pinned")
    data["errors"] = upstream_entries()
    assert health.local_policy(data, "other", "other-model", False) is True
    first = copy.deepcopy(data)
    for _ in range(3):
        assert health.local_policy(data, "other", "other-model", False) is True
        assert data == first
    assert data["errors"] == LOCAL + upstream_entries()[:29]


@pytest.mark.parametrize("binding", [False, True])
@pytest.mark.parametrize("model", [False, True])
@pytest.mark.parametrize("gate", [False, True])
def test_mismatch_boolean_and_gate_semantics_unchanged(binding, model, gate):
    data = health.empty("canvas", "pinned")
    result = health.local_policy(data, "other" if binding else "canvas", "other-model" if model else "pinned", gate)
    assert result is (binding or model)
    assert data["media"]["image"]["gate_enabled"] is gate
    assert data["errors"] == ([LOCAL[0]] if binding else []) + ([LOCAL[1]] if model else []) + ([] if gate else [LOCAL[2]])


@pytest.mark.parametrize("errors", [[], upstream_entries()[:4], upstream_entries()])
def test_no_local_failures_preserve_empty_or_distinct_upstream_errors(errors):
    data = health.empty("canvas", "pinned")
    data["errors"] = copy.deepcopy(errors)
    assert health.local_policy(data, "canvas", "", True) is False
    assert data["errors"] == errors
    assert health.validate(data, "") == data


@pytest.mark.parametrize("case", ["empty", "normal", "duplicates", "auth-failure"])
async def test_normal_final_http_projections(health_contract, bot_client, monkeypatch, case):
    from ComfyTV.api import bot
    state = health_contract
    state["settings"]["bot-hermes-image-attachments"] = True
    original = [] if case == "empty" else upstream_entries()[:4]
    state["data"]["errors"] = original * (2 if case == "duplicates" else 1)
    if case == "auth-failure":
        state["status"] = 401
    monkeypatch.setattr(bot, "get_provider", lambda name: HermesProvider() if name == "hermes" else None)
    monkeypatch.setattr(bot, "bot_enabled", lambda: True)
    async with bot_client.get("/comfytv/bot/providers/hermes/health") as response:
        assert response.status == 200
        body = await response.json()
    record(case, body)
    final = body["provider"]["health"]
    assert health.validate(final, "test-only-secret") == final
    assert final["media"]["image"]["gate_enabled"] is True
    assert final["errors"] == ([health.diagnostic("broker_auth_rejected", "api", "check_connection", True)] if case == "auth-failure" else original)


async def test_legacy_final_http_projection(contract, bot_client, monkeypatch):
    from ComfyTV.api import bot
    monkeypatch.setattr(bot, "get_provider", lambda name: HermesProvider() if name == "hermes" else None)
    monkeypatch.setattr(bot, "bot_enabled", lambda: True)
    async with bot_client.get("/comfytv/bot/providers/hermes/health") as response:
        assert response.status == 200
        body = await response.json()
    record("legacy", body)
    assert body["provider"]["available"] is True
    final = body["provider"]["health"]
    assert health.validate(final, "test-only-secret") == final
    assert final["api"]["contract"] is None
    assert any(e["code"] == "diagnostics_unsupported" for e in final["errors"])
