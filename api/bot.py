import asyncio
import json
import logging
import time
from typing import Optional

from aiohttp import web

from server import PromptServer

from .. import storage
from ..bot import (
    BotEvent,
    TurnHandle,
    TurnRequest,
    get_provider,
    list_providers,
)
from ._common import routes

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


ACTIVE_TURNS: dict[str, _TurnState] = {}


def bot_enabled() -> bool:
    try:
        return bool(storage.get_setting("enable-bot")) \
            and bool(storage.get_setting("enable-mcp"))
    except Exception:
        _log.exception("[ComfyTV/bot] settings lookup failed")
        return False


def _disabled_response() -> web.Response:
    return web.json_response(
        {"error": "the ComfyTV bot is disabled — enable enable-mcp and "
                  "enable-bot in the ComfyTV sidebar under Settings"},
        status=403,
    )


def _broadcast(event: str, payload: dict) -> None:
    try:
        PromptServer.instance.send_sync("comfytv-bot", {"event": event, **payload})
    except Exception:
        _log.exception("[ComfyTV/bot] broadcast failed")


def _mcp_endpoint() -> str:
    port = getattr(PromptServer.instance, "port", None) or 8188
    return f"http://127.0.0.1:{port}/comfytv/mcp"


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
        state.blocks.append({"type": "tool_use", "name": ev.name,
                             "input": ev.input or {}})
        return {"event": "turn_tool_use", "name": ev.name, "input": ev.input or {}}
    if ev.t == "tool_result":
        state.blocks.append({"type": "tool_result", "name": ev.name,
                             "text": ev.text})
        return {"event": "turn_tool_result", "name": ev.name, "text": ev.text}
    return None


async def _run_turn(chat: dict, text: str, state: _TurnState) -> None:
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

    try:
        result = await provider.send(
            TurnRequest(
                chat_id=chat_id,
                user_text=text,
                resume_token=chat.get("resume_token"),
                mcp_endpoint=_mcp_endpoint(),
                allowed_tools=list(_ALLOWED_TOOLS),
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
    token = result.resume_token if result else None
    storage.update_bot_message(
        state.message_id,
        content=json.dumps(state.blocks),
        status=status,
        resume_token_after=token,
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
    })


@routes.get("/comfytv/bot/status")
async def bot_status(request: web.Request) -> web.Response:
    enabled = bot_enabled()
    if not enabled:
        return web.json_response({"enabled": False, "providers": []})
    out = []
    for provider in list_providers():
        st = await provider.probe()
        caps = provider.capabilities()
        out.append({
            "id": provider.id,
            "label": provider.label,
            "available": st.available,
            "version": st.version,
            "logged_in": st.logged_in,
            "detail": st.detail,
            "stateful": caps.stateful,
        })
    return web.json_response({"enabled": True, "providers": out})


@routes.get("/comfytv/bot/chats")
async def bot_list_chats(request: web.Request) -> web.Response:
    if not bot_enabled():
        return _disabled_response()
    include_archived = request.query.get("archived") == "1"
    chats = storage.list_bot_chats(include_archived=include_archived)
    for c in chats:
        c["busy"] = c["id"] in ACTIVE_TURNS
    return web.json_response({"chats": chats})


@routes.post("/comfytv/bot/chats")
async def bot_create_chat(request: web.Request) -> web.Response:
    if not bot_enabled():
        return _disabled_response()
    try:
        body = await request.json()
    except Exception:
        body = {}
    provider_id = str(body.get("provider") or "claude-code")
    if get_provider(provider_id) is None:
        return web.json_response({"error": f"unknown provider {provider_id!r}"},
                                 status=400)
    chat = storage.create_bot_chat(provider=provider_id)
    _broadcast("chat_created", {"chat": chat})
    return web.json_response({"chat": chat})


def _chat_or_response(request: web.Request) -> tuple[Optional[dict], Optional[web.Response]]:
    chat_id = request.match_info["cid"]
    chat = storage.get_bot_chat(chat_id)
    if chat is None:
        return None, web.json_response({"error": "chat not found"}, status=404)
    return chat, None


@routes.get("/comfytv/bot/chats/{cid}")
async def bot_get_chat(request: web.Request) -> web.Response:
    if not bot_enabled():
        return _disabled_response()
    chat, err = _chat_or_response(request)
    if err is not None:
        return err
    messages = storage.list_bot_messages(chat["id"])
    state = ACTIVE_TURNS.get(chat["id"])
    if state is not None:
        for m in messages:
            if m["id"] == state.message_id:
                m["content"] = json.dumps(state.blocks)
    chat["busy"] = chat["id"] in ACTIVE_TURNS
    return web.json_response({"chat": chat, "messages": messages})


@routes.patch("/comfytv/bot/chats/{cid}")
async def bot_update_chat(request: web.Request) -> web.Response:
    if not bot_enabled():
        return _disabled_response()
    chat, err = _chat_or_response(request)
    if err is not None:
        return err
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "invalid JSON body"}, status=400)
    title = body.get("title")
    updated = storage.update_bot_chat(
        chat["id"],
        title=str(title) if title is not None else None,
        pinned=body.get("pinned"),
        archived=body.get("archived"),
    )
    _broadcast("chat_updated", {"chat": updated})
    return web.json_response({"chat": updated})


