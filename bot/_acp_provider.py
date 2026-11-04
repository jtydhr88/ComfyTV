import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Any, Optional

from ._acp import AcpError, AcpProcessError, AcpTransport
from ._cli_common import (
    PROBE_CACHE_S,
    TOOL_RESULT_CAP,
    TURN_IDLE_TIMEOUT_S,
    TURN_MAX_S,
    base_spawn_env,
    kill_process_tree,
    run_command,
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

ACP_PROTOCOL_VERSION = 1
MCP_SERVER_NAME = "comfytv"
IMAGE_MIME_TYPES = frozenset({"image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"})

VERSION_TIMEOUT_S = 15.0
SESSION_TIMEOUT_S = 120.0
CLOSE_TIMEOUT_S = 30.0
CANCEL_GRACE_S = 8.0

_USAGE_KEYS = {
    "inputTokens": "input_tokens",
    "outputTokens": "output_tokens",
    "cachedReadTokens": "cache_read_input_tokens",
    "cachedWriteTokens": "cache_creation_input_tokens",
}


_TURN_UPDATES = frozenset({"agent_message_chunk", "agent_thought_chunk", "user_message_chunk",
                           "tool_call", "tool_call_update"})


@dataclass
class AcpLaunch:
    argv: list[str]
    cwd: str
    session_cwd: str
    mcp_url: str

    def mcp_servers(self) -> list[dict]:
        if not self.mcp_url:
            return []
        return [{"type": "http", "name": MCP_SERVER_NAME, "url": self.mcp_url, "headers": []}]


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


class AcpProvider(AgentProvider):
    supports_branch = False
    stop_reason_errors: dict[str, str] = {}

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

    def _command(self) -> tuple[Optional[list[str]], str]:
        raise NotImplementedError

    def _version_argv(self, argv: list[str]) -> list[str]:
        return [*argv, "--version"]

    async def _launch(self, turn: TurnRequest, argv: list[str]) -> tuple[Optional[AcpLaunch], str]:
        raise NotImplementedError

    def _catalog_from(self, opened: dict) -> list[dict]:
        return []

    async def _select_model(self, transport: AcpTransport, session_id: str,
                            turn: TurnRequest, opened: dict, launch: AcpLaunch) -> str:
        return ""

    async def probe(self) -> ProviderStatus:
        now = time.monotonic()
        argv, reason = self._command()
        if self._probe_cache and self._probe_cache[1] == argv and now - self._probe_cache[0] < PROBE_CACHE_S:
            return self._probe_cache[2]
        status = ProviderStatus(available=False, detail=reason)
        if argv is not None:
            try:
                code, out, err = await run_command(self._version_argv(argv), timeout=VERSION_TIMEOUT_S,
                                                   env=base_spawn_env())
            except (OSError, asyncio.TimeoutError) as e:
                status = ProviderStatus(available=False, detail=f"{self.label} --version failed: {e}")
            else:
                if code == 0:
                    version = out.decode("utf-8", "replace").strip().splitlines()
                    status = ProviderStatus(available=True, version=version[0] if version else "")
                else:
                    detail = err.decode("utf-8", "replace").strip()[-200:]
                    status = ProviderStatus(available=False,
                                            detail=f"{self.label} --version exited with {code}: {detail}")
        self._probe_cache = (now, argv, status)
        return status

    def _on_extra_update(self, kind: str, update: dict) -> None:
        pass

    async def _on_update(self, update: dict, emit: EmitFn, names: dict[str, str], prompting: bool) -> None:
        kind = update.get("sessionUpdate")
        call_id = str(update.get("toolCallId") or "")
        if not prompting and kind in _TURN_UPDATES:
            return
        if kind in ("agent_message_chunk", "agent_thought_chunk"):
            content = update.get("content") or {}
            if content.get("type") == "text" and content.get("text"):
                await emit(BotEvent(t="delta" if kind == "agent_message_chunk" else "thinking", text=content["text"]))
        elif kind == "tool_call":
            names[call_id] = str(update.get("title") or "")
            raw = update.get("rawInput")
            await emit(BotEvent(t="tool_use", name=names[call_id], id=call_id,
                                input=raw if isinstance(raw, dict) else {}))
        elif kind == "tool_call_update" and update.get("status") in ("completed", "failed"):
            await emit(BotEvent(t="tool_result", name=names.get(call_id, ""), id=call_id,
                                text=_tool_result_text(update.get("content"))[:TOOL_RESULT_CAP],
                                is_error=update.get("status") == "failed"))
        else:
            self._on_extra_update(kind, update)

    @staticmethod
    async def _on_request(method: str, params: dict) -> dict:
        if method != "session/request_permission":
            raise AcpError(-32601, f"unsupported client method: {method}")
        for option in params.get("options") or []:
            if option.get("kind") == "reject_once":
                return {"outcome": {"outcome": "selected", "optionId": option["optionId"]}}
        return {"outcome": {"outcome": "cancelled"}}

    def _prompt_blocks(self, turn: TurnRequest, image_supported: bool) -> tuple[list[dict], str]:
        blocks: list[dict] = []
        for attachment in turn.attachments or []:
            if not attachment.get("data"):
                continue
            mime = str(attachment.get("media_type") or "").lower()
            if mime not in IMAGE_MIME_TYPES:
                return [], f"{self.label} only accepts image attachments; this one is {mime or 'of an unknown type'}."
            if not image_supported:
                return [], (f"The selected {self.label} model does not accept images. "
                            "Remove the attachment or pick another model.")
            blocks.append({"type": "image", "mimeType": "image/jpeg" if mime == "image/jpg" else mime,
                           "data": attachment["data"]})
        blocks.append({"type": "text", "text": turn.user_text})
        return blocks, ""

    async def send(self, turn: TurnRequest, emit: EmitFn, handle: TurnHandle) -> TurnResult:
        argv, reason = self._command()
        if argv is None:
            return TurnResult(error=reason)
        launch, launch_error = await self._launch(turn, argv)
        if launch is None:
            return TurnResult(error=launch_error)
        if handle.stop_requested:
            return TurnResult(aborted=True)

        names: dict[str, str] = {}
        live: list = [None, "", False, False]

        async def on_notification(method: str, params: dict) -> None:
            if method == "session/update":
                await self._on_update(params.get("update") or {}, emit, names, live[3])

        transport = AcpTransport(launch.argv, cwd=launch.cwd, env=base_spawn_env(),
                                 on_notification=on_notification, on_request=self._on_request)
        live[0] = transport
        self._live[handle] = live
        try:
            return await self._run_turn(turn, emit, handle, transport, live, launch)
        except (AcpError, AcpProcessError) as e:
            if handle.stop_requested:
                return TurnResult(resume_token=live[1] or None, aborted=True)
            detail = transport.error_detail()
            return TurnResult(resume_token=live[1] or None,
                              error=f"{self.label}: {e}" + (f" — {detail}" if detail else ""))
        finally:
            await self._teardown(handle, transport, live[1] if live[2] else "")

    async def _run_turn(self, turn: TurnRequest, emit: EmitFn, handle: TurnHandle,
                        transport: AcpTransport, live: list, launch: AcpLaunch) -> TurnResult:
        try:
            await transport.start()
        except OSError as e:
            return TurnResult(error=f"could not start {self.label}: {e}")
        handle.process = transport.proc

        init = await transport.request("initialize", {
            "protocolVersion": ACP_PROTOCOL_VERSION,
            "clientInfo": {"name": "comfytv", "version": "1.0"},
            "clientCapabilities": {"fs": {"readTextFile": False, "writeTextFile": False},
                                   "terminal": False},
        }, timeout=SESSION_TIMEOUT_S) or {}
        caps = init.get("agentCapabilities") or {}
        image_supported = bool((caps.get("promptCapabilities") or {}).get("image"))
        live[2] = "close" in (caps.get("sessionCapabilities") or {})

        mcp_servers = launch.mcp_servers()
        if turn.resume_token:
            opened = await transport.request("session/resume", {
                "sessionId": turn.resume_token, "cwd": launch.session_cwd, "mcpServers": mcp_servers,
            }, timeout=SESSION_TIMEOUT_S) or {}
            session_id = turn.resume_token
        else:
            opened = await transport.request("session/new", {
                "cwd": launch.session_cwd, "mcpServers": mcp_servers,
            }, timeout=SESSION_TIMEOUT_S) or {}
            session_id = str(opened.get("sessionId") or "")
            if not session_id:
                return TurnResult(error=f"{self.label} returned no session id")
        live[1] = session_id
        self._catalog = self._catalog_from(opened) or self._catalog
        await emit(BotEvent(t="session", id=session_id))

        model_error = await self._select_model(transport, session_id, turn, opened, launch)
        if model_error:
            return TurnResult(resume_token=session_id, error=model_error)

        blocks, block_error = self._prompt_blocks(turn, image_supported)
        if block_error:
            return TurnResult(resume_token=session_id, error=block_error)
        if handle.stop_requested:
            return TurnResult(resume_token=session_id, aborted=True)
        live[3] = True
        response = await transport.request("session/prompt", {
            "sessionId": session_id, "prompt": blocks,
        }, timeout=TURN_MAX_S, idle_timeout=TURN_IDLE_TIMEOUT_S) or {}

        stop_reason = str(response.get("stopReason") or "")
        usage = _usage(response.get("usage"))
        if handle.stop_requested or stop_reason == "cancelled":
            return TurnResult(resume_token=session_id, aborted=True, usage=usage)
        return TurnResult(resume_token=session_id, usage=usage,
                          error=self.stop_reason_errors.get(stop_reason, ""))

    async def _teardown(self, handle: TurnHandle, transport: AcpTransport, session_id: str) -> None:
        self._live.pop(handle, None)
        if session_id and transport.returncode is None:
            try:
                await transport.request("session/close", {"sessionId": session_id},
                                        timeout=CLOSE_TIMEOUT_S)
            except (AcpError, AcpProcessError) as e:
                _log.warning("[ComfyTV/%s] session/close failed: %s", self.id, e)
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
