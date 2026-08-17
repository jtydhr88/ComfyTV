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

_DEFAULT_BASE_URL = "http://127.0.0.1:1234/v1"
_MAX_ITERATIONS = 80
_TOOL_RESULT_CAP = int(os.environ.get("LMSTUDIO_TOOL_RESULT_CAP", "6000"))
_TOOL_DESC_CAP = int(os.environ.get("LMSTUDIO_TOOL_DESC_CAP", "0"))
_PROBE_CACHE_S = 60
_DEFAULT_CTX = 8192
_LONG_TOOLS = {"wait_stage", "scene_record", "scene_capture"}

_SYSTEM_PROMPT = (
    "You are the ComfyTV canvas bot. Drive the ComfyTV canvas by calling the "
    "provided tools.\n\n"
    "To generate an image, follow this exact sequence:\n"
    "1. Call list_workflows with arguments {\"kind\": \"image\"} and copy the "
    "exact 'label' of the workflow you want (verbatim, including Chinese).\n"
    "2. Call add_stage with arguments {\"node_class\": \"ComfyTV.ImageStage\", "
    "\"workflow\": \"<that exact label>\", \"prompt\": \"<image prompt>\"}.\n"
    "3. add_stage returns a 'uid'. Call run_stage with arguments "
    "{\"node\": \"<that uid>\"}.\n"
    "4. Call wait_stage with arguments {\"node\": \"<that uid>\", "
    "\"timeout_s\": 170}. If status is 'running', call wait_stage again with "
    "the same node until status is 'done' or 'error'.\n"
    "5. Call outputs with {\"project_id\": \"default\", \"stage_uid\": "
    "\"<that uid>\"} and report the image_url.\n\n"
    "Always use the exact strings returned by tools. Never invent workflow "
    "names, node ids, or URLs. Wait patiently for wait_stage to finish. Reply "
    "in the user's language."
)

_HIGH_LEVEL_SYSTEM_PROMPT = (
    "You are the ComfyTV canvas bot. Generate images with the generate_image "
    "tool. If you are unsure about a workflow label, call "
    "list_image_workflows first and copy the exact label. Prefer a lower "
    "resolution (480P or 720P) unless the user asks for higher quality. Reply "
    "in the user's language."
)

