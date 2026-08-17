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
    MCP_TOOL_TIMEOUT_MS,
    PROBE_CACHE_S,
    base_spawn_env,
    kill_process_tree,
    run_cli_turn,
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

_EXCLUDED_CORE_TOOLS = [
    "run_shell_command",
    "write_file",
    "replace",
    "edit",
    "read_file",
    "read_many_files",
    "list_directory",
    "glob",
    "search_file_content",
    "grep",
    "web_fetch",
    "google_web_search",
    "web_search",
    "save_memory",
    "write_todos",
]

_CORE_MCP_TOOLS = [
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
]

_LLM_REQUEST_TIMEOUT_MS = 180_000


class _QwenStreamParser(CliStreamParser):
    def __init__(self) -> None:
        super().__init__(text_from_assistant=True)


def spawn_env() -> dict:
    env = base_spawn_env()
    if sys.platform != "win32":
        nvm_bin = Path.home() / ".nvm" / "versions" / "node"
        if nvm_bin.exists():
            node_bins = sorted(nvm_bin.glob("*/bin"))
            if node_bins:
                latest_bin = str(node_bins[-1])
                current_path = env.get("PATH", "")
                if latest_bin not in current_path:
                    env["PATH"] = f"{latest_bin}{os.pathsep}{current_path}"
    return env


def resolve_qwen_command() -> Optional[list[str]]:
    exe = shutil.which("qwen.exe") if sys.platform == "win32" else None
    if exe:
        return [exe]
    found = shutil.which("qwen")
    if found:
        p = Path(found)
        if p.suffix.lower() == ".exe" or sys.platform != "win32":
            return [str(p)]
        cli_js = p.parent / "node_modules" / "@qwen-code" / "qwen-code" / "dist" / "index.js"
        node = shutil.which("node")
        if cli_js.exists() and node:
            return [node, str(cli_js)]
        cmd = p.with_suffix(".cmd")
        if cmd.exists():
            return ["cmd.exe", "/d", "/s", "/c", str(cmd)]
        return [str(p)]
    home = Path.home()
    nvm_dir = home / ".nvm"
    if nvm_dir.exists():
        for node_ver in sorted(nvm_dir.glob("versions/node/v*"), reverse=True):
            qwen_path = node_ver / "bin" / "qwen"
            if qwen_path.exists():
                return [str(qwen_path)]
    for npm_prefix in ("/usr/local", str(home / ".npm-global")):
        qwen_path = Path(npm_prefix) / "bin" / "qwen"
        if qwen_path.exists():
            return [str(qwen_path)]
    return None


def write_project_settings(home_dir: str, mcp_endpoint: str) -> Path:
    path = Path(home_dir) / ".qwen" / "settings.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    data: dict = {}
    if path.exists():
        try:
            loaded = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                data = loaded
        except (OSError, ValueError):
            data = {}
    servers = data.get("mcpServers")
    if not isinstance(servers, dict):
        servers = {}
    servers["comfytv"] = {
        "httpUrl": mcp_endpoint,
        "trust": True,
        "timeout": MCP_TOOL_TIMEOUT_MS,
        "includeTools": list(_CORE_MCP_TOOLS),
    }
    data["mcpServers"] = servers
    data["allowMCPServers"] = ["comfytv"]
    data["excludeTools"] = list(_EXCLUDED_CORE_TOOLS)
    generator = data.get("contentGenerator")
    if not isinstance(generator, dict):
        generator = {}
    generator.setdefault("timeout", _LLM_REQUEST_TIMEOUT_MS)
    data["contentGenerator"] = generator
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return path


class QwenCodeProvider(AgentProvider):
    id = "qwen-code"
    label = "Qwen Code"

    def __init__(self, *, home_dir: Optional[str] = None) -> None:
        self._home_dir = home_dir
        self._probe_cache: Optional[tuple[float, ProviderStatus]] = None

    def capabilities(self) -> ProviderCaps:
        return ProviderCaps(stateful=True, tools="mcp", attachments=False)

    def _resolve_home(self) -> str:
        if self._home_dir:
            os.makedirs(self._home_dir, exist_ok=True)
            return self._home_dir
        try:
            import folder_paths
            user = folder_paths.get_user_directory()
        except Exception:
            user = os.path.expanduser("~")
        d = os.path.join(user, "comfytv", "bot-home-qwen")
        os.makedirs(d, exist_ok=True)
        self._home_dir = d
        return d

    async def probe(self) -> ProviderStatus:
        now = time.monotonic()
        if self._probe_cache and now - self._probe_cache[0] < PROBE_CACHE_S:
            return self._probe_cache[1]
        argv = resolve_qwen_command()
        if not argv:
            status = ProviderStatus(available=False, detail="qwen executable not found")
            self._probe_cache = (now, status)
            return status
        try:
            proc = await asyncio.create_subprocess_exec(
                *argv, "--version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=spawn_env(),
            )
            out, _ = await asyncio.wait_for(proc.communicate(), timeout=15)
            version = (out or b"").decode("utf-8", "replace").strip()
        except (OSError, asyncio.TimeoutError) as e:
            status = ProviderStatus(available=False, detail=f"version check failed: {e}")
            self._probe_cache = (now, status)
            return status
        creds_dir = Path.home() / ".qwen"
        logged_in = True if creds_dir.exists() else None
        status = ProviderStatus(available=True, version=version, logged_in=logged_in)
        self._probe_cache = (now, status)
        return status

    def _build_argv(self, turn: TurnRequest) -> list[str]:
        argv = resolve_qwen_command()
        if not argv:
            raise RuntimeError("qwen executable not found")
        argv = argv + [
            "-p", turn.user_text,
            "--output-format", "stream-json",
            "-y",
        ]
        if turn.resume_token:
            argv += ["--resume", turn.resume_token]
        return argv

    async def send(self, turn: TurnRequest, emit: EmitFn,
                   handle: TurnHandle) -> TurnResult:
        home = self._resolve_home()
        if turn.mcp_endpoint:
            await asyncio.to_thread(write_project_settings, home, turn.mcp_endpoint)
        return await run_cli_turn(
            self._build_argv(turn),
            cwd=home,
            env=spawn_env(),
            emit=emit,
            handle=handle,
            parser=_QwenStreamParser(),
            exe_label="qwen",
        )

    async def stop(self, handle: TurnHandle) -> None:
        await kill_process_tree(handle)
