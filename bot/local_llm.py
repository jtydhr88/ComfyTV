import asyncio
import json
import logging
import os
import re
import time
from typing import Callable, Optional

import aiohttp

from ._cli_common import (
    PROBE_CACHE_S,
    TOOL_RESULT_CAP,
    merge_usage,
)
from . import lms
from .agent_host import AgentHost
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
_NET_ERRORS = (aiohttp.ClientError, asyncio.TimeoutError, OSError, RuntimeError, ValueError)

_MAX_ITERATIONS = 80
_MAX_WAIT_SLICES = 12
_LLM_TIMEOUT_S = 300
_HISTORY_CHAR_CAP = 16_000
_THINK_RE = re.compile(r"(?:<think>|^)([\s\S]*?)</think>|<think>([\s\S]*)$")


def _user_content(text: str, attachments: Optional[list[dict]]):
    images = [
        {"type": "image_url",
         "image_url": {"url": f"data:{a.get('media_type') or 'image/jpeg'}"
                              f";base64,{a['data']}"}}
        for a in attachments or [] if a.get("data")
    ]
    if not images:
        return text
    return [{"type": "text", "text": text}, *images]


class LocalLlmProvider(AgentProvider):
    id = "local-llm"
    label = "Local LLM"
    unloads_lms_during_waits = True

    def __init__(self, *, host: AgentHost, base_url: Callable[[], str]) -> None:
        self._host = host
        self._base_url_source = base_url
        self._probe_cache: Optional[tuple[float, str, ProviderStatus]] = None

    def capabilities(self) -> ProviderCaps:
        return ProviderCaps(stateful=False, tools="mcp", attachments=True)

    def _base_url(self) -> str:
        return self._base_url_source().strip().rstrip("/")

    def _api_headers(self) -> dict:
        headers = {"Content-Type": "application/json"}
        key = os.environ.get(self._host.local_llm_key_env, "")
        if key:
            headers["Authorization"] = f"Bearer {key}"
        return headers

    @staticmethod
    def _mcp_headers() -> dict:
        return {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }

    async def _request_json(self, session: aiohttp.ClientSession, method: str,
                            url: str, *, headers: dict,
                            json_body: Optional[dict] = None,
                            timeout: float = 120) -> dict:
        async with session.request(
            method, url, headers=headers, json=json_body,
            timeout=aiohttp.ClientTimeout(total=timeout),
        ) as resp:
            text = await resp.text()
            if resp.status >= 400:
                raise RuntimeError(f"HTTP {resp.status}: {text[:300]}")
            return json.loads(text) if text else {}

    async def probe(self) -> ProviderStatus:
        now = time.monotonic()
        base = self._base_url()
        if self._probe_cache and self._probe_cache[1] == base and now - self._probe_cache[0] < PROBE_CACHE_S:
            return self._probe_cache[2]
        if not base:
            status = ProviderStatus(
                available=False,
                detail="no endpoint configured — set the Local LLM endpoint "
                       f"URL in {self._host.settings_location}",
            )
            self._probe_cache = (now, base, status)
            return status
        try:
            async with aiohttp.ClientSession() as session:
                data = await self._request_json(
                    session, "GET", f"{base}/models",
                    headers=self._api_headers(), timeout=10,
                )
            models = [str(m.get("id") or "") for m in data.get("data") or []]
            models = [m for m in models if m]
            if not models:
                status = ProviderStatus(
                    available=False,
                    detail="the endpoint is up but reports no models — load "
                           "a model first",
                )
            else:
                status = ProviderStatus(
                    available=True, version=models[0], logged_in=True,
                )
        except _NET_ERRORS as e:
            status = ProviderStatus(available=False, detail=str(e))
        self._probe_cache = (now, base, status)
        return status

    async def list_models(self) -> list[str]:
        base = self._base_url()
        if not base:
            return []
        try:
            async with aiohttp.ClientSession() as session:
                data = await self._request_json(
                    session, "GET", f"{base}/models",
                    headers=self._api_headers(), timeout=10,
                )
            models = [str(m.get("id") or "") for m in data.get("data") or []]
            return [m for m in models if m]
        except _NET_ERRORS:
            return []

    async def _mcp_list_tools(self, session: aiohttp.ClientSession,
                              endpoint: str) -> list[dict]:
        data = await self._request_json(
            session, "POST", endpoint, headers=self._mcp_headers(),
            json_body={"jsonrpc": "2.0", "id": "tools", "method": "tools/list",
                       "params": {}}, timeout=30,
        )
        tools = (data.get("result") or {}).get("tools") or []
        return [t for t in tools if t.get("name") in self._host.core_tools]

    async def _mcp_call_tool(self, session: aiohttp.ClientSession,
                             endpoint: str, name: str,
                             arguments: dict) -> tuple[str, list[str]]:
        data = await self._request_json(
            session, "POST", endpoint, headers=self._mcp_headers(),
            json_body={"jsonrpc": "2.0", "id": f"call-{name}",
                       "method": "tools/call",
                       "params": {"name": name, "arguments": arguments}},
            timeout=560 if name == "ask_user" else 200,
        )
        result = data.get("result") or {}
        content = result.get("content")
        text = self._extract_text(content)
        images = [f"data:{b.get('mimeType') or 'image/png'};base64,{b['data']}"
                  for b in content or [] if isinstance(b, dict)
                  and b.get("type") == "image" and b.get("data")]
        if result.get("isError"):
            return "[tool error] " + text, []
        return text, images

    @staticmethod
    def _extract_text(content: object) -> str:
        if isinstance(content, str):
            return content
        parts = []
        if isinstance(content, list):
            for block in content:
                if isinstance(block, dict) and block.get("type") == "text":
                    parts.append(str(block.get("text") or ""))
        return "\n".join(parts)

    @staticmethod
    def _build_tools(tools: list[dict]) -> list[dict]:
        return [{
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": str(tool.get("description") or "").strip(),
                "parameters": tool.get("inputSchema")
                or {"type": "object", "properties": {}},
            },
        } for tool in tools]

    @staticmethod
    def _history_messages(history: Optional[list[dict]]) -> list[dict]:
        out: list[dict] = []
        total = 0
        for msg in reversed(history or []):
            role = msg.get("role")
            text = str(msg.get("text") or "").strip()
            if role not in ("user", "assistant") or not text:
                continue
            total += len(text)
            if total > _HISTORY_CHAR_CAP:
                break
            out.append({"role": role, "content": text})
        out.reverse()
        return out

    async def _wait_stage_done(self, session: aiohttp.ClientSession,
                               endpoint: str, args: dict, model: str,
                               handle: TurnHandle) -> str:
        args = dict(args)
        args.setdefault("timeout_s", 170)
        unloaded = self.unloads_lms_during_waits and bool(lms.lms_bin()) and await lms.unload_models()
        try:
            raw = ""
            for _ in range(_MAX_WAIT_SLICES):
                if handle.stop_requested:
                    break
                raw, _images = await self._mcp_call_tool(
                    session, endpoint, self._host.wait_tool, args)
                try:
                    data = json.loads(raw)
                except ValueError:
                    break
                if not isinstance(data, dict) or data.get("status") != "running":
                    break
                if data.get("after_output_id") is not None:
                    args["after_output_id"] = data["after_output_id"]
            return raw
        finally:
            if unloaded:
                await lms.load_model(model)

    async def send(self, turn: TurnRequest, emit: EmitFn,
                   handle: TurnHandle) -> TurnResult:
        base = self._base_url()
        if not base:
            return TurnResult(
                error="no Local LLM endpoint configured — set the endpoint "
                      f"URL in {self._host.settings_location}")
        try:
            async with aiohttp.ClientSession() as session:
                handle.process = session
                model = turn.model
                if not model:
                    models = await self.list_models()
                    model = models[0] if models else ""
                if not model:
                    return TurnResult(
                        error="no model available on the Local LLM endpoint")

                tools = self._build_tools(
                    await self._mcp_list_tools(session, turn.mcp_endpoint)) if turn.mcp_endpoint else []
                messages: list[dict] = [
                    *([{"role": "system", "content": self._host.local_llm_prompt}] if tools else []),
                    *self._history_messages(turn.history),
                    {"role": "user",
                     "content": _user_content(turn.user_text,
                                              turn.attachments)},
                ]

                usage: Optional[dict] = None
                for _ in range(_MAX_ITERATIONS):
                    if handle.stop_requested:
                        return TurnResult(aborted=True, usage=usage)
                    data = await self._request_json(
                        session, "POST", f"{base}/chat/completions",
                        headers=self._api_headers(),
                        json_body={
                            "model": model,
                            "messages": messages,
                            **({"tools": tools, "tool_choice": "auto"} if tools else {}),
                            "temperature": 0.2,
                        },
                        timeout=_LLM_TIMEOUT_S,
                    )
                    usage = merge_usage(usage, data.get("usage"))
                    message = (data.get("choices") or [{}])[0].get("message") or {}
                    content = self._extract_text(message.get("content") or "")
                    thought = _THINK_RE.search(content)
                    reasoning = str(message.get("reasoning_content") or message.get("reasoning") or "") or (thought.group(1) or thought.group(2) or "" if thought else "")
                    content = _THINK_RE.sub("", content).strip()
                    tool_calls = message.get("tool_calls") or []

                    if reasoning.strip():
                        await emit(BotEvent(t="thinking", text=reasoning.strip()))
                    if content:
                        await emit(BotEvent(t="delta", text=content))
                    if not tool_calls:
                        return TurnResult(usage=usage)

                    messages.append({
                        "role": "assistant",
                        "content": content or None,
                        "tool_calls": tool_calls,
                    })
                    for tool_call in tool_calls:
                        if handle.stop_requested:
                            return TurnResult(aborted=True, usage=usage)
                        fn = tool_call.get("function") or {}
                        name = str(fn.get("name") or "")
                        tc_id = str(tool_call.get("id") or "")
                        raw_args = fn.get("arguments") or "{}"
                        try:
                            args = (json.loads(raw_args)
                                    if isinstance(raw_args, str) else raw_args)
                        except ValueError:
                            args = {}
                        if not isinstance(args, dict):
                            args = {}
                        await emit(BotEvent(t="tool_use", name=name, input=args,
                                            id=tc_id))
                        tool_failed = False
                        images: list[str] = []
                        try:
                            if self._host.wait_tool and name == self._host.wait_tool:
                                result_text = await self._wait_stage_done(
                                    session, turn.mcp_endpoint, args, model,
                                    handle)
                            else:
                                result_text, images = await self._mcp_call_tool(
                                    session, turn.mcp_endpoint, name, args)
                        except _NET_ERRORS as e:
                            result_text = f"[error] {type(e).__name__}: {e}"
                            tool_failed = True
                        if len(result_text) > TOOL_RESULT_CAP:
                            result_text = (
                                result_text[:TOOL_RESULT_CAP]
                                + f"\n…[truncated {len(result_text) - TOOL_RESULT_CAP} chars]")
                        await emit(BotEvent(
                            t="tool_result", name=name, text=result_text,
                            id=tc_id, is_error=tool_failed))
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tc_id or name,
                            "content": result_text,
                        })
                        if images:
                            messages.append({"role": "user", "content": [
                                {"type": "text",
                                 "text": f"Images returned by {name}:"},
                                *({"type": "image_url", "image_url": {"url": u}}
                                  for u in images),
                            ]})
                return TurnResult(error="too many tool-call iterations",
                                  usage=usage)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            if handle.stop_requested:
                return TurnResult(aborted=True)
            _log.exception("[%s/local-llm] turn failed", self._host.label)
            return TurnResult(error=str(e) or type(e).__name__)
        finally:
            handle.process = None

    async def stop(self, handle: TurnHandle) -> None:
        handle.stop_requested = True
        session = handle.process
        if isinstance(session, aiohttp.ClientSession):
            await session.close()
