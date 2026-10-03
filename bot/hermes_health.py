"""Content-free, passive integration health. Never resolves credentials or tools."""

import re
from datetime import datetime
from typing import Any

TOOLS = ("server_info", "get_canvas", "inspect_image_asset", "task_context_read")


def diagnostic(code, layer, action="none", retryable=False):
    return {"code": code, "layer": layer, "retryable": retryable, "action": action}


def empty(server, model="", work=1):
    return {
        "schema_version": 1,
        "checked_at": None,
        "age_ms": 0,
        "stale": False,
        "api": {
            "broker_auth": True,
            "upstream_reachable": None,
            "upstream_auth": None,
            "contract": None,
        },
        "gateway": {"state": "unknown", "codes": []},
        "mcp": {
            "server": server,
            "configured": None,
            "enabled": None,
            "platform_enabled": None,
            "connection_state": "unknown",
            "reachable": None,
            "observed_at": None,
            "required_tools": {t: {"registered": None, "usable": None} for t in TOOLS},
        },
        "media": {
            "image": {
                "gate_enabled": None,
                "transport": "asset_refs",
                "preview_tool": None,
                "vision_tool": None,
                "context_tool": None,
                "vision_route": "unknown",
                "inference": "not_tested",
            },
            "unsupported": ["video", "audio", "document"],
        },
        "model": {
            "selection_mode": "broker_override" if model else "inherit_default",
            "authorized_override": model or None,
            "configured_default": None,
            "last_served": None,
        },
        "inference": {"state": "not_tested"},
        "limits": {"work": work, "control": 2, "status": 2},
        "errors": [],
    }


# Fixed wire vocabulary; unknown upstream fields never cross this boundary.
CODES = (
    "broker_config_missing",
    "broker_auth_rejected",
    "broker_unreachable",
    "upstream_unreachable",
    "upstream_timeout",
    "upstream_auth_rejected",
    "upstream_contract_invalid",
    "gateway_degraded",
    "health_stale",
    "mcp_binding_mismatch",
    "mcp_runtime_introspection_unavailable",
    "mcp_disabled",
    "mcp_not_platform_enabled",
    "mcp_connection_failed",
    "mcp_required_tool_missing",
    "image_gate_disabled",
    "vision_unverified",
    "model_override_not_authorized",
    "model_default_unknown",
    "diagnostics_unsupported",
)
ACTIONS = (
    "check_connection",
    "check_main_api",
    "check_mcp_config",
    "check_tool_filters",
    "check_media_config",
    "check_model_policy",
    "retry_later",
    "none",
)
MODES = ("inherit_default", "broker_override")


def _check(value: Any, rule: Any, key: str) -> Any:
    if isinstance(rule, dict):
        if not isinstance(value, dict):
            raise TypeError("invalid health object")
        return {name: _check(value[name], sub, key) for name, sub in rule.items()}
    if isinstance(rule, list):
        if not isinstance(value, list) or len(value) > 32:
            raise ValueError("invalid health list")
        return [_check(item, rule[0], key) for item in value]
    if isinstance(rule, tuple):
        if not any(type(value) is type(item) and value == item for item in rule):
            raise ValueError("invalid health enum")
    elif rule == "bool":
        if type(value) is not bool:
            raise ValueError("invalid health boolean")
    elif rule == "int":
        if type(value) is not int or not 0 <= value <= 2147483647:
            raise ValueError("invalid health age")
    elif rule in ("timestamp", "id", "server"):
        if value is None and rule != "server":
            return None
        if not isinstance(value, str) or key and key in value:
            raise ValueError("invalid health identifier")
        if rule == "timestamp":
            if len(value) > 40 or not re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|\+00:00)", value):
                raise ValueError("invalid health timestamp")
            datetime.fromisoformat(value.replace("Z", "+00:00"))
        elif rule == "server":
            if not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", value):
                raise ValueError("invalid health server")
        elif (
            not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}", value)
            or "://" in value
            or ".." in value
            or value.lower().startswith(
                (
                    "sk-",
                    "sk_",
                    "bearer",
                    "token:",
                    "token_",
                    "password:",
                    "password_",
                    "api_key:",
                    "api_key_",
                    "api-key:",
                    "api-key_",
                    "apikey:",
                    "apikey_",
                    "access_token:",
                    "access_token_",
                    "refresh_token:",
                    "refresh_token_",
                    "github_pat_",
                    "ghp_",
                    "gho_",
                    "ghu_",
                    "ghs_",
                    "ghr_",
                )
            )
            or value.startswith("eyJ")
        ):
            raise ValueError("invalid health identifier")
    return value


