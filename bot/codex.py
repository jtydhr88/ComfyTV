import asyncio
import base64
import json
import logging
import os
import shutil
import signal
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
_TURN_TIMEOUT_S = 1800
_TOOL_RESULT_CAP = 4000
_PROBE_CACHE_S = 60
_MCP_TOOL_TIMEOUT_MS = 180_000

_MEDIA_EXT = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def spawn_env() -> dict:
    env = dict(os.environ)
    env.setdefault("MCP_TOOL_TIMEOUT", str(_MCP_TOOL_TIMEOUT_MS))
    return env


def resolve_codex_command() -> Optional[list[str]]:
    """Locate the Codex CLI, mirroring how the Claude provider finds ``claude``."""
    if sys.platform == "win32":
        exe = shutil.which("codex.exe")
        if exe:
            return [exe]
    found = shutil.which("codex")
    if found:
        return [found]

    # Known install locations, including the bundled CLI inside the desktop app.
    candidates = [
        "/Applications/ChatGPT.app/Contents/Resources/codex",
        str(Path.home() / ".local" / "bin" / "codex"),
        str(Path.home() / ".codex" / "bin" / "codex"),
    ]
    for candidate in candidates:
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return [candidate]

    if sys.platform == "win32":
        for candidate in candidates:
            if os.path.isfile(candidate + ".exe"):
                return [candidate + ".exe"]
    return None


def _mcp_result_text(content) -> str:
    """Flatten MCP ``content`` blocks into a single text string."""
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict):
                if block.get("type") == "text" or "text" in block:
                    parts.append(str(block.get("text") or ""))
                else:
                    parts.append(json.dumps(block, ensure_ascii=False))
            elif isinstance(block, str):
                parts.append(block)
            else:
                parts.append(json.dumps(block, ensure_ascii=False))
        return "\n".join(parts)
    return json.dumps(content, ensure_ascii=False)


class _StreamParser:
    """Parse Codex ``codex exec --json`` JSONL into ComfyTV BotEvents."""

    def __init__(self) -> None:
        self.session_id: Optional[str] = None
        self.result_error: str = ""
        self.result_seen = False
        self._text_emitted: dict[str, int] = {}
        self._tool_names: dict[str, str] = {}
        self._emitted_tool_use: set[str] = set()

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

        event_type = data.get("type")
        if event_type == "thread.started":
            self.session_id = str(data.get("thread_id") or self.session_id or "")
            return []
        if event_type == "turn.completed":
            self.result_seen = True
            return []
        if event_type == "turn.failed":
            self.result_seen = True
            err = (data.get("error") or {}).get("message") or "turn failed"
            self.result_error = str(err)
            return []
        if event_type == "error":
            self.result_error = str(data.get("message") or "error")
            return []
        if event_type in ("item.started", "item.updated", "item.completed"):
            return self._parse_item(data.get("item") or {}, event_type)
        return []

    def _parse_item(self, item: dict, event_type: str) -> list[BotEvent]:
        item_type = item.get("type")
        item_id = str(item.get("id") or "")

        if item_type == "agent_message":
            text = str(item.get("text") or "")
            emitted = self._text_emitted.get(item_id, 0)
            delta = text[emitted:] if len(text) >= emitted else text
            self._text_emitted[item_id] = len(text)
            return [BotEvent(t="delta", text=delta)] if delta else []

        if item_type == "mcp_tool_call":
            name = str(item.get("tool") or "")
            arguments = item.get("arguments") or {}
            status = item.get("status")

            # A tool call is surfaced once when we first observe it (normally on
            # item.started), and its result is surfaced when it reaches a terminal
            # state (item.completed / item.updated with a result or error).
            is_terminal = status in ("completed", "failed") or bool(
                item.get("result") or item.get("error"))
            if not is_terminal:
                if item_id and item_id in self._emitted_tool_use:
                    return []
                if item_id:
                    self._emitted_tool_use.add(item_id)
                    self._tool_names[item_id] = name
                if not isinstance(arguments, dict):
                    arguments = {}
                return [BotEvent(t="tool_use", name=name, input=arguments)]

            if item.get("error") or status == "failed":
                message = (item.get("error") or {}).get("message") or "tool failed"
                return [BotEvent(
                    t="tool_result",
                    name=name or self._tool_names.get(item_id, ""),
                    text=str(message)[:_TOOL_RESULT_CAP],
                )]

            result = item.get("result") or {}
            text = _mcp_result_text(result.get("content"))
            if not text and result.get("structured_content") is not None:
                text = json.dumps(result["structured_content"], ensure_ascii=False)
            return [BotEvent(
                t="tool_result",
                name=name or self._tool_names.get(item_id, ""),
                text=text[:_TOOL_RESULT_CAP],
            )]

        return []


