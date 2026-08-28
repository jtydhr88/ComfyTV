import asyncio
import json
import logging
import time
from typing import Optional

from server import PromptServer

from .. import storage
from ..bot import BotEvent, TurnHandle, TurnRequest, get_provider

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
    parts = [str(b.get("text") or "") for b in blocks
             if isinstance(b, dict) and b.get("type") == "text"]
    return "\n".join(p for p in parts if p.strip()).strip()


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
                    attachments: list[dict] | None = None) -> None:
    chat_id = chat["id"]
    provider = get_provider(chat["provider"])

    async def emit(ev: BotEvent) -> None:
        payload = _apply_event(state, ev)
        if payload is None:
            return
        payload.update({"chat_id": chat_id, "message_id": state.message_id})
        _broadcast(payload.pop("event"), payload)
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
        result = await provider.send(
            TurnRequest(
                chat_id=chat_id,
                user_text=provider_text if provider_text is not None else text,
                resume_token=chat.get("resume_token"),
                history=history,
                mcp_endpoint=_mcp_endpoint(chat_id),
                allowed_tools=_allowed_tools(comfy_mcp_argv),
                attachments=attachments or [],
                model=_provider_model(chat["provider"]),
                comfy_mcp_argv=comfy_mcp_argv,
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

    ACTIVE_TURNS.pop(chat_id, None)
    from . import bot_asks
    bot_asks.cancel_chat_asks(chat_id)
    token = result.resume_token if result else None
    usage = result.usage if result else None
    if error:
        state.blocks.append({"type": "notice", "level": "error", "text": error})
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
    _drain_queue(chat_id)


def _begin_turn(chat: dict, *, text: str, provider_text: str,
                attachments: list[dict], user_msg: dict) -> dict:
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
                  attachments=attachments),
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
                user_msg=user_msg or item["user_msg"])
