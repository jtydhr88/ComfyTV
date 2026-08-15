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

    try:
        result = await provider.send(
            TurnRequest(
                chat_id=chat_id,
                user_text=provider_text if provider_text is not None else text,
                resume_token=chat.get("resume_token"),
                mcp_endpoint=_mcp_endpoint(),
                allowed_tools=list(_ALLOWED_TOOLS),
                attachments=attachments or [],
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


_ATTACH_MAX_PX = 1024
_ATTACH_JPEG_QUALITY = 85
_ATTACH_MAX_COUNT = 6


def _render_attachment(url: str) -> dict:
    import base64
    import io

    from PIL import Image

    from ..runners.media import localize

    src = localize(url)
    with Image.open(str(src)) as im:
        im = im.convert("RGB")
        im.thumbnail((_ATTACH_MAX_PX, _ATTACH_MAX_PX))
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=_ATTACH_JPEG_QUALITY)
    return {
        "data": base64.b64encode(buf.getvalue()).decode("ascii"),
        "media_type": "image/jpeg",
    }


_ATTACHABLE_TYPES = ("image", "video", "audio")


def _resolve_attachment_assets(raw) -> list[dict]:
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ValueError("attachments must be an array of {asset_id} objects")
    if len(raw) > _ATTACH_MAX_COUNT:
        raise ValueError(f"at most {_ATTACH_MAX_COUNT} attachments per message")
    rows = []
    for i, item in enumerate(raw):
        aid = item.get("asset_id") if isinstance(item, dict) else None
        if not isinstance(aid, int):
            raise ValueError(f"attachments[{i}] needs a numeric asset_id")
        asset = storage.get_asset(aid)
        if asset is None:
            raise ValueError(f"attachments[{i}]: asset {aid} not found")
        if asset.get("media_type") not in _ATTACHABLE_TYPES:
            raise ValueError(
                f"attachments[{i}]: asset {aid} is {asset.get('media_type')!r}; "
                f"attachable types: {', '.join(_ATTACHABLE_TYPES)}")
        rows.append(asset)
    return rows


def _audio_duration_s(url: str) -> float | None:
    import av

    from ..runners.media import localize
    try:
        with av.open(str(localize(url))) as c:
            if c.duration:
                return round(c.duration / 1_000_000, 2)
            stream = c.streams.audio[0] if c.streams.audio else None
            if stream is not None and stream.duration and stream.time_base:
                return round(float(stream.duration * stream.time_base), 2)
    except Exception:
        return None
    return None


def _prepare_attachment(asset: dict) -> tuple[dict | None, str]:
    from ..runners import audio_render, media

    aid = asset["id"]
    url = asset["payload_url"]
    name = asset.get("name") or "unnamed"
    tail = (f"already in the asset library; to use it on a stage pass "
            f"asset_refs [{{\"asset_id\": {aid}}}] or select it in an asset "
            f"loader]")
    media_type = asset.get("media_type")

    if media_type == "image":
        return (_render_attachment(url),
                f"[Attached image: asset #{aid} ({name}) — {url} — {tail}")

    if media_type == "video":
        facts = ""
        block = None
        try:
            info = media.get_video_info(url)
            facts = (f" {info['duration']:.2f}s {info['width']}x"
                     f"{info['height']} @{info['fps']:.0f}fps"
                     f"{' with audio' if info.get('has_audio') else ''} —")
        except Exception:
            pass
        try:
            frame_url = media.extract_frame(url, "middle")
            block = _render_attachment(frame_url)
        except Exception:
            pass
        seen = (" The image below is its middle frame."
                if block else "")
        return (block,
                f"[Attached video: asset #{aid} ({name}) —{facts} {url} — "
                f"{tail}{seen}")

    facts = ""
    dur = _audio_duration_s(url)
    if dur is not None:
        facts = f" {dur:.2f}s —"
    block = None
    try:
        wave_url = audio_render.render_waveform_image(url, 1200, 320)
        block = _render_attachment(wave_url)
    except Exception:
        pass
    seen = (" The image below is its waveform (RMS + clipping markers) — "
            "use it to see the track's structure." if block else "")
    return (block,
            f"[Attached audio: asset #{aid} ({name}) —{facts} {url} — "
            f"{tail}{seen}")


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
    except ValueError as e:
        return web.json_response({"error": str(e)}, status=400)
    if not text and not attachment_assets:
        return web.json_response(
            {"error": "text or attachments required"}, status=400)
    if chat["id"] in ACTIVE_TURNS:
        return web.json_response({"error": "chat is busy"}, status=409)
    provider = get_provider(chat["provider"])
    if provider is None:
        return web.json_response(
            {"error": f"unknown provider {chat['provider']!r}"}, status=400)

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
    if text:
        display_blocks.append({"type": "text", "text": text})

    provider_text = text or (
        "Look at the attached media and report what you can determine about "
        "it (for audio/video use media_probe and the manifest facts).")
    if manifest_lines:
        provider_text += "\n\n" + "\n".join(manifest_lines)

    user_msg = storage.create_bot_message(
        chat_id=chat["id"], role="user",
        content=json.dumps(display_blocks),
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
        _run_turn(chat, text, state, provider_text=provider_text,
                  attachments=attachments),
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
