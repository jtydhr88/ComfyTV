import json
import logging
from typing import Any, Optional

from ._acp import AcpTransport
from ._acp_provider import SESSION_TIMEOUT_S, AcpLaunch, AcpProvider
from .deepseek_harness_runtime import (
    chat_cwd,
    ensure_profile,
    resolve_command,
    write_turn_overlay,
)
from .providers import TurnRequest

_log = logging.getLogger(__name__)

ACCOUNT_ROUTE = "deepseek-account"


def parse_model_value(value: str) -> Optional[tuple[str, str]]:
    try:
        parsed = json.loads(value or "")
    except ValueError:
        return None
    if isinstance(parsed, list) and len(parsed) == 2 and all(isinstance(p, str) and p for p in parsed):
        return parsed[0], parsed[1]
    return None


def model_options_from(config_options: Any) -> list[dict]:
    entry = next((o for o in config_options or [] if isinstance(o, dict) and o.get("id") == "model"), None)
    rows: list[dict] = []
    for item in (entry or {}).get("options") or []:
        nested = item.get("options") if "group" in item else [item]
        for option in nested or []:
            if option.get("value"):
                rows.append({"value": str(option["value"]),
                             "label": str(option.get("name") or option["value"]),
                             "group": str(item.get("group") or "")})
    return rows


class DeepSeekHarnessProvider(AcpProvider):
    id = "deepseek-harness"
    label = "DeepSeek Harness"
    stop_reason_errors = {
        "max_tokens": "DeepSeek Harness stopped at the output token limit for this turn.",
        "refusal": "DeepSeek Harness declined to continue this turn.",
        "max_turn_requests": "DeepSeek Harness stopped after the maximum number of model requests.",
    }

    @property
    def profile(self) -> str:
        return f"{self._host.name}-acp"

    def _command(self) -> tuple[Optional[list[str]], str]:
        return resolve_command()

    async def _launch(self, turn: TurnRequest, argv: list[str]) -> tuple[Optional[AcpLaunch], str]:
        profile_error = await ensure_profile(argv, self.profile)
        if profile_error:
            return None, profile_error
        cwd = chat_cwd(self._home_dir, turn.chat_id)
        overlay = write_turn_overlay(self._host.name, cwd, parse_model_value(turn.model))
        return AcpLaunch(argv=argv + ["--profile", self.profile, "--patch", str(overlay)],
                         cwd=str(cwd), session_cwd=str(cwd), mcp_url=turn.mcp_endpoint), ""

    def _catalog_from(self, opened: dict) -> list[dict]:
        return model_options_from(opened.get("configOptions"))

    def _on_extra_update(self, kind: str, update: dict) -> None:
        if kind == "config_option_update":
            self._catalog = model_options_from(update.get("configOptions")) or self._catalog

    def _target_model(self, saved: str) -> tuple[str, str]:
        values = [row["value"] for row in self._catalog]
        if saved:
            if parse_model_value(saved) is None or (values and saved not in values):
                return "", "The saved DeepSeek Harness model is no longer offered. Pick a model again."
            return saved, ""
        for row in self._catalog:
            if row["group"] == ACCOUNT_ROUTE:
                return row["value"], ""
        return "", ("No DeepSeek account model is available. Sign in to the DeepSeek Harness "
                    "app, or pick an API-key model in the model menu.")

    async def _select_model(self, transport: AcpTransport, session_id: str,
                            turn: TurnRequest, opened: dict, launch: AcpLaunch) -> str:
        model, model_error = self._target_model(turn.model)
        if model_error:
            return model_error
        await transport.request("session/set_config_option", {
            "sessionId": session_id, "configId": "model", "value": model,
        }, timeout=SESSION_TIMEOUT_S)
        _log.info("[%s/deepseek-harness] chat=%s model=%s", self._host.label, turn.chat_id, model)
        return ""
