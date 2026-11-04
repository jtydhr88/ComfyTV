import logging
import random
import re
import shutil
from pathlib import Path
from typing import Optional
from urllib.parse import urlsplit, urlunsplit

from ._acp import AcpTransport
from ._acp_provider import SESSION_TIMEOUT_S, AcpLaunch, AcpProvider
from .providers import TurnRequest

_log = logging.getLogger(__name__)

_SSH_HOST_SETTING = "bot-hermes-ssh-host"
_PROFILE_SETTING = "bot-hermes-profile"
_PROFILE_RE = re.compile(r"[a-z0-9][a-z0-9_-]*")
_SSH_OPTIONS = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10"]
TUNNEL_PORTS = (20000, 59999)

SESSION_PREAMBLE = (
    "[ComfyTV] You are working for the user through a ComfyTV chat. Their ComfyTV canvas and "
    "its ComfyUI are reachable only through the `comfytv` MCP tools attached to this session "
    "(named mcp__comfytv__*). They may run on a different machine than you, so 127.0.0.1, "
    "local ComfyUI or ComfyTV services, and skills or memories about your own machine do not "
    "refer to them. Never use the terminal, curl, systemctl or sudo to reach, start or stop "
    "ComfyUI or ComfyTV. Start with server_info and get_canvas; when a task matches a ComfyTV "
    "skill, read it with the comfytv skill tool."
)


def _setting(key: str) -> str:
    try:
        from .. import storage
        return str(storage.get_setting(key) or "").strip()
    except Exception:
        return ""


def ssh_host() -> str:
    return _setting(_SSH_HOST_SETTING)


def profile() -> str:
    return _setting(_PROFILE_SETTING)


def hermes_args(*args: str) -> list[str]:
    name = profile()
    return ["-p", name, *args] if name else list(args)


def chat_cwd(chat_id: str) -> Path:
    try:
        import folder_paths
        user = Path(folder_paths.get_user_directory())
    except Exception:
        user = Path.home()
    safe = re.sub(r"[^A-Za-z0-9_-]", "_", chat_id or "default")[:64] or "default"
    path = user / "comfytv" / "bot-home-hermes" / "chats" / safe
    path.mkdir(parents=True, exist_ok=True)
    return path


def tunnel(mcp_endpoint: str, remote_port: int) -> tuple[list[str], str]:
    if not mcp_endpoint:
        return [], ""
    parts = urlsplit(mcp_endpoint)
    forward = ["-o", "ExitOnForwardFailure=yes", "-R", f"{remote_port}:127.0.0.1:{parts.port}"]
    return forward, urlunsplit(parts._replace(netloc=f"127.0.0.1:{remote_port}"))


def model_options_from(models: object) -> list[dict]:
    if not isinstance(models, dict):
        return []
    rows: list[dict] = []
    for item in models.get("availableModels") or []:
        model_id = str(item.get("modelId") or "")
        if model_id:
            rows.append({"value": model_id, "label": str(item.get("name") or model_id),
                         "group": model_id.split(":", 1)[0] if ":" in model_id else ""})
    return rows


class HermesProvider(AcpProvider):
    id = "hermes"
    label = "Hermes"
    stop_reason_errors = {
        "max_tokens": "Hermes stopped at the output token limit for this turn.",
        "refusal": "Hermes declined to continue this turn.",
        "max_turn_requests": "Hermes stopped after the maximum number of model requests.",
    }

    def _command(self) -> tuple[Optional[list[str]], str]:
        if profile() and not _PROFILE_RE.fullmatch(profile()):
            return None, f"The Hermes profile name {profile()!r} is not valid; use lowercase letters, digits, - and _."
        host = ssh_host()
        if host:
            ssh = shutil.which("ssh")
            if not ssh:
                return None, "ssh was not found on PATH; it is needed to reach Hermes on " + host
            return [ssh, host], ""
        found = shutil.which("hermes")
        if found:
            return [found], ""
        return None, ("hermes was not found on PATH. Install Hermes Agent on this machine, "
                      "or set the Hermes SSH host to use it on another machine.")

    def _version_argv(self, argv: list[str]) -> list[str]:
        if ssh_host():
            return [*argv[:-1], *_SSH_OPTIONS, argv[-1], f"sh -lc 'hermes {' '.join(hermes_args('--version'))}'"]
        return [*argv, *hermes_args("--version")]

    async def _launch(self, turn: TurnRequest, argv: list[str]) -> tuple[Optional[AcpLaunch], str]:
        cwd = str(chat_cwd(turn.chat_id))
        if not ssh_host():
            return AcpLaunch(argv=[*argv, *hermes_args("acp")], cwd=cwd, session_cwd=cwd,
                             mcp_url=turn.mcp_endpoint), ""
        forward, mcp_url = tunnel(turn.mcp_endpoint, random.randint(*TUNNEL_PORTS))
        return AcpLaunch(argv=[*argv[:-1], "-T", *_SSH_OPTIONS, *forward, argv[-1],
                               f"sh -lc 'exec hermes {' '.join(hermes_args('acp'))}'"],
                         cwd=cwd, session_cwd=".", mcp_url=mcp_url), ""

    def _prompt_blocks(self, turn: TurnRequest, image_supported: bool) -> tuple[list[dict], str]:
        blocks, error = super()._prompt_blocks(turn, image_supported)
        if blocks and not turn.resume_token:
            blocks.insert(0, {"type": "text", "text": SESSION_PREAMBLE})
        return blocks, error

    def _catalog_from(self, opened: dict) -> list[dict]:
        return model_options_from(opened.get("models"))

    async def _select_model(self, transport: AcpTransport, session_id: str,
                            turn: TurnRequest, opened: dict, launch: AcpLaunch) -> str:
        current = str((opened.get("models") or {}).get("currentModelId") or "")
        if turn.model and turn.model != current:
            await transport.request("session/set_model", {
                "sessionId": session_id, "modelId": turn.model,
            }, timeout=SESSION_TIMEOUT_S)
            await transport.request("session/resume", {
                "sessionId": session_id, "cwd": launch.session_cwd, "mcpServers": launch.mcp_servers(),
            }, timeout=SESSION_TIMEOUT_S)
        _log.info("[ComfyTV/hermes] chat=%s model=%s", turn.chat_id, turn.model or "(Hermes default)")
        return ""
