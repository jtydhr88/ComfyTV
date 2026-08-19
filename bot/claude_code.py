import asyncio
import json
import os
import shutil
import sys
import time
from pathlib import Path
from typing import Optional

from ._cli_common import (
    CliStreamParser,
    PROBE_CACHE_S,
    base_spawn_env,
    kill_process_tree,
    run_cli_turn,
    tool_result_text,
)
from .providers import (
    AgentProvider,
    EmitFn,
    ProviderCaps,
    ProviderStatus,
    TurnHandle,
    TurnRequest,
    TurnResult,
)

_tool_result_text = tool_result_text


class _StreamParser(CliStreamParser):
    def __init__(self) -> None:
        super().__init__(text_from_assistant=False)


def spawn_env() -> dict:
    return base_spawn_env()


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
        candidates = [
            Path.home() / ".local" / "bin" / "claude",
            Path.home() / ".npm-global" / "bin" / "claude",
            Path("/usr/local/bin/claude"),
            Path("/opt/homebrew/bin/claude"),
        ]
        nvm_versions = Path.home() / ".nvm" / "versions" / "node"
        if nvm_versions.is_dir():
            for node_dir in sorted(nvm_versions.iterdir(), reverse=True):
                candidates.append(node_dir / "bin" / "claude")
        for candidate in candidates:
            if candidate.is_file() and os.access(candidate, os.X_OK):
                found = str(candidate)
                break
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


class ClaudeCodeProvider(AgentProvider):
    id = "claude-code"
    label = "Claude Code"

    def __init__(self, *, home_dir: Optional[str] = None) -> None:
        self._home_dir = home_dir
        self._probe_cache: Optional[tuple[float, ProviderStatus]] = None

    def capabilities(self) -> ProviderCaps:
        return ProviderCaps(stateful=True, tools="mcp", attachments=True)

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
        if self._probe_cache and now - self._probe_cache[0] < PROBE_CACHE_S:
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

    async def list_models(self) -> list[str]:
        return ["sonnet", "opus", "haiku"]

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
        if turn.model:
            argv += ["--model", turn.model]
        if turn.mcp_endpoint:
            servers: dict = {"comfytv": {"type": "http", "url": turn.mcp_endpoint}}
            if turn.comfy_mcp_argv:
                servers["comfy"] = {
                    "type": "stdio",
                    "command": turn.comfy_mcp_argv[0],
                    "args": list(turn.comfy_mcp_argv[1:]),
                }
            argv += ["--mcp-config", json.dumps({"mcpServers": servers})]
        if turn.allowed_tools:
            argv += ["--allowedTools", ",".join(turn.allowed_tools)]
        if turn.resume_token:
            argv += ["--resume", turn.resume_token]
        return argv

    async def send(self, turn: TurnRequest, emit: EmitFn,
                   handle: TurnHandle) -> TurnResult:
        return await run_cli_turn(
            self._build_argv(turn),
            cwd=self._resolve_home(),
            env=spawn_env(),
            emit=emit,
            handle=handle,
            parser=_StreamParser(),
            stdin_payload=build_stream_input(turn) if turn.attachments else None,
            exe_label="claude",
        )

    async def stop(self, handle: TurnHandle) -> None:
        await kill_process_tree(handle)
