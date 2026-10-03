import asyncio
import json
import re
import logging
import time
from typing import Optional

from server import PromptServer

from .. import storage
from ..bot import BotEvent, TurnHandle, TurnRequest, get_provider
from . import agent_events

_log = logging.getLogger(__name__)

_ALLOWED_TOOLS = ["mcp__comfytv__*"]
_PERSIST_INTERVAL_S = 3.0
_TITLE_MAX = 48


class _TurnState:
    def __init__(self, handle: TurnHandle, message_id: str) -> None:
        self.handle = handle
        self.message_id = message_id
        self.blocks: list[dict] = []
        self.last_persist = 0.0
        self.tool_started: dict[str, float] = {}


ACTIVE_TURNS: dict[str, _TurnState] = {}

QUEUED: dict[str, list[dict]] = {}


def _broadcast(event: str, payload: dict) -> None:
    try:
        PromptServer.instance.send_sync("comfytv-bot", {"event": event, **payload})
    except Exception:
        _log.exception("[ComfyTV/bot] broadcast failed")


def _mcp_endpoint(chat_id: str) -> str:
    port = getattr(PromptServer.instance, "port", None) or 8188
    return f"http://127.0.0.1:{port}/comfytv/mcp?bot_chat={chat_id}"


def _comfy_mcp_argv() -> list[str]:
    from ..bot._cli_common import resolve_comfy_mcp_argv
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


def _allowed_tools(comfy_mcp_argv: list[str]) -> list[str]:
    from ..bot._cli_common import COMFY_MCP_ALLOWED_TOOLS
    tools = list(_ALLOWED_TOOLS)
    if comfy_mcp_argv:
        tools += [f"mcp__comfy__{t}" for t in COMFY_MCP_ALLOWED_TOOLS]
    return tools


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


def _blocks_text(content: str) -> str:
    try:
        blocks = json.loads(content or "[]")
    except Exception:
        return ""
    if not isinstance(blocks, list):
        return ""
    parts = []
    for b in blocks:
        if not isinstance(b, dict):
            continue
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


def unverified_write_notice(blocks: list[dict], canvas_summary: str = "", *,
                            tool_telemetry_complete: bool = True) -> dict | None:
    if not tool_telemetry_complete:
        return {"type": "notice", "level": "warn", "text": (
            "Tool telemetry is incomplete; tools may have executed without recorded receipts. "
            "Canvas, workflow and library changes cannot be verified from this turn. "
            "Check the live state before retrying any write.")}
    if any(b.get("type") == "tool_use" or (
            b.get("type") == "notice" and b.get("detail") in {
                "hermes.tool.started", "hermes.tool.completed"}) for b in blocks):
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


def _replay_history(chat_id: str, current_message_id: str) -> list[dict]:
    rows = storage.list_bot_messages(chat_id)
    current = next((r for r in rows if r["id"] == current_message_id), None)
    skip = {current_message_id}
    if current and current.get("parent_id"):
        skip.add(current["parent_id"])
    history = []
    for row in rows:
        if row["id"] in skip or row["role"] not in ("user", "assistant"):
            continue
        text = _blocks_text(row.get("content") or "")
        if text:
            history.append({"role": row["role"], "text": text})
    return history


def _derive_title(text: str) -> str:
    line = " ".join(text.split())
    return line[:_TITLE_MAX] if line else "New chat"


