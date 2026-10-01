import asyncio
import json
import logging
import time
from typing import Any, Optional

from ._acp import AcpError, AcpProcessError, AcpTransport
from ._cli_common import (
    PROBE_CACHE_S,
    TOOL_RESULT_CAP,
    TURN_IDLE_TIMEOUT_S,
    TURN_MAX_S,
    base_spawn_env,
    kill_process_tree,
)
from .deepseek_harness_runtime import (
    BOT_PROFILE,
    chat_cwd,
    ensure_profile,
    resolve_command,
    write_turn_overlay,
)
from .providers import (
    AgentProvider,
    BotEvent,
    EmitFn,
    ProviderCaps,
    ProviderStatus,
    TurnHandle,
    TurnRequest,
    TurnResult,
)

_log = logging.getLogger(__name__)

ACCOUNT_ROUTE = "deepseek-account"
ACP_PROTOCOL_VERSION = 1
MCP_SERVER_NAME = "comfytv"
IMAGE_MIME_TYPES = frozenset({"image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"})

VERSION_TIMEOUT_S = 15.0
SESSION_TIMEOUT_S = 120.0
CLOSE_TIMEOUT_S = 30.0
CANCEL_GRACE_S = 8.0

_STOP_REASON_ERRORS = {
    "max_tokens": "DeepSeek Harness stopped at the output token limit for this turn.",
    "refusal": "DeepSeek Harness declined to continue this turn.",
    "max_turn_requests": "DeepSeek Harness stopped after the maximum number of model requests.",
}
_USAGE_KEYS = {
    "inputTokens": "input_tokens",
    "outputTokens": "output_tokens",
    "cachedReadTokens": "cache_read_input_tokens",
    "cachedWriteTokens": "cache_creation_input_tokens",
}


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


def _usage(raw: Any) -> Optional[dict]:
    if not isinstance(raw, dict):
        return None
    out = {target: int(raw[key]) for key, target in _USAGE_KEYS.items()
           if isinstance(raw.get(key), (int, float))}
    return out or None


def _tool_result_text(content: Any) -> str:
    parts: list[str] = []
    for item in content if isinstance(content, list) else []:
        inner = item.get("content") if item.get("type") == "content" else item
        if isinstance(inner, dict) and inner.get("type") == "text":
            parts.append(str(inner.get("text") or ""))
        elif isinstance(inner, dict) and inner.get("type"):
            parts.append(f"[{inner['type']}]")
    return "\n".join(p for p in parts if p).strip()


def _prompt_blocks(turn: TurnRequest, image_supported: bool) -> tuple[list[dict], str]:
    blocks: list[dict] = []
    for attachment in turn.attachments or []:
        if not attachment.get("data"):
            continue
        mime = str(attachment.get("media_type") or "").lower()
        if mime not in IMAGE_MIME_TYPES:
            return [], f"DeepSeek Harness only accepts image attachments; this one is {mime or 'of an unknown type'}."
        if not image_supported:
            return [], ("The selected DeepSeek Harness model does not accept images. "
                        "Remove the attachment or pick another model.")
        blocks.append({"type": "image", "mimeType": "image/jpeg" if mime == "image/jpg" else mime,
                       "data": attachment["data"]})
    blocks.append({"type": "text", "text": turn.user_text})
    return blocks, ""


