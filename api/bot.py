import asyncio
import json
import logging
from typing import Optional

from aiohttp import web

from .. import storage
from ..bot import get_provider, list_providers
from . import bot_turns
from ._common import routes
from .bot_media import _prepare_attachment, _resolve_attachment_assets, _resolve_refs
from .bot_turns import (  # noqa: F401 — re-exported for callers and tests
    ACTIVE_TURNS,
    QUEUED,
    _TurnState,
    _begin_turn,
)

_log = logging.getLogger(__name__)

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



@routes.get("/comfytv/bot/status")
async def bot_status(request: web.Request) -> web.Response:
    enabled = bot_enabled()
    if not enabled:
        return web.json_response({"enabled": False, "providers": []})
    out = []
    for provider in list_providers():
        st = await provider.probe()
        caps = provider.capabilities()
        try:
            models = await provider.list_models()
        except Exception:
            _log.exception("[ComfyTV/bot] list_models failed for %s",
                           provider.id)
            models = []
        out.append({
            "id": provider.id,
            "label": provider.label,
            "available": st.available,
            "version": st.version,
            "logged_in": st.logged_in,
            "detail": st.detail,
            "stateful": caps.stateful,
            "attachments": caps.attachments,
            "models": models,
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
    bot_turns._broadcast("chat_created", {"chat": chat})
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
    run_mode = body.get("run_mode")
    if run_mode is not None and run_mode not in ("auto", "ask"):
        return web.json_response(
            {"error": "run_mode must be 'auto' or 'ask'"}, status=400)
    updated = storage.update_bot_chat(
        chat["id"],
        title=str(title) if title is not None else None,
        run_mode=run_mode,
        pinned=body.get("pinned"),
        archived=body.get("archived"),
    )
    bot_turns._broadcast("chat_updated", {"chat": updated})
    return web.json_response({"chat": updated})


@routes.delete("/comfytv/bot/chats/{cid}")
async def bot_delete_chat(request: web.Request) -> web.Response:
    if not bot_enabled():
        return _disabled_response()
    chat, err = _chat_or_response(request)
    if err is not None:
        return err
    QUEUED.pop(chat["id"], None)
    state = ACTIVE_TURNS.get(chat["id"])
    if state is not None:
        provider = get_provider(chat["provider"])
        if provider is not None:
            await provider.stop(state.handle)
    storage.delete_bot_chat(chat["id"])
    bot_turns._broadcast("chat_deleted", {"chat_id": chat["id"]})
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
    try:
        attachment_assets = _resolve_attachment_assets(body.get("attachments"))
        ref_items, ref_lines = _resolve_refs(body.get("refs"))
    except ValueError as e:
        return web.json_response({"error": str(e)}, status=400)
    if not text and not attachment_assets:
        return web.json_response(
            {"error": "text or attachments required"}, status=400)
    provider = get_provider(chat["provider"])
    if provider is None:
        return web.json_response(
            {"error": f"unknown provider {chat['provider']!r}"}, status=400)
    if attachment_assets and not provider.capabilities().attachments:
        return web.json_response(
            {"error": f"provider {chat['provider']!r} does not support "
                      "attachments"}, status=400)
    skill_name = str(body.get("skill") or "").strip()
    if skill_name:
        from .. import skill_store
        if skill_store.find_enabled(skill_name) is None:
            return web.json_response(
                {"error": f"unknown or disabled skill {skill_name!r}"},
                status=400)

    attachments = []
    manifest_lines = []
    for a in attachment_assets:
        try:
            block, line = await asyncio.to_thread(_prepare_attachment, a)
        except Exception as e:
            return web.json_response(
                {"error": f"could not read asset {a['id']} ({e})"},
                status=400)
        if block is not None:
            attachments.append(block)
        manifest_lines.append(line)

    display_blocks = [
        {"type": a["media_type"], "url": a["payload_url"], "asset_id": a["id"]}
        for a in attachment_assets
    ]
    display_blocks += [{"type": "ref", **r} for r in ref_items]
    if skill_name:
        display_blocks.append({"type": "skill", "name": skill_name})
    if text:
        display_blocks.append({"type": "text", "text": text})

    provider_text = text or (
        "Look at the attached media and report what you can determine about "
        "it (for audio/video use media_probe and the manifest facts).")
    if skill_name:
        provider_text = (
            f"Use the ComfyTV skill {skill_name!r} for this task: first call "
            f"the comfytv MCP tool skill with action='read' and "
            f"name={skill_name!r}, then follow those instructions.\n\n"
            + provider_text)
    if ref_lines:
        provider_text += "\n\n" + "\n".join(ref_lines)
    if manifest_lines:
        provider_text += "\n\n" + "\n".join(manifest_lines)
    prefs = chat.get("prefs") or []
    if prefs:
        provider_text = (
            "Saved chat preferences (via remember; follow unless the user "
            "overrides):\n" + "\n".join(f"- {p}" for p in prefs)
            + "\n\n" + provider_text)

    if chat["id"] in ACTIVE_TURNS:
        user_msg = storage.create_bot_message(
            chat_id=chat["id"], role="user",
            content=json.dumps(display_blocks), status="queued",
        )
        QUEUED.setdefault(chat["id"], []).append({
            "user_msg": user_msg,
            "text": text,
            "provider_text": provider_text,
            "attachments": attachments,
        })
        bot_turns._broadcast("message_queued", {
            "chat_id": chat["id"], "user_message": user_msg,
        })
        return web.json_response({"queued": True, "user_message": user_msg})

    user_msg = storage.create_bot_message(
        chat_id=chat["id"], role="user",
        content=json.dumps(display_blocks),
    )
    assistant_msg = _begin_turn(
        chat, text=text, provider_text=provider_text,
        attachments=attachments, user_msg=user_msg)
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
    from . import bot_asks
    bot_asks.cancel_chat_asks(chat["id"])
    provider = get_provider(chat["provider"])
    if provider is not None:
        await provider.stop(state.handle)
    return web.json_response({"ok": True})


@routes.post("/comfytv/bot/chats/{cid}/branch")
async def bot_branch_chat(request: web.Request) -> web.Response:
    if not bot_enabled():
        return _disabled_response()
    chat, err = _chat_or_response(request)
    if err is not None:
        return err
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "invalid JSON body"}, status=400)
    message_id = str(body.get("message_id") or "")
    if not message_id:
        return web.json_response({"error": "message_id required"}, status=400)
    branch = storage.branch_bot_chat(chat["id"], message_id)
    if branch is None:
        return web.json_response({"error": "message not found"}, status=404)
    bot_turns._broadcast("chat_created", {"chat": branch})
    return web.json_response({
        "chat": branch,
        "messages": storage.list_bot_messages(branch["id"]),
    })


