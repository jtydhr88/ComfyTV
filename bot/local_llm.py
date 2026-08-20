import asyncio
import json
import logging
import os
import shutil
import sys
import time
from pathlib import Path
from typing import Optional

import aiohttp

from ._cli_common import CORE_MCP_TOOLS, PROBE_CACHE_S, TOOL_RESULT_CAP
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

_URL_SETTING = "bot-local-llm-url"
_API_KEY_ENV = "COMFYTV_LOCAL_LLM_API_KEY"
_MAX_ITERATIONS = 80
_MAX_WAIT_SLICES = 12
_LLM_TIMEOUT_S = 300
_HISTORY_CHAR_CAP = 16_000

_SYSTEM_PROMPT = (
    "You are the ComfyTV canvas bot. The provided tools are your eyes and "
    "hands on the user's live ComfyTV canvas.\n\n"
    "- Look first: get_canvas shows the current nodes, prompts and run "
    "states; server_info shows overall health.\n"
    "- To render something: list_workflows for the exact workflow label, "
    "add_stage (returns a uid), run_stage on that uid, then wait_stage on "
    "the same uid until its status is 'done' or 'error', then outputs for "
    "the result URL.\n"
    "- Always copy strings exactly as tools return them. Never invent "
    "workflow labels, node ids or URLs.\n"
    "- Canvas writes work through either Comfy Desktop or a browser page. "
    "Do not treat `tab_page_active` as a reason to stop: make one real write "
    "attempt. If it fails, report the tool's exact error instead of inventing "
    "a focus problem or asking the user to click the canvas or reply 'ready'.\n"
    "- You have no OS window-control tool. Never claim you can activate a "
    "window or lack permission to do so.\n"
    "Reply in the user's language."
)