class DeepSeekHarnessProvider(AgentProvider):
    id = "deepseek-harness"
    label = "DeepSeek Harness"
    supports_branch = False

    def __init__(self) -> None:
        self._probe_cache: Optional[tuple[float, Optional[list[str]], ProviderStatus]] = None
        self._catalog: list[dict] = []
        self._live: dict[TurnHandle, list] = {}

    def capabilities(self) -> ProviderCaps:
        return ProviderCaps(stateful=True, tools="mcp", attachments=True)

    def model_options(self) -> list[dict]:
        return list(self._catalog)

    async def list_models(self) -> list[str]:
        return [row["value"] for row in self._catalog]

    async def probe(self) -> ProviderStatus:
        now = time.monotonic()
        argv, reason = resolve_command()
        if self._probe_cache and self._probe_cache[1] == argv and now - self._probe_cache[0] < PROBE_CACHE_S:
            return self._probe_cache[2]
        status = ProviderStatus(available=False, detail=reason)
        if argv is not None:
            try:
                proc = await asyncio.create_subprocess_exec(
                    *argv, "--version", stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE, env=base_spawn_env())
                out, err = await asyncio.wait_for(proc.communicate(), timeout=VERSION_TIMEOUT_S)
            except (OSError, asyncio.TimeoutError) as e:
                status = ProviderStatus(available=False, detail=f"dsh --version failed: {e}")
            else:
                if proc.returncode == 0:
                    status = ProviderStatus(available=True, version=out.decode("utf-8", "replace").strip())
                else:
                    detail = err.decode("utf-8", "replace").strip()[-200:]
                    status = ProviderStatus(available=False, detail=f"dsh --version exited with {proc.returncode}: {detail}")
        self._probe_cache = (now, argv, status)
        return status

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

    async def _on_update(self, update: dict, emit: EmitFn, names: dict[str, str]) -> None:
        kind = update.get("sessionUpdate")
        call_id = str(update.get("toolCallId") or "")
        if kind == "agent_message_chunk":
            content = update.get("content") or {}
            if content.get("type") == "text" and content.get("text"):
                await emit(BotEvent(t="delta", text=content["text"]))
        elif kind == "config_option_update":
            self._catalog = model_options_from(update.get("configOptions")) or self._catalog
        elif kind == "tool_call":
            names[call_id] = str(update.get("title") or "")
            raw = update.get("rawInput")
            await emit(BotEvent(t="tool_use", name=names[call_id], id=call_id,
                                input=raw if isinstance(raw, dict) else {}))
        elif kind == "tool_call_update" and update.get("status") in ("completed", "failed"):
            await emit(BotEvent(t="tool_result", name=names.get(call_id, ""), id=call_id,
                                text=_tool_result_text(update.get("content"))[:TOOL_RESULT_CAP],
                                is_error=update.get("status") == "failed"))

    @staticmethod
    async def _on_request(method: str, params: dict) -> dict:
        if method != "session/request_permission":
            raise AcpError(-32601, f"unsupported client method: {method}")
        for option in params.get("options") or []:
            if option.get("kind") == "reject_once":
                return {"outcome": {"outcome": "selected", "optionId": option["optionId"]}}
        return {"outcome": {"outcome": "cancelled"}}

    async def send(self, turn: TurnRequest, emit: EmitFn, handle: TurnHandle) -> TurnResult:
        argv, reason = resolve_command()
        if argv is None:
            return TurnResult(error=reason)
        profile_error = await ensure_profile(argv)
        if profile_error:
            return TurnResult(error=profile_error)
        if handle.stop_requested:
            return TurnResult(aborted=True)

        cwd = chat_cwd(turn.chat_id)
        overlay = write_turn_overlay(cwd, parse_model_value(turn.model))

        names: dict[str, str] = {}

        async def on_notification(method: str, params: dict) -> None:
            if method == "session/update":
                await self._on_update(params.get("update") or {}, emit, names)

        transport = AcpTransport(argv + ["--profile", BOT_PROFILE, "--patch", str(overlay)],
                                 cwd=str(cwd), env=base_spawn_env(),
                                 on_notification=on_notification, on_request=self._on_request)
        live = self._live[handle] = [transport, ""]
        try:
            return await self._run_turn(turn, emit, handle, transport, live, str(cwd))
        except (AcpError, AcpProcessError) as e:
            if handle.stop_requested:
                return TurnResult(resume_token=live[1] or None, aborted=True)
            detail = transport.error_detail()
            return TurnResult(resume_token=live[1] or None,
                              error=f"DeepSeek Harness: {e}" + (f" — {detail}" if detail else ""))
        finally:
            await self._teardown(handle, transport, live[1])

    async def _run_turn(self, turn: TurnRequest, emit: EmitFn, handle: TurnHandle,
                        transport: AcpTransport, live: list, cwd: str) -> TurnResult:
        try:
            await transport.start()
        except OSError as e:
            return TurnResult(error=f"could not start DeepSeek Harness: {e}")
        handle.process = transport.proc

        init = await transport.request("initialize", {
            "protocolVersion": ACP_PROTOCOL_VERSION,
            "clientInfo": {"name": "comfytv", "version": "1.0"},
            "clientCapabilities": {"fs": {"readTextFile": False, "writeTextFile": False},
                                   "terminal": False},
        }, timeout=SESSION_TIMEOUT_S) or {}
        image_supported = bool(((init.get("agentCapabilities") or {}).get("promptCapabilities") or {}).get("image"))

        mcp_servers = []
        if turn.mcp_endpoint:
            mcp_servers.append({"type": "http", "name": MCP_SERVER_NAME,
                                "url": turn.mcp_endpoint, "headers": []})
        if turn.resume_token:
            opened = await transport.request("session/resume", {
                "sessionId": turn.resume_token, "cwd": cwd, "mcpServers": mcp_servers,
            }, timeout=SESSION_TIMEOUT_S) or {}
            session_id = turn.resume_token
        else:
            opened = await transport.request("session/new", {
                "cwd": cwd, "mcpServers": mcp_servers,
            }, timeout=SESSION_TIMEOUT_S) or {}
            session_id = str(opened.get("sessionId") or "")
            if not session_id:
                return TurnResult(error="DeepSeek Harness returned no session id")
        live[1] = session_id
        self._catalog = model_options_from(opened.get("configOptions")) or self._catalog
        await emit(BotEvent(t="session", id=session_id))

        model, model_error = self._target_model(turn.model)
        if model_error:
            return TurnResult(resume_token=session_id, error=model_error)
        await transport.request("session/set_config_option", {
            "sessionId": session_id, "configId": "model", "value": model,
        }, timeout=SESSION_TIMEOUT_S)
        _log.info("[ComfyTV/deepseek-harness] chat=%s model=%s", turn.chat_id, model)

        blocks, block_error = _prompt_blocks(turn, image_supported)
        if block_error:
            return TurnResult(resume_token=session_id, error=block_error)
        if handle.stop_requested:
            return TurnResult(resume_token=session_id, aborted=True)
        response = await transport.request("session/prompt", {
            "sessionId": session_id, "prompt": blocks,
        }, timeout=TURN_MAX_S, idle_timeout=TURN_IDLE_TIMEOUT_S) or {}

        stop_reason = str(response.get("stopReason") or "")
        usage = _usage(response.get("usage"))
        if handle.stop_requested or stop_reason == "cancelled":
            return TurnResult(resume_token=session_id, aborted=True, usage=usage)
        return TurnResult(resume_token=session_id, usage=usage,
                          error=_STOP_REASON_ERRORS.get(stop_reason, ""))

    async def _teardown(self, handle: TurnHandle, transport: AcpTransport, session_id: str) -> None:
        self._live.pop(handle, None)
        if session_id and transport.returncode is None:
            try:
                await transport.request("session/close", {"sessionId": session_id},
                                        timeout=CLOSE_TIMEOUT_S)
            except (AcpError, AcpProcessError) as e:
                _log.warning("[ComfyTV/deepseek-harness] session/close failed: %s", e)
        await transport.close(CLOSE_TIMEOUT_S)
        if transport.returncode is None:
            await kill_process_tree(handle)
        await transport.dispose()

    async def stop(self, handle: TurnHandle) -> None:
        handle.stop_requested = True
        live = self._live.get(handle)
        if live and live[1]:
            try:
                await live[0].notify("session/cancel", {"sessionId": live[1]})
            except AcpProcessError:
                pass
            if await live[0].wait_exit(CANCEL_GRACE_S):
                return
        await kill_process_tree(handle)