def validate(raw: dict, key: str) -> dict:
    tri = (True, False, None)
    tool = {"registered": tri, "usable": tri}
    schema = {
        "schema_version": (1,),
        "checked_at": "timestamp",
        "age_ms": "int",
        "stale": "bool",
        "api": dict.fromkeys(("broker_auth", "upstream_reachable", "upstream_auth", "contract"), tri),
        "gateway": {"state": ("ok", "degraded", "unknown"), "codes": [CODES]},
        "mcp": {
            "server": "server",
            "configured": tri,
            "enabled": tri,
            "platform_enabled": tri,
            "connection_state": (
                "disabled",
                "configured",
                "lazy",
                "connecting",
                "connected_cached",
                "failed",
                "unknown",
            ),
            "reachable": tri,
            "observed_at": "timestamp",
            "required_tools": dict.fromkeys(TOOLS, tool),
        },
        "media": {
            "image": {
                "gate_enabled": tri,
                "transport": ("asset_refs",),
                "preview_tool": tri,
                "vision_tool": tri,
                "context_tool": tri,
                "vision_route": ("native", "auxiliary", "unknown"),
                "inference": ("not_tested",),
            },
            "unsupported": [("video", "audio", "document")],
        },
        "model": {"selection_mode": MODES, "authorized_override": "id"},
        "inference": {"state": ("not_tested", "last_success")},
        "limits": {"work": (1, 2), "control": (2,), "status": (2,)},
        "errors": [
            {
                "code": CODES,
                "layer": ("api", "gateway", "mcp", "media", "model"),
                "retryable": "bool",
                "action": ACTIONS,
            }
        ],
    }
    result = _check(raw, schema, key)
    for name, fields in (
        (
            "configured_default",
            {"provider": "id", "model": "id", "observed_at": "timestamp"},
        ),
        (
            "last_served",
            {
                "provider": "id",
                "model": "id",
                "completed_at": "timestamp",
                "selection_mode_at_run": MODES,
            },
        ),
    ):
        value = raw["model"][name]
        result["model"][name] = _check(value, fields, key) if value is not None else None
        if value is not None and (
            not result["model"][name]["model"]
            or name == "last_served"
            and (not result["model"][name]["provider"] or not result["model"][name]["completed_at"])
        ):
            raise ValueError("invalid model evidence")
    if result["mcp"]["observed_at"] is None:
        result["mcp"]["reachable"] = None
    return result


def local_policy(data, server, model, gate):
    local_errors = []
    mismatch = data["mcp"]["server"] != server
    if mismatch:
        local_errors.append(diagnostic("mcp_binding_mismatch", "mcp", "check_mcp_config"))
    if model and model != data["model"]["authorized_override"]:
        local_errors.append(diagnostic("model_override_not_authorized", "model", "check_model_policy"))
        mismatch = True
    data["media"]["image"]["gate_enabled"] = gate
    # Local attachment support is independent of the unchanged upstream wire.
    # No claim that a preview/listening tool is enabled or inference succeeded.
    data["media"]["unsupported"] = ["document"]
    if not gate:
        local_errors.append(diagnostic("image_gate_disabled", "media", "check_media_config"))
    # Reserve capacity for current local policy failures, then retain upstream
    # order. Only identical diagnostics collapse; layer/action/retryability
    # differences remain meaningful. Reapplying the same policy is idempotent.
    errors = []
    for error in local_errors + data["errors"]:
        if error not in errors:
            errors.append(error)
        if len(errors) == 32:
            break
    data["errors"] = errors
    return mismatch
