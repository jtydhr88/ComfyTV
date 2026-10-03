import json

import pytest
from ComfyTV.bot.hermes import HermesProvider
from ComfyTV.bot.hermes_health import empty, validate
from test_hermes_health import health_contract  # noqa: F401

VALUES = [
    "SK-syntheticcanary",
    "SK_syntheticcanary",
    "BEARERsyntheticcanary",
    "TOKEN:syntheticcanary",
    "TOKEN_syntheticcanary",
    "PASSWORD:syntheticcanary",
    "PASSWORD_syntheticcanary",
    "API_KEY:syntheticcanary",
    "API_KEY_syntheticcanary",
    "API-KEY:syntheticcanary",
    "API-KEY_syntheticcanary",
    "APIKEY:syntheticcanary",
    "APIKEY_syntheticcanary",
    "ACCESS_TOKEN:syntheticcanary",
    "ACCESS_TOKEN_syntheticcanary",
    "REFRESH_TOKEN:syntheticcanary",
    "REFRESH_TOKEN_syntheticcanary",
    "GITHUB_PAT_syntheticcanary",
    "GHP_syntheticcanary",
    "GHO_syntheticcanary",
    "GHU_syntheticcanary",
    "GHS_syntheticcanary",
    "GHR_syntheticcanary",
    "eyJsynthetic.payload.signature",
    "eyJsyntheticcanarysyntheticcanarysyntheticcanary",
    "https://fixture/model",
    "a..b",
    "unicodeé",
    "a b",
    "a=b",
]

VALUES += ["test-only-secret"]


@pytest.mark.parametrize("index", range(len(VALUES)))
@pytest.mark.parametrize(
    "field", ["override", "configured_model", "configured_provider", "served_model", "served_provider"]
)
async def test_http_identifier_fail_closed(health_contract, caplog, index, field):  # noqa: F811
    value = VALUES[index]
    model = health_contract["data"]["model"]
    model["configured_default"] = {"model": "valid", "provider": "valid", "observed_at": None}
    model["last_served"] = {
        "model": "valid",
        "provider": "valid",
        "completed_at": "2026-10-03T00:00:00Z",
        "selection_mode_at_run": "inherit_default",
    }
    if field == "override":
        model["authorized_override"] = value
    else:
        name, key = field.split("_")
        model["configured_default" if name == "configured" else "last_served"][key] = value
    status = await HermesProvider().probe()
    assert not status.available, "unsafe identifier accepted"
    assert value not in json.dumps(status.health) + caplog.text, "unsafe identifier exposed"


@pytest.mark.parametrize("value", ["openai-codex", "gpt-6.1-sol", "anthropic/claude-sonnet-4.6", "Qwen/Qwen3:latest"])
def test_valid_identifier(value):
    assert validate(empty("canvas", value), "")["model"]["authorized_override"] == value
