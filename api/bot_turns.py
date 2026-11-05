import json
import logging
import re

from server import PromptServer

from .. import storage
from ..bot._cli_common import resolve_comfy_mcp_argv
from ..bot.turns import TurnRunner
from . import agent_events
from ._common import spawn

_log = logging.getLogger(__name__)


def _broadcast(event: str, payload: dict) -> None:
    try:
        PromptServer.instance.send_sync("comfytv-bot", {"event": event, **payload})
    except Exception:
        _log.exception("[ComfyTV/bot] broadcast failed")


def _mcp_endpoint(chat_id: str) -> str:
    port = getattr(PromptServer.instance, "port", None) or 8188
    return f"http://127.0.0.1:{port}/comfytv/mcp?bot_chat={chat_id}"


def _comfy_mcp_argv() -> list[str]:
    try:
        if not storage.get_setting("bot-enable-comfy-mcp"):
            return []
        command = str(storage.get_setting("bot-comfy-mcp-command") or "")
    except Exception:
        _log.exception("[ComfyTV/bot] comfy-mcp settings lookup failed")
        return []
    argv = resolve_comfy_mcp_argv(command)
    if not argv:
        _log.warning("[ComfyTV/bot] bot-enable-comfy-mcp is on but no "
                     "comfy-mcp executable was found — set "
                     "bot-comfy-mcp-command or install comfy-mcp on PATH")
    return argv


def _provider_model(provider_id: str) -> str:
    from ..settings import SETTINGS_SPEC
    key = f"bot-model-{provider_id}"
    if key not in SETTINGS_SPEC:
        return ""
    try:
        return str(storage.get_setting(key) or "").strip()
    except Exception:
        _log.exception("[ComfyTV/bot] model setting lookup failed")
        return ""


def _blocks_text(blocks: list[dict]) -> str:
    parts = []
    for b in blocks:
        kind = b.get("type")
        if kind == "text":
            parts.append(str(b.get("text") or ""))
        elif kind in ("image", "video", "audio"):
            parts.append(f"[attached {kind}: asset #{b.get('asset_id')} "
                         f"{str(b.get('url') or '')}]")
        elif kind == "notice" and b.get("text"):
            parts.append(f"[notice: {b.get('text')}]")
    return "\n".join(p for p in parts if p.strip()).strip()


_WRITE_TOOL_RE = re.compile(
    r"\b(add_stage|set_stage|connect_stages|run_stage|remove_stage|graph_edit|"
    r"arrange_canvas|workflow_edit|workflow_create|asset_edit|entries)\b")


def _live_canvas_summary() -> str:
    try:
        from .canvas_state import get_canvas_state
        snap = get_canvas_state(None)
    except Exception:
        return ""
    if not snap.get("available"):
        return ""
    stages = snap.get("stages") or []
    names = [str(s.get("title") or s.get("stage_class") or s.get("graph_node_id") or "?")
             for s in stages]
    shown = ", ".join(names[:8]) + (f" +{len(names) - 8}" if len(names) > 8 else "")
    return f"Live canvas right now: {len(stages)} stage(s){' — ' + shown if shown else ''}."


def unverified_write_notice(blocks: list[dict], canvas_summary: str = "") -> dict | None:
    if any(b.get("type") == "tool_use" for b in blocks):
        return None
    text = "\n".join(str(b.get("text") or "") for b in blocks if b.get("type") == "text")
    if not _WRITE_TOOL_RE.search(text):
        return None
    msg = ("This turn made no tool calls, so nothing it describes was actually "
           "done — the canvas, workflows and library are unchanged. Treat any "
           "node ids or results above as unverified.")
    if canvas_summary:
        msg += " " + canvas_summary
    return {"type": "notice", "level": "warn", "text": msg}


def _blocks(content: str | None) -> list:
    try:
        blocks = json.loads(content or "[]")
    except ValueError:
        return []
    return blocks if isinstance(blocks, list) else []


class _Store:
    @staticmethod
    def get_chat(chat_id: str) -> dict | None:
        return storage.get_bot_chat(chat_id)

    @staticmethod
    def list_messages(chat_id: str) -> list[dict]:
        return [{**row, "blocks": _blocks(row.get("content"))} for row in storage.list_bot_messages(chat_id)]

    @staticmethod
    def create_message(*, chat_id: str, role: str, blocks: list[dict], status: str,
                       parent_id: str | None) -> dict:
        return storage.create_bot_message(chat_id=chat_id, role=role, content=json.dumps(blocks),
                                          status=status, parent_id=parent_id)

    @staticmethod
    def update_message(chat_id: str, message_id: str, **fields) -> dict | None:
        if "blocks" in fields:
            fields["content"] = json.dumps(fields.pop("blocks"))
        return storage.update_bot_message(message_id, **fields)

    @staticmethod
    def update_chat(chat_id: str, **fields) -> dict | None:
        return storage.update_bot_chat(chat_id, **fields)


def _turn_done(chat_id: str, message_id: str, blocks: list[dict], error: str, usage: dict | None) -> None:
    if error and not any(b.get("type") == "text" for b in blocks):
        agent_events.message_delta(chat_id, message_id, f"⚠ {error}")
    agent_events.message_done(chat_id, message_id, usage)


RUNNER = TurnRunner(
    label="ComfyTV", mcp_name="comfytv", store=_Store(),
    broadcast=lambda event, payload: _broadcast(event, payload), spawn=spawn,
    mcp_endpoint=_mcp_endpoint, comfy_mcp_argv=lambda: _comfy_mcp_argv(), provider_model=_provider_model,
    replay_text=_blocks_text, finish_notice=lambda blocks: unverified_write_notice(blocks, _live_canvas_summary()),
    fallback_title="New chat", on_event=agent_events.from_bot_event, on_done=_turn_done,
)
ACTIVE_TURNS = RUNNER.active
QUEUED = RUNNER.queued
