import logging
import random
import re
import shutil
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import urlsplit, urlunsplit

from ._acp import AcpTransport
from ._acp_provider import SESSION_TIMEOUT_S, AcpLaunch, AcpProvider
from .agent_host import AgentHost
from .providers import TurnRequest

_log = logging.getLogger(__name__)

_PROFILE_RE = re.compile(r"[a-z0-9][a-z0-9_-]*")
_SSH_OPTIONS = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10"]
TUNNEL_PORTS = (20000, 59999)

def chat_cwd(home: str, chat_id: str) -> Path:
    safe = re.sub(r"[^A-Za-z0-9_-]", "_", chat_id or "default")[:64] or "default"
    path = Path(home) / "chats" / safe
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

    def __init__(self, *, host: AgentHost, home_dir: str, ssh_host: Callable[[], str],
                 profile: Callable[[], str]) -> None:
        super().__init__(host=host, home_dir=home_dir)
        self._ssh_host = ssh_host
        self._profile = profile

    def _hermes_args(self, *args: str) -> list[str]:
        name = self._profile().strip()
        return ["-p", name, *args] if name else list(args)

    def _command(self) -> tuple[Optional[list[str]], str]:
        name = self._profile().strip()
        if name and not _PROFILE_RE.fullmatch(name):
            return None, f"The Hermes profile name {name!r} is not valid; use lowercase letters, digits, - and _."
        host = self._ssh_host().strip()
        if host.startswith("-"):
            return None, f"The Hermes SSH host {host!r} is not valid; it cannot start with -."
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
        if self._ssh_host().strip():
            return [*argv[:-1], *_SSH_OPTIONS, argv[-1], f"sh -lc 'hermes {' '.join(self._hermes_args('--version'))}'"]
        return [*argv, *self._hermes_args("--version")]

    async def _launch(self, turn: TurnRequest, argv: list[str]) -> tuple[Optional[AcpLaunch], str]:
        cwd = str(chat_cwd(self._home_dir, turn.chat_id))
        if not self._ssh_host().strip():
            return AcpLaunch(argv=[*argv, *self._hermes_args("acp")], cwd=cwd, session_cwd=cwd,
                             mcp_url=turn.mcp_endpoint), ""
        forward, mcp_url = tunnel(turn.mcp_endpoint, random.randint(*TUNNEL_PORTS))
        return AcpLaunch(argv=[*argv[:-1], "-T", *_SSH_OPTIONS, *forward, argv[-1],
                               f"sh -lc 'exec hermes {' '.join(self._hermes_args('acp'))}'"],
                         cwd=cwd, session_cwd=".", mcp_url=mcp_url), ""

    def _prompt_blocks(self, turn: TurnRequest, image_supported: bool) -> tuple[list[dict], str]:
        blocks, error = super()._prompt_blocks(turn, image_supported)
        if blocks and not turn.resume_token:
            blocks.insert(0, {"type": "text", "text": self._host.session_preamble})
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
                "sessionId": session_id, "cwd": launch.session_cwd, "mcpServers": self._mcp_servers(launch),
            }, timeout=SESSION_TIMEOUT_S)
        _log.info("[%s/hermes] chat=%s model=%s", self._host.label, turn.chat_id, turn.model or "(Hermes default)")
        return ""
