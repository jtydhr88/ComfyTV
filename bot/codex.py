import asyncio
import base64
import json
import os
import shutil
import sys
import time
from pathlib import Path
from typing import Optional

try:
    import tomllib
except ImportError:
    tomllib = None

from ._cli_common import (
    PROBE_CACHE_S,
    TOOL_RESULT_CAP,
    base_spawn_env,
    kill_process_tree,
    normalize_usage,
    run_cli_turn,
    run_command,
)
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

_MCP_TOOL_TIMEOUT_SEC = 600

_MEDIA_EXT = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def resolve_codex_command() -> Optional[list[str]]:
    if sys.platform == "win32":
        exe = shutil.which("codex.exe")
        if exe:
            return [exe]
    found = shutil.which("codex")
    if found and sys.platform == "win32" and Path(found).suffix.lower() == ".cmd":
        cli_js = Path(found).parent / "node_modules" / "@openai" / "codex" / "bin" / "codex.js"
        node = shutil.which("node")
        if cli_js.exists() and node:
            return [node, str(cli_js)]
    if found:
        return [found]
    candidates = [
        "/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex",
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


def read_codex_config() -> dict:
    cfg = Path.home() / ".codex" / "config.toml"
    if tomllib is None or not cfg.exists():
        return {}
    try:
        return tomllib.loads(cfg.read_text(encoding="utf-8", errors="ignore"))
    except (OSError, tomllib.TOMLDecodeError):
        return {}


def write_agent_instructions(home: str, text: str) -> Path:
    path = Path(home) / "AGENTS.md"
    try:
        existing = path.read_text(encoding="utf-8") if path.exists() else ""
    except OSError:
        existing = ""
    if existing != text:
        path.write_text(text, encoding="utf-8")
    return path


def _flatten_mcp_content(content) -> str:
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


def _tool_error_text(item: dict) -> str:
    error = item.get("error")
    if isinstance(error, dict):
        for key in ("message", "error", "detail"):
            value = error.get(key)
            if value:
                return str(value)
        return json.dumps(error, ensure_ascii=False)
    if error:
        return str(error)

    result = item.get("result")
    if isinstance(result, dict):
        text = _flatten_mcp_content(result.get("content"))
        if text:
            return text
        for key in ("message", "error", "detail"):
            value = result.get(key)
            if value:
                return str(value)
        return json.dumps(result, ensure_ascii=False)
    if result:
        return str(result)
    return "tool failed"


class _CodexStreamParser:
    def __init__(self) -> None:
        self.session_id: Optional[str] = None
        self.result_error: str = ""
        self.result_seen = False
        self.usage: Optional[dict] = None
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
            self.usage = normalize_usage(data.get("usage")) or self.usage
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
            return self._parse_item(data.get("item") or {})
        return []

    def _parse_item(self, item: dict) -> list[BotEvent]:
        item_type = item.get("type")
        item_id = str(item.get("id") or "")

        if item_type in ("agent_message", "reasoning"):
            text = str(item.get("text") or "")
            emitted = self._text_emitted.get(item_id, 0)
            delta = text[emitted:] if len(text) >= emitted else text
            self._text_emitted[item_id] = len(text)
            return [BotEvent(t="delta" if item_type == "agent_message" else "thinking", text=delta)] if delta else []

        if item_type == "mcp_tool_call":
            name = str(item.get("tool") or "")
            arguments = item.get("arguments") or {}
            status = item.get("status")
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
                return [BotEvent(t="tool_use", name=name, input=arguments,
                                 id=item_id)]
            if item.get("error") or status == "failed":
                return [BotEvent(
                    t="tool_result",
                    name=name or self._tool_names.get(item_id, ""),
                    text=_tool_error_text(item)[:TOOL_RESULT_CAP],
                    id=item_id,
                    is_error=True,
                )]
            result = item.get("result") or {}
            text = _flatten_mcp_content(result.get("content"))
            if not text and result.get("structured_content") is not None:
                text = json.dumps(result["structured_content"], ensure_ascii=False)
            return [BotEvent(
                t="tool_result",
                name=name or self._tool_names.get(item_id, ""),
                text=text[:TOOL_RESULT_CAP],
                id=item_id,
            )]

        return []


class CodexCodeProvider(AgentProvider):
    id = "codex"
    label = "Codex"

    def __init__(self, *, host: AgentHost, home_dir: str) -> None:
        self._host = host
        self._home_dir = home_dir
        self._probe_cache: Optional[tuple[float, ProviderStatus]] = None

    def capabilities(self) -> ProviderCaps:
        return ProviderCaps(stateful=True, tools="mcp", attachments=True)

    def _resolve_home(self) -> str:
        os.makedirs(self._home_dir, exist_ok=True)
        write_agent_instructions(self._home_dir, self._host.codex_instructions)
        return self._home_dir

    def _detect_logged_in(self) -> bool:
        try:
            if (Path.home() / ".codex" / "auth.json").stat().st_size > 2:
                return True
        except OSError:
            pass
        providers = read_codex_config().get("model_providers") or {}
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
        if self._probe_cache and now - self._probe_cache[0] < PROBE_CACHE_S:
            return self._probe_cache[1]
        argv = resolve_codex_command()
        if not argv:
            status = ProviderStatus(available=False, detail="codex executable not found")
            self._probe_cache = (now, status)
            return status
        try:
            _, out, _ = await run_command([*argv, "--version"], timeout=15, env=base_spawn_env())
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

    async def list_models(self) -> list[str]:
        def read() -> list[str]:
            model = read_codex_config().get("model")
            return [str(model)] if model else []
        return await asyncio.to_thread(read)

    def _mcp_lockdown_args(self) -> list[str]:
        args: list[str] = []
        servers = read_codex_config().get("mcp_servers") or {}
        if not isinstance(servers, dict):
            return args
        for server_id in servers:
            if server_id != self._host.name:
                args += ["-c", f"mcp_servers.{server_id}.enabled=false"]
        return args

    def _write_attachment(self, home: str, data: str, media_type: str,
                          index: int) -> Optional[str]:
        try:
            raw = base64.b64decode(data)
        except ValueError:
            return None
        if not raw:
            return None
        out_dir = os.path.join(home, "attachments")
        os.makedirs(out_dir, exist_ok=True)
        ext = _MEDIA_EXT.get(media_type, ".bin")
        path = os.path.join(
            out_dir, f"att-{int(time.time() * 1000)}-{index}{ext}")
        with open(path, "wb") as fh:
            fh.write(raw)
        return path

    def _build_argv(self, turn: TurnRequest, home: str) -> tuple[list[str], list[str]]:
        argv = resolve_codex_command()
        if not argv:
            raise RuntimeError("codex executable not found")

        flags = ["--json", "--skip-git-repo-check"]
        if turn.mcp_endpoint:
            flags += [
                "-c", f'mcp_servers.{self._host.name}.url="{turn.mcp_endpoint}"',
                "-c", f"mcp_servers.{self._host.name}.required=true",
                "-c", f"mcp_servers.{self._host.name}.tool_timeout_sec={_MCP_TOOL_TIMEOUT_SEC}",
            ]
        flags += self._mcp_lockdown_args()
        flags += ["-c", "features.shell_tool=false"]
        flags += ["-c", 'web_search="disabled"']
        flags += ["-c", 'approvals_reviewer="auto_review"']
        if turn.model:
            flags += ["-m", turn.model]

        temp_files: list[str] = []
        for i, att in enumerate(turn.attachments):
            data = att.get("data")
            if not data:
                continue
            path = self._write_attachment(
                home, data, str(att.get("media_type") or "image/jpeg"), i)
            if path:
                temp_files.append(path)
                flags += ["-i", path]

        argv = argv + ["exec"]
        if turn.resume_token:
            argv += ["--approve-for-me", "resume"]
        else:
            argv += ["--approve-for-me"]
        argv += flags + ["--"]
        if turn.resume_token:
            argv.append(turn.resume_token)
        argv.append(turn.user_text)
        return argv, temp_files

    async def send(self, turn: TurnRequest, emit: EmitFn,
                   handle: TurnHandle) -> TurnResult:
        home = self._resolve_home()
        argv, temp_files = self._build_argv(turn, home)
        try:
            return await run_cli_turn(
                argv,
                cwd=home,
                env=base_spawn_env(),
                emit=emit,
                handle=handle,
                parser=_CodexStreamParser(),
                exe_label="codex",
            )
        finally:
            for path in temp_files:
                try:
                    os.remove(path)
                except OSError:
                    pass

    async def stop(self, handle: TurnHandle) -> None:
        await kill_process_tree(handle)