def _apply_event(state: _TurnState, ev: BotEvent) -> Optional[dict]:
    if ev.t == "notice":
        block = {"type": "notice", "level": "error" if ev.is_error else "info", "text": ev.text}
        if ev.detail:
            block["detail"] = ev.detail
        state.blocks.append(block)
        return {"event": "turn_notice", **block}
    if ev.t == "delta":
        if state.blocks and state.blocks[-1].get("type") == "text":
            state.blocks[-1]["text"] += ev.text
        else:
            state.blocks.append({"type": "text", "text": ev.text})
        return {"event": "turn_delta", "text": ev.text}
    if ev.t == "tool_use":
        block = {"type": "tool_use", "name": ev.name, "input": ev.input or {}}
        payload = {"event": "turn_tool_use", "name": ev.name,
                   "input": ev.input or {}}
        if ev.id:
            block["id"] = payload["id"] = ev.id
            state.tool_started[ev.id] = time.monotonic()
        state.blocks.append(block)
        return payload
    if ev.t == "tool_result":
        tool_status = "error" if ev.is_error else "success"
        block = {"type": "tool_result", "name": ev.name, "text": ev.text,
                 "status": tool_status}
        payload = {"event": "turn_tool_result", "name": ev.name,
                   "text": ev.text, "status": tool_status}
        if ev.id:
            block["id"] = payload["id"] = ev.id
            started = state.tool_started.pop(ev.id, None)
            if started is not None:
                duration_ms = int((time.monotonic() - started) * 1000)
                block["duration_ms"] = payload["duration_ms"] = duration_ms
        state.blocks.append(block)
        return payload
    return None


async def _run_turn(chat: dict, text: str, state: _TurnState, *,
                    provider_text: str | None = None,
                    attachments: list[dict] | None = None,
                    attachment_manifest: dict | None = None,
                    task_input_json: str | None = None,
                    provider_options_json: str | None = None) -> None:
    chat_id = chat["id"]
    provider = get_provider(chat["provider"])
    # The agent panel needs the POST ack before the first delta reaches it.
    await asyncio.sleep(0.1)

    async def emit(ev: BotEvent) -> None:
        if ev.t == "session":
            if not ev.id:
                return
            if storage.update_bot_message(state.message_id,
                                          resume_token_after=ev.id) is None:
                raise RuntimeError("bot message no longer exists")
            if storage.update_bot_chat(chat_id, resume_token=ev.id) is None:
                raise RuntimeError("bot chat no longer exists")
            return
        payload = _apply_event(state, ev)
        if payload is None:
            return
        payload.update({"chat_id": chat_id, "message_id": state.message_id})
        _broadcast(payload.pop("event"), payload)
        agent_events.from_bot_event(chat_id, state.message_id, ev, payload)
        now = time.monotonic()
        if ev.t in ("tool_use", "tool_result") or now - state.last_persist > _PERSIST_INTERVAL_S:
            state.last_persist = now
            storage.update_bot_message(
                state.message_id, content=json.dumps(state.blocks))

    history = None
    if not provider.capabilities().stateful:
        try:
            history = _replay_history(chat_id, state.message_id)
        except Exception:
            _log.exception("[ComfyTV/bot] history replay failed for %s", chat_id)

    comfy_mcp_argv = _comfy_mcp_argv()
    try:
        if task_input_json:
            from .task_context_store import get_store
            get_store().dispatch(json.loads(task_input_json)["context_ref"])
        if attachment_manifest and not task_input_json:
            from .bot_send import validate_image_ref_context
            validate_image_ref_context(storage.get_bot_chat(chat_id) or chat, {}, text)
        result = await provider.send(
            TurnRequest(
                chat_id=chat_id,
                user_text=provider_text if provider_text is not None else text,
                resume_token=chat.get("resume_token"),
                history=history,
                mcp_endpoint=_mcp_endpoint(chat_id),
                allowed_tools=_allowed_tools(comfy_mcp_argv),
                attachments=attachments or [],
                attachment_manifest=attachment_manifest or {},
                task_input_json=task_input_json,
                model=(json.loads(provider_options_json)["model"] if provider_options_json else _provider_model(chat["provider"])),
                config_fingerprint=(json.loads(provider_options_json).get("config_fingerprint", "") if provider_options_json else ""),
                comfy_mcp_argv=comfy_mcp_argv,
                message_id=state.message_id,
                interaction_binding=getattr(state.handle, "_interaction_binding", None),
            ),
            emit,
            state.handle,
        )
    except Exception as e:
        _log.exception("[ComfyTV/bot] turn failed for chat %s", chat_id)
        result = None
        error = str(e) or type(e).__name__
        status = "error"
    else:
        error = result.error
        status = "aborted" if result.aborted else ("error" if error else "done")

    if task_input_json:
        remote = getattr(state.handle, "_hermes", {}) or {}
        if not remote.get("submitted") or remote.get("terminal"):
            from .task_context_store import get_store
            get_store().release(json.loads(task_input_json)["context_ref"]["id"])
    from . import hermes_interactions
    hermes_interactions.INTERACTIONS.invalidate(state.handle)
    ACTIVE_TURNS.pop(chat_id, None)
    from . import bot_asks
    bot_asks.cancel_chat_asks(chat_id)
    token = result.resume_token if result else None
    usage = result.usage if result else None
    if error:
        state.blocks.append({"type": "notice", "level": "error", "text": error})
    elif status == "done":
        notice = unverified_write_notice(
            state.blocks, _live_canvas_summary(),
            tool_telemetry_complete=result.tool_telemetry_complete if result is not None else False)
        if notice:
            state.blocks.append(notice)
    storage.update_bot_message(
        state.message_id,
        content=json.dumps(state.blocks),
        status=status,
        resume_token_after=token,
        usage=usage,
    )
    updates: dict = {"resume_token": token} if token else {}
    if not (chat.get("title") or "").strip():
        updates["title"] = _derive_title(text)
    if updates:
        storage.update_bot_chat(chat_id, **updates)
    _broadcast("turn_done", {
        "chat_id": chat_id,
        "message_id": state.message_id,
        "status": status,
        "error": error,
        "title": updates.get("title"),
        "usage": usage,
    })
    if error and not any(b.get("type") == "text" for b in state.blocks):
        agent_events.message_delta(chat_id, state.message_id, f"⚠ {error}")
    agent_events.message_done(chat_id, state.message_id, usage)
    _drain_queue(chat_id)