@routes.post("/comfytv/bot/chats/{cid}/asks/{aid}/answer")
async def bot_answer_ask(request: web.Request) -> web.Response:
    if not bot_enabled():
        return _disabled_response()
    chat, err = _chat_or_response(request)
    if err is not None:
        return err
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "invalid JSON body"}, status=400)
    ask_id = request.match_info["aid"]
    selected = body.get("selected")
    if not isinstance(selected, list):
        return web.json_response({"error": "selected must be a list"},
                                 status=400)
    selected = [str(s) for s in selected]
    other_text = str(body.get("other_text") or "")

    from . import bot_asks
    ask = bot_asks.PENDING.get(ask_id)
    if ask is None or ask.chat_id != chat["id"]:
        return web.json_response(
            {"error": "ask not found or already resolved"}, status=409)
    try:
        bot_asks.validate_answer(ask.spec, selected, other_text)
    except ValueError as e:
        return web.json_response({"error": str(e)}, status=422)
    if bot_asks.resolve_ask(ask_id, "answered", selected, other_text) is None:
        return web.json_response(
            {"error": "ask not found or already resolved"}, status=409)
    return web.json_response({"ok": True}, status=202)


def _reap_stale_messages() -> None:
    try:
        for chat in storage.list_bot_chats(include_archived=True):
            for msg in storage.list_bot_messages(chat["id"]):
                if msg["status"] in ("streaming", "queued"):
                    storage.update_bot_message(
                        msg["id"], status="aborted")
    except Exception:
        _log.exception("[ComfyTV/bot] stale message reap failed")


_reap_stale_messages()
