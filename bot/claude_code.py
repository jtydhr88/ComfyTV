import asyncio
import json
import logging
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional

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

_STREAM_LIMIT = 10 * 1024 * 1024
_TURN_IDLE_TIMEOUT_S = 600
_TURN_MAX_S = 4 * 3600
_TOOL_RESULT_CAP = 4000
_PROBE_CACHE_S = 60
_MCP_TOOL_TIMEOUT_MS = 180_000


def spawn_env() -> dict:
    env = dict(os.environ)
    env.setdefault("MCP_TOOL_TIMEOUT", str(_MCP_TOOL_TIMEOUT_MS))
    return env


def build_stream_input(turn: TurnRequest) -> str:
    content: list[dict] = []
    for att in turn.attachments:
        data = att.get("data")
        if not data:
            continue
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": att.get("media_type") or "image/jpeg",
                "data": data,
            },
        })
    content.append({"type": "text", "text": turn.user_text})
    envelope = {
        "type": "user",
        "message": {"role": "user", "content": content},
    }
    return json.dumps(envelope) + "\n"


def resolve_claude_command() -> Optional[list[str]]:
    exe = shutil.which("claude.exe") if sys.platform == "win32" else None
    if exe:
        return [exe]
    found = shutil.which("claude")
    if not found:
        return None
    p = Path(found)
    if p.suffix.lower() == ".exe" or sys.platform != "win32":
        return [str(p)]
    for candidate in (p.with_suffix(".cmd"), p):
        native = candidate.parent / "node_modules" / "@anthropic-ai" / "claude-code" / "bin" / "claude.exe"
        if native.exists():
            return [str(native)]
    cli_js = p.parent / "node_modules" / "@anthropic-ai" / "claude-code" / "cli.js"
    node = shutil.which("node")
    if cli_js.exists() and node:
        return [node, str(cli_js)]
    cmd = p.with_suffix(".cmd")
    if cmd.exists():
        return ["cmd.exe", "/d", "/s", "/c", str(cmd)]
    return None


class _StreamParser:
    def __init__(self) -> None:
        self.session_id: Optional[str] = None
        self.result_error: str = ""
        self.result_seen = False
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
            return [BotEvent(t="delta", text=str(delta["text"]))]
        return []

    def _parse_assistant(self, msg: dict) -> list[BotEvent]:
        events: list[BotEvent] = []
        for block in msg.get("content") or []:
            if not isinstance(block, dict) or block.get("type") != "tool_use":
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
                text=_tool_result_text(block.get("content"))[:_TOOL_RESULT_CAP],
            ))
        return events


def _tool_result_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                parts.append(str(item.get("text") or ""))
        return "\n".join(parts)
    return ""


class ClaudeCodeProvider(AgentProvider):
    id = "claude-code"
    label = "Claude Code"

    def __init__(self, *, home_dir: Optional[str] = None) -> None:
        self._home_dir = home_dir
        self._probe_cache: Optional[tuple[float, ProviderStatus]] = None

    def capabilities(self) -> ProviderCaps:
        return ProviderCaps(stateful=True, tools="mcp")

    def _resolve_home(self) -> str:
        if self._home_dir:
            os.makedirs(self._home_dir, exist_ok=True)
            return self._home_dir
        try:
            import folder_paths
            user = folder_paths.get_user_directory()
        except Exception:
            user = os.path.expanduser("~")
        d = os.path.join(user, "comfytv", "bot-home")
        os.makedirs(d, exist_ok=True)
        self._home_dir = d
        return d

    async def probe(self) -> ProviderStatus:
        now = time.monotonic()
        if self._probe_cache and now - self._probe_cache[0] < _PROBE_CACHE_S:
            return self._probe_cache[1]
        argv = resolve_claude_command()
        if not argv:
            status = ProviderStatus(available=False, detail="claude executable not found")
            self._probe_cache = (now, status)
            return status
        try:
            proc = await asyncio.create_subprocess_exec(
                *argv, "--version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            out, _ = await asyncio.wait_for(proc.communicate(), timeout=15)
            version = (out or b"").decode("utf-8", "replace").strip()
        except (OSError, asyncio.TimeoutError) as e:
            status = ProviderStatus(available=False, detail=f"version check failed: {e}")
            self._probe_cache = (now, status)
            return status
        creds = Path.home() / ".claude" / ".credentials.json"
        logged_in = True if creds.exists() else None
        status = ProviderStatus(available=True, version=version, logged_in=logged_in)
        self._probe_cache = (now, status)
        return status

    def _build_argv(self, turn: TurnRequest) -> list[str]:
        argv = resolve_claude_command()
        if not argv:
            raise RuntimeError("claude executable not found")
        if turn.attachments:
            argv = argv + ["-p", "--input-format", "stream-json"]
        else:
            argv = argv + ["-p", turn.user_text]
        argv += [
            "--output-format", "stream-json",
            "--include-partial-messages",
            "--verbose",
            "--strict-mcp-config",
        ]
        if turn.mcp_endpoint:
            mcp = {"mcpServers": {"comfytv": {"type": "http", "url": turn.mcp_endpoint}}}
            argv += ["--mcp-config", json.dumps(mcp)]
        if turn.allowed_tools:
            argv += ["--allowedTools", ",".join(turn.allowed_tools)]
        if turn.resume_token:
            argv += ["--resume", turn.resume_token]
        return argv

    async def send(self, turn: TurnRequest, emit: EmitFn,
                   handle: TurnHandle) -> TurnResult:
        argv = self._build_argv(turn)
        kwargs: dict = {
            "stdout": asyncio.subprocess.PIPE,
            "stderr": asyncio.subprocess.PIPE,
            "stdin": asyncio.subprocess.PIPE if turn.attachments
                     else asyncio.subprocess.DEVNULL,
            "cwd": self._resolve_home(),
            "limit": _STREAM_LIMIT,
            "env": spawn_env(),
        }
        if sys.platform == "win32":
            kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
        else:
            kwargs["start_new_session"] = True
        proc = await asyncio.create_subprocess_exec(*argv, **kwargs)
        handle.process = proc
        if turn.attachments:
            try:
                proc.stdin.write(build_stream_input(turn).encode("utf-8"))
                await proc.stdin.drain()
                proc.stdin.close()
            except (OSError, ConnectionError) as e:
                _log.warning("[ComfyTV/bot] stdin write failed: %s", e)

        parser = _StreamParser()
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
                if now - started >= _TURN_MAX_S:
                    timeout_reason = (
                        f"turn exceeded the {_TURN_MAX_S // 3600}h hard cap")
                    raise asyncio.TimeoutError()
                if now - last_activity >= _TURN_IDLE_TIMEOUT_S:
                    timeout_reason = (
                        f"no activity for {_TURN_IDLE_TIMEOUT_S // 60} minutes")
                    raise asyncio.TimeoutError()
                wait = min(_TURN_MAX_S - (now - started),
                           _TURN_IDLE_TIMEOUT_S - (now - last_activity))
                try:
                    line = await asyncio.wait_for(proc.stdout.readline(),
                                                  timeout=wait)
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
            await self.stop(handle)
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
                error=err[-800:] or f"claude exited with code {proc.returncode}",
            )
        return TurnResult(resume_token=parser.session_id)

    async def stop(self, handle: TurnHandle) -> None:
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