def _begin_turn(chat: dict, *, text: str, provider_text: str,
                attachments: list[dict], user_msg: dict,
                attachment_manifest: dict | None = None,
                task_input_json: str | None = None,
                provider_options_json: str | None = None) -> dict:
    assistant_msg = storage.create_bot_message(
        chat_id=chat["id"], role="assistant",
        content="[]", status="streaming", parent_id=user_msg["id"],
    )
    state = _TurnState(TurnHandle(), assistant_msg["id"])
    ACTIVE_TURNS[chat["id"]] = state
    _broadcast("turn_start", {
        "chat_id": chat["id"],
        "user_message": user_msg,
        "assistant_message": assistant_msg,
    })
    asyncio.create_task(
        _run_turn(chat, text, state, provider_text=provider_text,
                  attachments=attachments, attachment_manifest=attachment_manifest,
                  task_input_json=task_input_json, provider_options_json=provider_options_json),
        name=f"comfytv-bot-{chat['id'][:8]}",
    )
    return assistant_msg


def _drain_queue(chat_id: str) -> None:
    queue = QUEUED.get(chat_id)
    if not queue:
        QUEUED.pop(chat_id, None)
        return
    item = queue.pop(0)
    if not queue:
        QUEUED.pop(chat_id, None)
    chat = storage.get_bot_chat(chat_id)
    if chat is None:
        return
    user_msg = storage.update_bot_message(item["user_msg"]["id"],
                                          status="done")
    _begin_turn(chat, text=item["text"],
                provider_text=item["provider_text"],
                attachments=item["attachments"],
                attachment_manifest=item.get("attachment_manifest"),
                task_input_json=item.get("task_input_json"),
                provider_options_json=item.get("provider_options_json"),
                user_msg=user_msg or item["user_msg"])