@routes.delete("/comfytv/bot/chats/{cid}")
async def bot_delete_chat(request: web.Request) -> web.Response:
    if not bot_enabled():
        return _disabled_response()
    chat, err = _chat_or_response(request)
    if err is not None:
        return err
    state = ACTIVE_TURNS.get(chat["id"])
    if state is not None:
        provider = get_provider(chat["provider"])
        if provider is not None:
            await provider.stop(state.handle)
    storage.delete_bot_chat(chat["id"])
    _broadcast("chat_deleted", {"chat_id": chat["id"]})
    return web.json_response({"ok": True})


@routes.post("/comfytv/bot/chats/{cid}/send")
async def bot_send(request: web.Request) -> web.Response:
    if not bot_enabled():
        return _disabled_response()
    chat, err = _chat_or_response(request)
    if err is not None:
        return err
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "invalid JSON body"}, status=400)
    text = str(body.get("text") or "").strip()
    if not text:
        return web.json_response({"error": "text is required"}, status=400)
    if chat["id"] in ACTIVE_TURNS:
        return web.json_response({"error": "chat is busy"}, status=409)
    provider = get_provider(chat["provider"])
    if provider is None:
        return web.json_response(
            {"error": f"unknown provider {chat['provider']!r}"}, status=400)

    user_msg = storage.create_bot_message(
        chat_id=chat["id"], role="user",
        content=json.dumps([{"type": "text", "text": text}]),
    )
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
        _run_turn(chat, text, state),
        name=f"comfytv-bot-{chat['id'][:8]}",
    )
    return web.json_response({
        "user_message": user_msg,
        "assistant_message": assistant_msg,
    })


@routes.post("/comfytv/bot/chats/{cid}/stop")
async def bot_stop(request: web.Request) -> web.Response:
    if not bot_enabled():
        return _disabled_response()
    chat, err = _chat_or_response(request)
    if err is not None:
        return err
    state = ACTIVE_TURNS.get(chat["id"])
    if state is None:
        return web.json_response({"error": "no active turn"}, status=409)
    provider = get_provider(chat["provider"])
    if provider is not None:
        await provider.stop(state.handle)
    return web.json_response({"ok": True})


def _reap_stale_messages() -> None:
    try:
        for chat in storage.list_bot_chats(include_archived=True):
            for msg in storage.list_bot_messages(chat["id"]):
                if msg["status"] == "streaming":
                    storage.update_bot_message(
                        msg["id"], status="aborted")
    except Exception:
        _log.exception("[ComfyTV/bot] stale message reap failed")


_reap_stale_messages()