class LocalLlmProvider(AgentProvider):
    id = "local-llm"
    label = "Local LLM"

    def __init__(self, *, base_url: Optional[str] = None,
                 model: Optional[str] = None) -> None:
        self._base_url_override = base_url
        self._model_override = model
        self._probe_cache: Optional[tuple[float, ProviderStatus]] = None

    def capabilities(self) -> ProviderCaps:
        return ProviderCaps(stateful=False, tools="mcp", attachments=False)

    def _base_url(self) -> str:
        if self._base_url_override is not None:
            return self._base_url_override.rstrip("/")
        try:
            from .. import storage
            return str(storage.get_setting(_URL_SETTING) or "").strip().rstrip("/")
        except Exception:
            return ""

    def _api_headers(self) -> dict:
        headers = {"Content-Type": "application/json"}
        key = os.environ.get(_API_KEY_ENV, "")
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
        if self._probe_cache and now - self._probe_cache[0] < PROBE_CACHE_S:
            return self._probe_cache[1]
        base = self._base_url()
        if not base:
            status = ProviderStatus(
                available=False,
                detail="no endpoint configured — set the Local LLM endpoint "
                       "URL under Settings → Agent & MCP",
            )
            self._probe_cache = (now, status)
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
        except Exception as e:
            status = ProviderStatus(available=False, detail=str(e))
        self._probe_cache = (now, status)
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
        except Exception:
            return []

    def _lms_bin(self) -> str:
        executable = "lms.exe" if os.name == "nt" else "lms"
        candidates = [
            os.getenv("LMSTUDIO_LMS_PATH", ""),
            str(Path.home() / ".lmstudio" / "bin" / executable),
            "/Applications/LM Studio.app/Contents/Resources/app/.webpack/lms"
            if sys.platform == "darwin" else "",
            shutil.which("lms") or "",
        ]
        for candidate in candidates:
            if candidate and Path(candidate).is_file():
                return candidate
        return ""

    async def _run_lms(self, args: list[str], timeout: float = 600) -> str:
        binary = self._lms_bin()
        if not binary:
            raise RuntimeError("lms executable not found")
        process = await asyncio.create_subprocess_exec(
            binary, *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            raise RuntimeError(f"lms {' '.join(args)} timed out")
        if process.returncode != 0:
            detail = "\n".join(part for part in (
                stdout.decode("utf-8", "replace").strip(),
                stderr.decode("utf-8", "replace").strip()) if part)
            raise RuntimeError(f"lms {' '.join(args)} failed: {detail}")
        return stdout.decode("utf-8", "replace").strip()

    async def _unload_model(self) -> bool:
        try:
            await self._run_lms(["unload", "--all"], timeout=60)
            return True
        except Exception as e:
            _log.warning("[ComfyTV/local-llm] model unload failed: %s", e)
            return False

    async def _reload_model(self, model: str) -> None:
        if not model:
            return
        try:
            await self._run_lms([
                "load", model, "--identifier", model,
                "--gpu", "max", "--yes",
            ])
        except Exception as e:
            _log.warning("[ComfyTV/local-llm] model reload failed: %s", e)

    async def _mcp_list_tools(self, session: aiohttp.ClientSession,
                              endpoint: str) -> list[dict]:
        data = await self._request_json(
            session, "POST", endpoint, headers=self._mcp_headers(),
            json_body={"jsonrpc": "2.0", "id": "tools", "method": "tools/list",
                       "params": {}}, timeout=30,
        )
        tools = (data.get("result") or {}).get("tools") or []
        return [t for t in tools if t.get("name") in CORE_MCP_TOOLS]

    async def _mcp_call_tool(self, session: aiohttp.ClientSession,
                             endpoint: str, name: str,
                             arguments: dict) -> str:
        data = await self._request_json(
            session, "POST", endpoint, headers=self._mcp_headers(),
            json_body={"jsonrpc": "2.0", "id": f"call-{name}",
                       "method": "tools/call",
                       "params": {"name": name, "arguments": arguments}},
            timeout=200,
        )
        result = data.get("result") or {}
        text = self._extract_text(result.get("content"))
        if result.get("isError"):
            return "[tool error] " + text
        return text

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
        unloaded = bool(self._lms_bin()) and await self._unload_model()
        try:
            raw = ""
            for _ in range(_MAX_WAIT_SLICES):
                if handle.stop_requested:
                    break
                raw = await self._mcp_call_tool(
                    session, endpoint, "wait_stage", args)
                try:
                    data = json.loads(raw)
                except Exception:
                    break
                if not isinstance(data, dict) or data.get("status") != "running":
                    break
                if data.get("after_output_id") is not None:
                    args["after_output_id"] = data["after_output_id"]
            return raw
        finally:
            if unloaded:
                await self._reload_model(model)

    async def send(self, turn: TurnRequest, emit: EmitFn,
                   handle: TurnHandle) -> TurnResult:
        base = self._base_url()
        if not base:
            return TurnResult(
                error="no Local LLM endpoint configured — set the endpoint "
                      "URL under Settings → Agent & MCP")
        if not turn.mcp_endpoint:
            return TurnResult(error="no mcp_endpoint provided")

        try:
            async with aiohttp.ClientSession() as session:
                handle.process = session
                model = self._model_override or turn.model
                if not model:
                    models = await self.list_models()
                    model = models[0] if models else ""
                if not model:
                    return TurnResult(
                        error="no model available on the Local LLM endpoint")

                tools = self._build_tools(
                    await self._mcp_list_tools(session, turn.mcp_endpoint))
                messages: list[dict] = [
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    *self._history_messages(turn.history),
                    {"role": "user", "content": turn.user_text},
                ]

                for _ in range(_MAX_ITERATIONS):
                    if handle.stop_requested:
                        return TurnResult(aborted=True)
                    data = await self._request_json(
                        session, "POST", f"{base}/chat/completions",
                        headers=self._api_headers(),
                        json_body={
                            "model": model,
                            "messages": messages,
                            "tools": tools,
                            "tool_choice": "auto",
                            "max_tokens": 4096,
                            "temperature": 0.2,
                        },
                        timeout=_LLM_TIMEOUT_S,
                    )
                    message = (data.get("choices") or [{}])[0].get("message") or {}
                    content = self._extract_text(message.get("content") or "")
                    tool_calls = message.get("tool_calls") or []

                    if content:
                        await emit(BotEvent(t="delta", text=content))
                    if not tool_calls:
                        return TurnResult()

                    messages.append({
                        "role": "assistant",
                        "content": content or None,
                        "tool_calls": tool_calls,
                    })
                    for tool_call in tool_calls:
                        if handle.stop_requested:
                            return TurnResult(aborted=True)
                        fn = tool_call.get("function") or {}
                        name = str(fn.get("name") or "")
                        raw_args = fn.get("arguments") or "{}"
                        try:
                            args = (json.loads(raw_args)
                                    if isinstance(raw_args, str) else raw_args)
                        except Exception:
                            args = {}
                        if not isinstance(args, dict):
                            args = {}
                        await emit(BotEvent(t="tool_use", name=name, input=args))
                        try:
                            if name == "wait_stage":
                                result_text = await self._wait_stage_done(
                                    session, turn.mcp_endpoint, args, model,
                                    handle)
                            else:
                                result_text = await self._mcp_call_tool(
                                    session, turn.mcp_endpoint, name, args)
                        except Exception as e:
                            result_text = f"[error] {type(e).__name__}: {e}"
                        result_text = result_text[:TOOL_RESULT_CAP]
                        await emit(BotEvent(
                            t="tool_result", name=name, text=result_text))
                        messages.append({
                            "role": "tool",
                            "tool_call_id": str(tool_call.get("id") or name),
                            "content": result_text,
                        })
                return TurnResult(error="too many tool-call iterations")
        except asyncio.CancelledError:
            raise
        except Exception as e:
            if handle.stop_requested:
                return TurnResult(aborted=True)
            _log.exception("[ComfyTV/local-llm] turn failed")
            return TurnResult(error=str(e) or type(e).__name__)
        finally:
            handle.process = None

    async def stop(self, handle: TurnHandle) -> None:
        handle.stop_requested = True
        session = handle.process
        if isinstance(session, aiohttp.ClientSession):
            try:
                await session.close()
            except Exception:
                pass
