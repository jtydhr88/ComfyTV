import asyncio
import json
import logging
import os
import subprocess
import sys
import time
from typing import Optional

from .providers import BotEvent, EmitFn, TurnHandle, TurnResult

_log = logging.getLogger(__name__)

STREAM_LIMIT = 10 * 1024 * 1024
TURN_IDLE_TIMEOUT_S = 600
TURN_MAX_S = 4 * 3600
TOOL_RESULT_CAP = 4000
PROBE_CACHE_S = 60
MCP_TOOL_TIMEOUT_MS = 180_000

CORE_MCP_TOOLS = [
    "server_info",
    "stage_catalog",
    "list_workflows",
    "get_canvas",
    "get_stage",
    "outputs",
    "assets",
    "add_stage",
    "set_stage",
    "connect_stages",
    "run_stage",
    "wait_stage",
    "cancel_stage",
    "remove_stage",
    "view_image",
    "media_frame",
    "pick_output",
    "node_info",
    "workflow_create",
    "workflow_get",
    "workflow_edit",
    "stage_params",
    "graph_get",
    "graph_edit",
    "graph_run",
    "canvas_command",
    "canvas_focus",
]

COMFY_MCP_ALLOWED_TOOLS = [
    "server_info",
    "nodes",
    "validate_workflow",
    "search_models",
    "search_templates",
    "get_template",
    "list_workflow_slots",
    "list_workflow_notes",
    "workflow_deps",
    "node_dependencies",
    "system_stats",
    "which",
]


def resolve_comfy_mcp_argv(command: str) -> list[str]:
    import shlex
    import shutil
    command = (command or "").strip()
    if command:
        try:
            argv = shlex.split(command, posix=(sys.platform != "win32"))
        except ValueError:
            return []
        return [a.strip('"') for a in argv if a]
    found = shutil.which("comfy-mcp")
    return [found] if found else []


def base_spawn_env() -> dict:
    env = dict(os.environ)
    env.setdefault("MCP_TOOL_TIMEOUT", str(MCP_TOOL_TIMEOUT_MS))
    return env


def tool_result_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                parts.append(str(item.get("text") or ""))
        return "\n".join(parts)
    return ""


class CliStreamParser:
    def __init__(self, *, text_from_assistant: bool = False) -> None:
        self.session_id: Optional[str] = None
        self.result_error: str = ""
        self.result_seen = False
        self._text_from_assistant = text_from_assistant
        self._saw_stream_delta = False
        self._tool_names: dict[str, str] = {}
        self._emitted_tools: set[str] = set()

    def parse_line(self, line: str) -> list[BotEvent]:
        line = line.strip()
        if not line:
            return []
        try:
            data = json.loads(line)
        except ValueError:
            return []
        if not isinstance(data, dict):
            return []
        t = data.get("type")
        if t == "system" and data.get("subtype") == "init":
            self.session_id = data.get("session_id") or self.session_id
            return []
        if t == "stream_event":
            return self._parse_stream_event(data.get("event") or {})
        if t == "assistant":
            return self._parse_assistant(data.get("message") or {})
        if t == "user":
            return self._parse_user(data.get("message") or {})
        if t == "result":
            self.result_seen = True
            self.session_id = data.get("session_id") or self.session_id
            if data.get("is_error"):
                self.result_error = str(data.get("result") or data.get("subtype") or "error")
            return []
        return []

    def _parse_stream_event(self, ev: dict) -> list[BotEvent]:
        if ev.get("type") != "content_block_delta":
            return []
        delta = ev.get("delta") or {}
        if delta.get("type") == "text_delta" and delta.get("text"):
            self._saw_stream_delta = True
            return [BotEvent(t="delta", text=str(delta["text"]))]
        return []

    def _parse_assistant(self, msg: dict) -> list[BotEvent]:
        events: list[BotEvent] = []
        for block in msg.get("content") or []:
            if not isinstance(block, dict):
                continue
            btype = block.get("type")
            if btype == "text" and block.get("text"):
                if self._text_from_assistant and not self._saw_stream_delta:
                    events.append(BotEvent(t="delta", text=str(block["text"])))
                continue
            if btype != "tool_use":
                continue
            block_id = str(block.get("id") or "")
            if block_id and block_id in self._emitted_tools:
                continue
            name = str(block.get("name") or "")
            if block_id:
                self._emitted_tools.add(block_id)
                self._tool_names[block_id] = name
            raw_input = block.get("input")
            events.append(BotEvent(
                t="tool_use",
                name=name,
                input=raw_input if isinstance(raw_input, dict) else {},
            ))
        return events

    def _parse_user(self, msg: dict) -> list[BotEvent]:
        events: list[BotEvent] = []
        content = msg.get("content")
        if not isinstance(content, list):
            return []
        for block in content:
            if not isinstance(block, dict) or block.get("type") != "tool_result":
                continue
            name = self._tool_names.get(str(block.get("tool_use_id") or ""), "")
            events.append(BotEvent(
                t="tool_result",
                name=name,
                text=tool_result_text(block.get("content"))[:TOOL_RESULT_CAP],
            ))
        return events