_HIGH_LEVEL_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "generate_image",
            "description": (
                "Generate an image on the ComfyTV canvas and return its URL."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "prompt": {"type": "string", "description": "Image prompt"},
                    "workflow": {
                        "type": "string",
                        "description": (
                            "Workflow label. If unsure, call "
                            "list_image_workflows first and copy the exact label."
                        ),
                    },
                    "resolution": {
                        "type": "string",
                        "description": (
                            "Output resolution tier: 480P, 720P, 1K, 1080P, "
                            "1440P, 2K, 2160P, or 4K. Lower is faster."
                        ),
                    },
                    "aspect_ratio": {
                        "type": "string",
                        "description": "e.g. 1:1, 16:9, 9:16.",
                    },
                },
                "required": ["prompt"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_image_workflows",
            "description": "List available image workflow labels.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]


def _env_base_url() -> str:
    return os.environ.get("LMSTUDIO_BASE_URL", _DEFAULT_BASE_URL).rstrip("/")


def _env_api_key() -> str:
    return os.environ.get("LMSTUDIO_API_KEY", "")


def _env_model() -> str:
    return os.environ.get("LMSTUDIO_MODEL", "")


def _env_unload_on_wait() -> bool:
    return os.environ.get("LMSTUDIO_UNLOAD_ON_WAIT", "1").strip() not in {
        "0", "false", "no", "off",
    }


def _env_high_level() -> bool:
    return os.environ.get("LMSTUDIO_HIGH_LEVEL", "0").strip() in {
        "1", "true", "yes", "on",
    }


def _env_planner_model() -> str:
    return os.environ.get("LMSTUDIO_PLANNER_MODEL", "")


def _env_default_workflow() -> str:
    return os.environ.get(
        "LMSTUDIO_DEFAULT_WORKFLOW", "ComfyUI_Krea2 多LoRA 3.0")


class LmStudioProvider(AgentProvider):
    id = "lmstudio"
    label = "LM Studio"

    def __init__(self, *, base_url: Optional[str] = None,
                 api_key: Optional[str] = None, model: Optional[str] = None,
                 home_dir: Optional[str] = None) -> None:
        self._base_url = (base_url or _env_base_url()).rstrip("/")
        self._api_key = api_key if api_key is not None else _env_api_key()
        self._model = model or _env_model()
        self._home_dir = home_dir
        self._unload_on_wait = _env_unload_on_wait()
        self._high_level = _env_high_level()
        self._planner_model = _env_planner_model()
        self._default_workflow = _env_default_workflow()
        self._ctx = int(os.environ.get("LMSTUDIO_CTX", _DEFAULT_CTX))
        self._probe_cache: Optional[tuple[float, ProviderStatus]] = None

    def capabilities(self) -> ProviderCaps:
        # Each turn is independent; the provider does not resume a CLI session.
        return ProviderCaps(stateful=False, tools="mcp")

    def _api_headers(self) -> dict:
        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"
        return headers

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

    async def _run_lms(self, args: list[str], timeout: float = 120) -> str:
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
        out = stdout.decode("utf-8", "replace").strip()
        err = stderr.decode("utf-8", "replace").strip()
        if process.returncode != 0:
            detail = "\n".join(part for part in (out, err) if part)
            raise RuntimeError(f"lms {' '.join(args)} failed: {detail}")
        return out

    async def _unload_model(self) -> None:
        try:
            await self._run_lms(["unload", "--all"], timeout=60)
        except Exception as e:
            _log.warning("[ComfyTV/lmstudio] model unload failed: %s", e)

    async def _reload_model(self) -> None:
        if not self._model:
            return
        try:
            await self._run_lms([
                "load", self._model,
                "--identifier", self._model,
                "--gpu", os.getenv("LMSTUDIO_GPU", "max"),
                "--context-length", str(self._ctx),
                "--yes",
            ], timeout=600)
        except Exception as e:
            _log.warning("[ComfyTV/lmstudio] model reload failed: %s", e)

    async def _switch_model(self, identifier: str) -> None:
        if not identifier or not self._lms_bin():
            return
        try:
            await self._run_lms(["unload", "--all"], timeout=60)
        except Exception as e:
            _log.warning("[ComfyTV/lmstudio] unload before switch failed: %s", e)
        try:
            await self._run_lms([
                "load", identifier,
                "--identifier", identifier,
                "--gpu", os.getenv("LMSTUDIO_GPU", "max"),
                "--context-length", str(self._ctx),
                "--yes",
            ], timeout=600)
        except Exception as e:
            _log.warning("[ComfyTV/lmstudio] switch to %s failed: %s",
                         identifier, e)

    async def _run_planner(self, session: aiohttp.ClientSession,
                           user_text: str) -> dict:
        await self._switch_model(self._planner_model)
        messages = [
            {
                "role": "system",
                "content": (
                    "You are an image-generation planner. Turn the user's "
                    "request into a concise image prompt and parameters. "
                    "Reply with ONLY a JSON object: "
                    '{"prompt": "...", "workflow": "...", '
                    '"resolution": "...", "aspect_ratio": "..."}. '
                    "resolution must be one of: 480P, 720P, 1K, 1080P, "
                    "1440P, 2K, 2160P, 4K (default 480P). "
                    "aspect_ratio must be one of: 1:1, 16:9, 9:16, 3:4, "
                    "4:3, 3:2, 2:3 (default 1:1). "
                    "If workflow is unknown, set it to empty string."
                ),
            },
            {"role": "user", "content": user_text},
        ]
        data = await self._request_json(
            session, "POST", f"{self._base_url}/chat/completions",
            headers=self._api_headers(),
            json_body={
                "model": self._planner_model,
                "messages": messages,
                "max_tokens": 1024,
                "temperature": 0.7,
            },
            timeout=300,
        )
        content = str(
            ((data.get("choices") or [{}])[0].get("message") or {})
            .get("content") or ""
        )
        start = content.find("{")
        end = content.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                plan = json.loads(content[start:end + 1])
            except Exception:
                plan = {}
        else:
            plan = {}
        return plan if isinstance(plan, dict) else {}

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
        if self._probe_cache and now - self._probe_cache[0] < _PROBE_CACHE_S:
            return self._probe_cache[1]
        try:
            async with aiohttp.ClientSession() as session:
                data = await self._request_json(
                    session, "GET", f"{self._base_url}/models",
                    headers=self._api_headers(), timeout=10,
                )
                models = data.get("data") or []
                if not models:
                    status = ProviderStatus(
                        available=False,
                        detail="LM Studio server is up but no model is loaded",
                    )
                else:
                    if not self._model:
                        self._model = str(models[0].get("id") or "")
                    status = ProviderStatus(
                        available=True, version=self._model, logged_in=True,
                    )
        except Exception as e:
            status = ProviderStatus(available=False, detail=str(e))
        self._probe_cache = (now, status)
        return status

    @staticmethod
    def _build_tools(tools: list[dict]) -> list[dict]:
        def _short(text: object) -> str:
            text = str(text or "").strip()
            if _TOOL_DESC_CAP > 0:
                return text[:_TOOL_DESC_CAP]
            return text

        return [{
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": _short(tool.get("description")),
                "parameters": tool.get("inputSchema")
                or {"type": "object", "properties": {}},
            },
        } for tool in tools]

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

    async def _mcp_list_tools(self, session: aiohttp.ClientSession,
                              endpoint: str) -> list[dict]:
        data = await self._request_json(
            session, "POST", endpoint, headers=self._mcp_headers(),
            json_body={"jsonrpc": "2.0", "id": "tools", "method": "tools/list",
                       "params": {}}, timeout=30,
        )
        return (data.get("result") or {}).get("tools") or []

    async def _mcp_call_tool(self, session: aiohttp.ClientSession,
                             endpoint: str, name: str,
                             arguments: dict) -> str:
        data = await self._request_json(
            session, "POST", endpoint, headers=self._mcp_headers(),
            json_body={"jsonrpc": "2.0", "id": f"call-{name}",
                       "method": "tools/call",
                       "params": {"name": name, "arguments": arguments}},
            timeout=180,
        )
        result = data.get("result") or {}
        if result.get("isError"):
            return "[tool error] " + self._extract_text(result.get("content"))
        return self._extract_text(result.get("content"))

    @staticmethod
    def _parse_mcp_json(text: str) -> dict:
        try:
            data = json.loads(text)
        except Exception:
            return {}
        return data if isinstance(data, dict) else {}

    async def _run_list_image_workflows(
            self, session: aiohttp.ClientSession,
            mcp_endpoint: str, _args: dict) -> str:
        raw = await self._mcp_call_tool(
            session, mcp_endpoint, "list_workflows", {"kind": "image"})
        data = self._parse_mcp_json(raw)
        labels = [
            w.get("label")
            for w in (data.get("workflows") or [])
            if w.get("has_api")
        ]
        return json.dumps({"workflows": labels}, ensure_ascii=False)

    @staticmethod
    def _match_workflow_label(requested: str, labels: list[str]) -> str:
        if not requested:
            return ""
        lowered = requested.lower().strip()
        for label in labels:
            if label == requested or label.lower() == lowered:
                return label
        for label in labels:
            ll = label.lower()
            if lowered in ll or ll in lowered:
                return label
        tokens = [
            t for t in __import__("re").split(r"[^a-z0-9]+", lowered)
            if len(t) >= 4
        ]
        for label in labels:
            label_tokens = set(
                __import__("re").split(r"[^a-z0-9]+", label.lower()))
            if tokens and any(t in label_tokens for t in tokens):
                return label
        return ""

    async def _run_generate_image(
            self, session: aiohttp.ClientSession,
            mcp_endpoint: str, args: dict) -> str:
        prompt = str(args.get("prompt") or "").strip()
        if not prompt:
            return "[error] prompt is required"
        workflow = str(
            args.get("workflow") or self._default_workflow or "").strip()

        # Resolve the workflow label (exact, then fuzzy).
        raw = await self._mcp_call_tool(
            session, mcp_endpoint, "list_workflows", {"kind": "image"})
        data = self._parse_mcp_json(raw)
        workflows = [
            w for w in (data.get("workflows") or []) if w.get("has_api")
        ]
        labels = [w.get("label") for w in workflows]
        matched = self._match_workflow_label(workflow, labels)
        if matched:
            workflow = matched
        else:
            return "[error] workflow is required; available: " + \
                json.dumps(labels, ensure_ascii=False)

        add_args = {
            "node_class": "ComfyTV.ImageStage",
            "workflow": workflow,
            "prompt": prompt,
        }
        widgets: dict = {}
        resolution = str(args.get("resolution") or "")
        if resolution in {
            "480P", "720P", "1K", "1080P", "1440P", "2K", "2160P", "4K",
        }:
            widgets["resolution"] = resolution
        aspect_ratio = str(args.get("aspect_ratio") or "")
        if aspect_ratio in {
            "1:1", "16:9", "9:16", "3:4", "4:3", "3:2", "2:3", "4:5", "5:4",
        }:
            widgets["aspect_ratio"] = aspect_ratio
        if widgets:
            add_args["widgets"] = widgets

        add_raw = await self._mcp_call_tool(
            session, mcp_endpoint, "add_stage", add_args)
        add = self._parse_mcp_json(add_raw)
        uid = str(add.get("uid") or add.get("graph_node_id") or "")
        node_id = str(add.get("graph_node_id") or uid or "")
        if not uid:
            return f"[error] add_stage failed: {add_raw[:300]}"

        # The frontend needs a moment to prepare the freshly-linked workflow
        # before it can run the stage.
        for attempt in range(3):
            await asyncio.sleep(5)
            run_raw = await self._mcp_call_tool(
                session, mcp_endpoint, "run_stage",
                {"node": uid, "project_id": "default"})
            run = self._parse_mcp_json(run_raw)
            if run.get("started"):
                break
            if attempt == 2:
                return f"[error] run_stage failed: {run_raw[:300]}"

        for _ in range(12):
            if self._unload_on_wait:
                await self._unload_model()
            try:
                wait_raw = await self._mcp_call_tool(
                    session, mcp_endpoint, "wait_stage",
                    {"node": uid, "project_id": "default",
                     "timeout_s": 170})
            finally:
                if self._unload_on_wait:
                    await self._reload_model()
            wait = self._parse_mcp_json(wait_raw)
            if wait.get("status") == "done":
                break
            if wait.get("status") == "error":
                return f"[error] generation failed: {wait_raw[:300]}"

        out_args = {"project_id": "default", "latest_only": True}
        if node_id:
            out_args["stage_node_id"] = node_id
        else:
            out_args["stage_uid"] = uid
        out_raw = await self._mcp_call_tool(
            session, mcp_endpoint, "outputs", out_args)
        out = self._parse_mcp_json(out_raw)
        output = out.get("output") or {}
        if not output:
            outputs = out.get("outputs") or []
            if not outputs:
                return f"[error] no outputs found: {out_raw[:300]}"
            output = outputs[0]
        if not output:
            return f"[error] no outputs found: {out_raw[:300]}"
        payload = output.get("payload_json") or {}
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except Exception:
                payload = {}
        if not isinstance(payload, dict):
            payload = {}
        images = payload.get("images") or []
        image_url = str(images[0].get("image_url") or "") if images else ""
        return json.dumps(
            {"image_url": image_url, "stage_uid": uid,
             "stage_node_id": node_id}, ensure_ascii=False)

    async def send(self, turn: TurnRequest, emit: EmitFn,
                   handle: TurnHandle) -> TurnResult:
        if not turn.mcp_endpoint:
            return TurnResult(error="no mcp_endpoint provided")
        if not self._model:
            st = await self.probe()
            if not st.available:
                return TurnResult(error=st.detail or "LM Studio unavailable")

        system_prompt = (
            _HIGH_LEVEL_SYSTEM_PROMPT if self._high_level else _SYSTEM_PROMPT)
        user_text = turn.user_text
        try:
            async with aiohttp.ClientSession() as session:
                if self._high_level and self._planner_model:
                    plan = await self._run_planner(session, turn.user_text)
                    await self._switch_model(self._model)
                    plan_text = json.dumps(plan, ensure_ascii=False) if plan else "{}"
                    user_text = (
                        "Generate the image using this plan: " + plan_text +
                        ". Call generate_image with the plan's prompt, "
                        "workflow and resolution."
                    )
                messages: list[dict] = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_text},
                ]
                if self._high_level:
                    tools = _HIGH_LEVEL_TOOLS
                else:
                    mcp_tools = await self._mcp_list_tools(
                        session, turn.mcp_endpoint)
                    tools = self._build_tools(mcp_tools)
                for _ in range(_MAX_ITERATIONS):
                    if handle.stop_requested:
                        return TurnResult(aborted=True)
                    data = await self._request_json(
                        session, "POST",
                        f"{self._base_url}/chat/completions",
                        headers=self._api_headers(),
                        json_body={
                            "model": self._model,
                            "messages": messages,
                            "tools": tools,
                            "tool_choice": "auto",
                            "max_tokens": 4096,
                            "temperature": 0.2,
                        },
                        timeout=300,
                    )
                    choice = (data.get("choices") or [{}])[0]
                    message = choice.get("message") or {}
                    content = message.get("content") or ""
                    tool_calls = message.get("tool_calls") or []

                    if content:
                        await emit(BotEvent(t="delta", text=str(content)))
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
                        if name == "wait_stage" and "timeout_s" not in args:
                            args["timeout_s"] = 170
                        await emit(BotEvent(
                            t="tool_use", name=name, input=args))
                        if self._high_level and name == "generate_image":
                            result_text = await self._run_generate_image(
                                session, turn.mcp_endpoint, args)
                        elif (self._high_level
                              and name == "list_image_workflows"):
                            result_text = await self._run_list_image_workflows(
                                session, turn.mcp_endpoint, args)
                        else:
                            unload_first = (
                                self._unload_on_wait
                                and name in _LONG_TOOLS)
                            if unload_first:
                                await self._unload_model()
                            try:
                                result_text = await self._mcp_call_tool(
                                    session, turn.mcp_endpoint, name, args)
                            except Exception as e:
                                result_text = (
                                    f"[error] {type(e).__name__}: {e}")
                            finally:
                                if unload_first:
                                    await self._reload_model()
                        result_text = result_text[:_TOOL_RESULT_CAP]
                        await emit(BotEvent(
                            t="tool_result", name=name, text=result_text))
                        messages.append({
                            "role": "tool",
                            "tool_call_id": str(tool_call.get("id") or name),
                            "content": result_text,
                        })
                return TurnResult(error="too many tool-call iterations")
        except Exception as e:
            _log.exception("[ComfyTV/lmstudio] turn failed")
            return TurnResult(error=str(e) or type(e).__name__)

    async def stop(self, handle: TurnHandle) -> None:
        handle.stop_requested = True