class CodexCodeProvider(AgentProvider):
    id = "codex"
    label = "Codex"

    def __init__(self, *, home_dir: Optional[str] = None) -> None:
        self._home_dir = home_dir
        self._probe_cache: Optional[tuple[float, ProviderStatus]] = None

    def capabilities(self) -> ProviderCaps:
        return ProviderCaps(stateful=True, tools="mcp")

    def _resolve_home(self) -> str:
        if self._home_dir:
            os.makedirs(self._home_dir, exist_ok=True)
            home = self._home_dir
        else:
            try:
                import folder_paths
                user = folder_paths.get_user_directory()
            except Exception:
                user = os.path.expanduser("~")
            home = os.path.join(user, "comfytv", "bot-home")
            os.makedirs(home, exist_ok=True)
            self._home_dir = home
        self._ensure_bot_instructions(home)
        return home

    def _ensure_bot_instructions(self, home: str) -> None:
        """Write an AGENTS.md so Codex always has the ComfyTV tool guidance."""
        path = os.path.join(home, "AGENTS.md")
        content = (
            "# ComfyTV Bot (Codex provider)\n\n"
            "You are the ComfyTV canvas bot. In this Codex session ComfyTV is "
            "exposed through MCP RESOURCES, not callable tools. Drive the "
            "canvas with read_mcp_resource against the `comfytv` server:\n\n"
            "- Read `comfytv://help` to get the full tool catalog (names, "
            "descriptions, input schemas).\n"
            "- Read `comfytv://tool/<name>` to see one tool's schema.\n"
            "- Read `comfytv://call/<name>` to call a tool with no arguments.\n"
            "- Read `comfytv://call/<name>?<url-encoded-json-object>` to call "
            "a tool with arguments.\n\n"
            "Example: read_mcp_resource(server=\"comfytv\", "
            "uri=\"comfytv://call/server_info\") returns the ComfyTV version "
            "and project count. Common tools: server_info, projects, "
            "get_canvas, outputs, add_stage, set_stage, connect_stages, "
            "run_stage, wait_stage, view_image.\n\n"
            "Do not use shell, file, or web tools. Canvas writes require an "
            "open ComfyTV browser tab; if a write fails with a tab/timeout "
            "error, report it clearly instead of retrying endlessly.\n"
        )
        try:
            existing = ""
            if os.path.exists(path):
                with open(path, encoding="utf-8") as fh:
                    existing = fh.read()
            if existing != content:
                with open(path, "w", encoding="utf-8") as fh:
                    fh.write(content)
        except OSError:
            _log.warning("[ComfyTV/bot] could not write AGENTS.md in %s", home)

    def _detect_logged_in(self) -> bool:
        try:
            import tomllib
        except Exception:
            tomllib = None
        home = Path.home()
        auth = home / ".codex" / "auth.json"
        if auth.exists() and auth.stat().st_size > 2:
            return True
        cfg = home / ".codex" / "config.toml"
        if not cfg.exists() or tomllib is None:
            return False
        try:
            data = tomllib.loads(cfg.read_text(encoding="utf-8", errors="ignore"))
        except Exception:
            return False
        providers = data.get("model_providers") or {}
        if not isinstance(providers, dict):
            return False
        credential_keys = {
            "api_key", "experimental_bearer_token", "bearer_token", "access_token",
        }
        for provider in providers.values():
            if isinstance(provider, dict) and credential_keys.intersection(provider):
                return True
        return False

    async def probe(self) -> ProviderStatus:
        now = time.monotonic()
        if self._probe_cache and now - self._probe_cache[0] < _PROBE_CACHE_S:
            return self._probe_cache[1]
        argv = resolve_codex_command()
        if not argv:
            status = ProviderStatus(available=False, detail="codex executable not found")
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
        status = ProviderStatus(
            available=True,
            version=version,
            logged_in=self._detect_logged_in(),
        )
        self._probe_cache = (now, status)
        return status

    def _mcp_lockdown_args(self) -> list[str]:
        """Disable every user-configured MCP server except ``comfytv``."""
        args: list[str] = []
        try:
            import tomllib
        except Exception:
            return args
        cfg = Path.home() / ".codex" / "config.toml"
        if not cfg.exists():
            return args
        try:
            data = tomllib.loads(cfg.read_text(encoding="utf-8", errors="ignore"))
        except Exception:
            return args
        servers = data.get("mcp_servers") or {}
        if not isinstance(servers, dict):
            return args
        for server_id in servers:
            if server_id != "comfytv":
                args += ["-c", f"mcp_servers.{server_id}.enabled=false"]
        return args

    def _write_attachment(self, home: str, data: str, media_type: str) -> Optional[str]:
        try:
            raw = base64.b64decode(data)
        except Exception:
            return None
        if not raw:
            return None
        out_dir = os.path.join(home, "attachments")
        os.makedirs(out_dir, exist_ok=True)
        ext = _MEDIA_EXT.get(media_type, ".bin")
        path = os.path.join(out_dir, f"att-{int(time.time() * 1000)}{ext}")
        with open(path, "wb") as fh:
            fh.write(raw)
        return path

    def _build_argv(self, turn: TurnRequest, home: str) -> tuple[list[str], list[str]]:
        argv = resolve_codex_command()
        if not argv:
            raise RuntimeError("codex executable not found")

        # Note: sessions must be persisted (no --ephemeral) so that the
        # thread_id returned by `thread.started` can be resumed on the next turn.
        flags = ["--json", "--skip-git-repo-check"]

        if turn.mcp_endpoint:
            flags += [
                "-c", 'mcp_servers.comfytv.url="%s"' % turn.mcp_endpoint,
                "-c", "mcp_servers.comfytv.required=true",
            ]
        flags += self._mcp_lockdown_args()
        # The ComfyTV bot is only meant to drive the canvas: no local shell, no web.
        flags += ["-c", "features.shell_tool=false"]
        flags += ["-c", 'web_search="disabled"']
        if not turn.resume_token:
            # `codex exec resume` does not accept --sandbox; apply it only on the
            # first turn and let subsequent resumed turns inherit the session.
            flags += ["--sandbox", "read-only"]

        temp_files: list[str] = []
        for att in turn.attachments:
            data = att.get("data")
            if not data:
                continue
            path = self._write_attachment(
                home, data, str(att.get("media_type") or "image/jpeg"))
            if path:
                temp_files.append(path)
                flags += ["-i", path]

        argv = argv + ["exec"]
        if turn.resume_token:
            argv += ["resume"]
        argv += flags
        if turn.resume_token:
            argv.append(turn.resume_token)
        argv.append(turn.user_text)
        return argv, temp_files

    async def send(self, turn: TurnRequest, emit: EmitFn,
                   handle: TurnHandle) -> TurnResult:
        home = self._resolve_home()
        argv, temp_files = self._build_argv(turn, home)

        kwargs: dict = {
            "stdout": asyncio.subprocess.PIPE,
            "stderr": asyncio.subprocess.PIPE,
            "stdin": asyncio.subprocess.DEVNULL,
            "cwd": home,
            "limit": _STREAM_LIMIT,
            "env": spawn_env(),
        }
        if sys.platform == "win32":
            kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
        else:
            kwargs["start_new_session"] = True

        proc = await asyncio.create_subprocess_exec(*argv, **kwargs)
        handle.process = proc
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
        try:
            deadline = time.monotonic() + _TURN_TIMEOUT_S
            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise asyncio.TimeoutError()
                try:
                    line = await asyncio.wait_for(
                        proc.stdout.readline(), timeout=remaining)
                except ValueError:
                    _log.warning("[ComfyTV/bot] oversized stream line skipped")
                    continue
                if not line:
                    break
                for ev in parser.parse_line(line.decode("utf-8", "replace")):
                    await emit(ev)
            await proc.wait()
        except asyncio.TimeoutError:
            await self.stop(handle)
            return TurnResult(
                resume_token=parser.session_id, error="turn timed out", aborted=True)
        finally:
            stderr_task.cancel()
            for path in temp_files:
                try:
                    os.remove(path)
                except OSError:
                    pass

        if handle.stop_requested:
            return TurnResult(resume_token=parser.session_id, aborted=True)
        if parser.result_error:
            return TurnResult(
                resume_token=parser.session_id, error=parser.result_error)
        if proc.returncode not in (0, None) or not parser.result_seen:
            err = b"".join(stderr_buf).decode("utf-8", "replace").strip()
            return TurnResult(
                resume_token=parser.session_id,
                error=err[-800:] or f"codex exited with code {proc.returncode}",
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