async def kill_process_tree(handle: TurnHandle) -> None:
    handle.stop_requested = True
    proc = handle.process
    if proc is None or proc.returncode is not None:
        return
    try:
        if sys.platform == "win32":
            await asyncio.create_subprocess_exec(
                "taskkill", "/F", "/T", "/PID", str(proc.pid),
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
        else:
            import signal
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
    except (OSError, ProcessLookupError):
        pass
    try:
        await asyncio.wait_for(proc.wait(), timeout=10)
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except (OSError, ProcessLookupError):
            pass


async def run_cli_turn(
    argv: list[str],
    *,
    cwd: str,
    env: dict,
    emit: EmitFn,
    handle: TurnHandle,
    parser: CliStreamParser,
    stdin_payload: Optional[str] = None,
    exe_label: str = "cli",
) -> TurnResult:
    kwargs: dict = {
        "stdout": asyncio.subprocess.PIPE,
        "stderr": asyncio.subprocess.PIPE,
        "stdin": asyncio.subprocess.PIPE if stdin_payload is not None
                 else asyncio.subprocess.DEVNULL,
        "cwd": cwd,
        "limit": STREAM_LIMIT,
        "env": env,
    }
    if sys.platform == "win32":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kwargs["start_new_session"] = True
    proc = await asyncio.create_subprocess_exec(*argv, **kwargs)
    handle.process = proc
    if stdin_payload is not None:
        try:
            proc.stdin.write(stdin_payload.encode("utf-8"))
            await proc.stdin.drain()
            proc.stdin.close()
        except (OSError, ConnectionError) as e:
            _log.warning("[ComfyTV/bot] stdin write failed: %s", e)

    stderr_buf: list[bytes] = []

    async def _drain_stderr() -> None:
        while True:
            chunk = await proc.stderr.read(65536)
            if not chunk:
                return
            if sum(len(c) for c in stderr_buf) < 65536:
                stderr_buf.append(chunk)

    stderr_task = asyncio.create_task(_drain_stderr())
    timeout_reason = ""
    try:
        started = time.monotonic()
        last_activity = started
        while True:
            now = time.monotonic()
            if now - started >= TURN_MAX_S:
                timeout_reason = f"turn exceeded the {TURN_MAX_S // 3600}h hard cap"
                raise asyncio.TimeoutError()
            if now - last_activity >= TURN_IDLE_TIMEOUT_S:
                timeout_reason = (
                    f"no activity for {TURN_IDLE_TIMEOUT_S // 60} minutes")
                raise asyncio.TimeoutError()
            wait = min(TURN_MAX_S - (now - started),
                       TURN_IDLE_TIMEOUT_S - (now - last_activity))
            try:
                line = await asyncio.wait_for(proc.stdout.readline(), timeout=wait)
            except asyncio.TimeoutError:
                continue
            except ValueError:
                _log.warning("[ComfyTV/bot] oversized stream line skipped")
                last_activity = time.monotonic()
                continue
            if not line:
                break
            last_activity = time.monotonic()
            for ev in parser.parse_line(line.decode("utf-8", "replace")):
                await emit(ev)
        await proc.wait()
    except asyncio.TimeoutError:
        await kill_process_tree(handle)
        return TurnResult(resume_token=parser.session_id,
                          error=f"turn timed out ({timeout_reason})",
                          aborted=True)
    finally:
        stderr_task.cancel()

    if handle.stop_requested:
        return TurnResult(resume_token=parser.session_id, aborted=True)
    if parser.result_error:
        return TurnResult(resume_token=parser.session_id, error=parser.result_error)
    if proc.returncode not in (0, None) or not parser.result_seen:
        err = b"".join(stderr_buf).decode("utf-8", "replace").strip()
        return TurnResult(
            resume_token=parser.session_id,
            error=err[-800:] or f"{exe_label} exited with code {proc.returncode}",
        )
    return TurnResult(resume_token=parser.session_id)
