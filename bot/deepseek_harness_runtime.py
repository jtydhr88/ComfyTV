import asyncio
import json
import os
import re
import shutil
import sys
from pathlib import Path
from typing import Optional

from ._cli_common import base_spawn_env

MAC_APP_COMMAND = Path("/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh")

BOT_PROFILE = "comfytv-acp"
TEMPLATE_PROFILE = "acp"
PERMISSION_PRESET = "comfytv-mcp-only"
PROFILE_BOOT_TIMEOUT_S = 60.0

DISABLED_ENTRY_IDS = (
    "tool-bash", "tool-pwsh", "tool-jobs", "tool-fs", "tool-fs-search",
    "tool-skill", "skill", "skill-filesystem", "skill-badge",
    "tool-subagent", "tool-subagent-fork", "tool-subagent-control",
    "tool-subagent-list-agents", "subagent", "subagent-spawn-in-process",
    "subagent-fork-in-process",
    "tool-workflow", "workflow-ptc", "ptc-runtime",
    "tool-todo", "tool-goal", "tool-ralph",
    "tool-web", "web-search-deepseek",
    "tool-plugin-manager", "plugin-manager",
    "user-questions", "plan-mode", "agent-instructions",
)


def _argv_for(path: Path) -> list[str]:
    if sys.platform == "win32" and path.suffix.lower() in (".cmd", ".bat"):
        return ["cmd.exe", "/d", "/s", "/c", str(path)]
    return [str(path)]


def resolve_command() -> tuple[Optional[list[str]], str]:
    found = shutil.which("dsh")
    if found:
        return _argv_for(Path(found)), ""
    if sys.platform == "darwin" and MAC_APP_COMMAND.is_file():
        return [str(MAC_APP_COMMAND)], ""
    return None, ("dsh was not found on PATH. Use \"Manage dsh Command…\" in the "
                  "DeepSeek Harness app, or `npm install -g @deepseek-ai/dsh`.")


def profile_dir() -> Path:
    home = os.environ.get("DSH_HOME")
    return (Path(home).expanduser() if home else Path.home() / ".dsh") / "profiles" / BOT_PROFILE


def chat_cwd(chat_id: str) -> Path:
    try:
        import folder_paths
        user = Path(folder_paths.get_user_directory())
    except Exception:
        user = Path.home()
    safe = re.sub(r"[^A-Za-z0-9_-]", "_", chat_id or "default")[:64] or "default"
    path = user / "comfytv" / "bot-home-deepseek-harness" / "chats" / safe
    path.mkdir(parents=True, exist_ok=True)
    return path


def overlay_entries(route: Optional[tuple[str, str]]) -> list[dict]:
    entries: list[dict] = [{
        "id": "permission",
        "config": {
            "presets": {PERMISSION_PRESET: {"sandbox": "danger-full-access",
                                            "approval": "never"}},
            "defaultPreset": PERMISSION_PRESET,
        },
    }]
    entries += [{"id": entry_id, "disabled": True} for entry_id in DISABLED_ENTRY_IDS]
    if route is not None:
        entries.append({"id": "acp", "config": {"provider": route[0], "model": route[1]}})
    return entries


def write_turn_overlay(cwd: Path, route: Optional[tuple[str, str]]) -> Path:
    target = cwd / "comfytv-turn-overlay.yml"
    target.write_text(json.dumps(overlay_entries(route), indent=2), encoding="utf-8")
    return target


async def ensure_profile(argv: list[str]) -> str:
    if (profile_dir() / "package.json").is_file():
        return ""
    try:
        proc = await asyncio.create_subprocess_exec(
            *argv, "--profile", BOT_PROFILE, "--from-default-profile", TEMPLATE_PROFILE,
            "--dump-config",
            stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE,
            env=base_spawn_env())
        _, err = await asyncio.wait_for(proc.communicate(), timeout=PROFILE_BOOT_TIMEOUT_S)
    except (OSError, asyncio.TimeoutError) as e:
        return f"could not create the {BOT_PROFILE} profile: {e}"
    if (profile_dir() / "package.json").is_file():
        return ""
    detail = (err or b"").decode("utf-8", "replace").strip()
    return f"could not create the {BOT_PROFILE} profile" + (f": {detail[-400:]}" if detail else "")
