import logging
from typing import Any

from aiohttp import web

from .. import storage
from ..bot import get_provider, list_providers
from . import agent_messages, agent_workflows, bot_send, bot_turns, hermes_interactions
from ._common import routes
from .bot import ACTIVE_TURNS, _disabled_response, bot_enabled
from .bot_media import _resolve_refs

_log = logging.getLogger(__name__)
_RUN_MODES = ("ask_approval", "auto", "auto_limited")


def _error(message: str, status: int = 400) -> web.Response:
    return web.json_response({"error": message}, status=status)


async def _json(request: web.Request) -> dict | web.Response:
    try:
        from .task_context import read_request
        body = await read_request(request)
    except Exception as e:
        return _error(f"invalid json: {e}")
    return body if isinstance(body, dict) else _error("body must be an object")


def _setting(key: str, default: Any = None) -> Any:
    try:
        value = storage.get_setting(key)
    except Exception:
        return default
    return default if value in (None, "") else value


def default_provider() -> str:
    configured = str(_setting("bot-provider", "") or "")
    if configured and get_provider(configured) is not None:
        return configured
    providers = list_providers()
    return providers[0].id if providers else "claude-code"


def run_mode() -> dict:
    mode = str(_setting("bot-run-mode", "ask_approval"))
    if mode not in _RUN_MODES or mode == "auto_limited":
        mode = "auto" if mode == "auto_limited" else "ask_approval"
    return {"mode": mode, "credit_limit": None}


def _chat_run_mode() -> str:
    return "ask" if run_mode()["mode"] == "ask_approval" else "auto"


@routes.get('/comfytv/agent/threads/{tid}/attachment-capability')
async def agent_attachment_capability(request):
    tid = request.match_info['tid']
    chat = storage.get_bot_chat(tid) if tid != 'new' else None
    if tid != 'new' and chat is None:
        return _error('thread not found', 404)
    provider = get_provider(chat['provider'] if chat else default_provider())
    if provider is None:
        return _error('provider unavailable', 404)
    caps = provider.capabilities()
    return web.json_response({'attachments': caps.attachments,
                              'attachment_transport': caps.attachment_transport,
                              'attachment_mixed_context': caps.attachment_mixed_context,
                              'attachment_media_types': caps.attachment_media_types})


@routes.get("/comfytv/agent/threads")
async def agent_list_threads(_request: web.Request) -> web.Response:
    if not bot_enabled():
        return _disabled_response()
    threads = []
    for chat in storage.list_bot_chats():
        rows = storage.list_bot_messages(chat["id"])
        if not rows:
            continue
        threads.append(agent_messages.thread_summary(chat, rows))
    threads.sort(key=lambda t: t["last_message_at"], reverse=True)
    return web.json_response({"threads": threads,
                              "pagination": agent_messages.pagination(len(threads))})


@routes.get("/comfytv/agent/threads/{tid}/messages")
async def agent_get_messages(request: web.Request) -> web.Response:
    if not bot_enabled():
        return _disabled_response()
    chat = storage.get_bot_chat(request.match_info["tid"])
    if chat is None:
        return _error("thread not found", 404)
    state = ACTIVE_TURNS.get(chat["id"])
    out = []
    for seq, row in enumerate(storage.list_bot_messages(chat["id"])):
        live = state.blocks if state is not None and row["id"] == state.message_id else None
        out.append(agent_messages.to_agent_message(row, seq, live))
    return web.json_response(out)


def _stage_refs(selection: Any) -> list[dict]:
    node_ids = selection.get("node_ids") if isinstance(selection, dict) else None
    if not isinstance(node_ids, list):
        return []
    return [{"kind": "stage", "graph_node_id": str(n)} for n in node_ids if str(n)]


def _split_skill(text: str) -> tuple[str, str]:
    if not text.startswith("/"):
        return "", text
    head, _, rest = text[1:].partition(" ")
    from .. import skill_store
    if not head or skill_store.find_enabled(head) is None:
        return "", text
    return head, rest.strip()


def _workflow_lines(body: dict) -> list[str]:
    lines = []
    target = body.get("workflow_id")
    target_path = agent_workflows.path_for(str(target)) if target else None
    if target_path:
        lines.append(f"[Target workflow: user/default/workflows/{target_path}]")
    refs = [r for r in (body.get("workflow_references") or [])
            if isinstance(r, dict) and r.get("workflow_id")]
    if refs:
        listed = ", ".join(
            f"{r.get('name') or 'workflow'} (user/default/workflows/"
            f"{agent_workflows.path_for(str(r['workflow_id'])) or '?'})" for r in refs)
        lines.append(f"[The user referenced these saved workflows: {listed}]")
    return lines


@routes.post("/comfytv/agent/threads/{tid}/messages")
async def agent_post_message(request: web.Request) -> web.Response:
    if not bot_enabled():
        return _disabled_response()
    thread_id = request.match_info["tid"]
    body = await _json(request)
    if isinstance(body, web.Response):
        return body
    if set(body) & {'interaction_mode','interaction_binding','channel_id','csrf_token','run_id','session_id'}:
        return _error('interaction authority is server-owned')
    try:
        interaction_binding = hermes_interactions.CHANNELS.validate(request)
    except ValueError:
        interaction_binding = None # LAN and legacy native chat remain noninteractive.
    candidate = (storage.get_bot_chat(thread_id) if thread_id != 'new' else
                 {'provider': str(body.get('provider') or default_provider())})
    provider = get_provider(candidate['provider']) if candidate else None
    if provider and provider.capabilities().attachment_transport == 'asset_refs' and body.get('attachments'):
        try:
            bot_send.validate_image_ref_context(candidate, body, body.get('content', ''))
        except ValueError as exc:
            return _error(str(exc))
        if thread_id != 'new' and thread_id in ACTIVE_TURNS:
            return _error('a turn is already running on this thread', 409)
        prepared, chat = None, None
        try:
            prepared = await bot_send.prepare_image_refs(candidate, body['attachments'],
                                                         body.get('content', ''), native=True, body=body)
            chat = candidate if thread_id != 'new' else storage.create_bot_chat(provider=candidate['provider'])
            _, assistant = bot_send.admit_image_refs({**chat, 'run_mode': _chat_run_mode()}, prepared, native=True)
        except BaseException as exc:
            if prepared:
                bot_send.release_prepared(prepared)
            if thread_id == 'new' and chat:
                storage.delete_bot_chat(chat['id'])
            if isinstance(exc, ValueError):
                return _error(str(exc))
            raise
        if assistant is None:
            return _error('a turn is already running on this thread', 409)
        ACTIVE_TURNS[chat['id']].handle._interaction_binding = interaction_binding
        chat = storage.update_bot_chat(chat['id'], run_mode=_chat_run_mode()) or chat
        if thread_id == 'new':
            bot_turns._broadcast('chat_created', {'chat': chat})
        ack = {'thread_id': chat['id'], 'message_id': assistant['id']}
        if body.get('workflow_id'):
            ack['workflow_id'] = body['workflow_id']
        return web.json_response(ack, status=202)
    skill_name, text = _split_skill(str(body.get("content") or "").strip())
    try:
        attachment_assets, input_files = bot_send.split_attachment_refs(body.get("attachments"))
        ref_items, ref_lines = _resolve_refs(_stage_refs(body.get("selection")) or None)
    except ValueError as e:
        return _error(str(e))
    has_attachments = bool(attachment_assets or input_files)
    if not text and not has_attachments and not skill_name:
        return _error("content must be a non-empty string")
    if thread_id == "new":
        provider_id = str(body.get("provider") or default_provider())
        if get_provider(provider_id) is None:
            return _error(f"unknown provider {provider_id!r}")
        chat = storage.create_bot_chat(provider=provider_id)
        bot_turns._broadcast("chat_created", {"chat": chat})
    else:
        chat = storage.get_bot_chat(thread_id)
        if chat is None:
            return _error("thread not found", 404)
    if chat["id"] in ACTIVE_TURNS:
        return _error("a turn is already running on this thread", 409)
    provider = get_provider(chat["provider"])
    if provider is None:
        return _error(f"unknown provider {chat['provider']!r}")
    if has_attachments and not provider.capabilities().attachments:
        return _error(f"provider {chat['provider']!r} does not support attachments")
    chat = storage.update_bot_chat(chat["id"], run_mode=_chat_run_mode()) or chat
    try:
        attachments, manifest, display = await bot_send.prepare_attachments(
            attachment_assets, input_files)
    except ValueError as e:
        return _error(str(e))
    display += [{"type": "ref", **r} for r in ref_items]
    if skill_name:
        display.append({"type": "skill", "name": skill_name})
    if text:
        display.append({"type": "text", "text": text})
    provider_text = bot_send.compose_provider_text(
        chat, text, skill_name=skill_name, ref_lines=ref_lines,
        manifest_lines=manifest, extra_lines=_workflow_lines(body))
    _user_msg, assistant = bot_send.queue_or_begin(
        chat, text=text, provider_text=provider_text,
        attachments=attachments, display_blocks=display)
    if assistant is None:
        return _error("a turn is already running on this thread", 409)
    ACTIVE_TURNS[chat["id"]].handle._interaction_binding = interaction_binding
    ack: dict[str, Any] = {"thread_id": chat["id"], "message_id": assistant["id"]}
    if body.get("workflow_id"):
        ack["workflow_id"] = str(body["workflow_id"])
    return web.json_response(ack, status=202)


@routes.post("/comfytv/agent/threads/{tid}/messages/{mid}/cancel")
async def agent_cancel(request: web.Request) -> web.Response:
    if not bot_enabled():
        return _disabled_response()
    chat = storage.get_bot_chat(request.match_info["tid"])
    if chat is None:
        return _error("thread not found", 404)
    state = ACTIVE_TURNS.get(chat["id"])
    if state is None or state.message_id != request.match_info["mid"]:
        return _error("no active turn", 409)
    from . import bot_asks
    bot_asks.cancel_chat_asks(chat["id"])
    provider = get_provider(chat["provider"])
    if provider is not None:
        await provider.stop(state.handle)
    else:
        state.handle.stop_requested = True
    return web.json_response({"status": "cancelling"}, status=202)


@routes.post("/comfytv/agent/threads/{tid}/asks/{aid}/answer")
async def agent_answer_ask(request: web.Request) -> web.Response:
    if not bot_enabled():
        return _disabled_response()
    chat = storage.get_bot_chat(request.match_info["tid"])
    if chat is None:
        return _error("thread not found", 404)
    body = await _json(request)
    if isinstance(body, web.Response):
        return body
    selected = body.get("selected")
    if not isinstance(selected, list):
        return _error("selected must be a list")
    selected = [str(s) for s in selected]
    from . import bot_asks
    ask_id = request.match_info["aid"]
    ask = bot_asks.PENDING.get(ask_id)
    if ask is None or ask.chat_id != chat["id"]:
        return _error("ask not found or already resolved", 409)
    try:
        bot_asks.validate_answer(ask.spec, selected, "")
    except ValueError as e:
        return _error(str(e), 422)
    if bot_asks.resolve_ask(ask_id, "answered", selected, "") is None:
        return _error("ask not found or already resolved", 409)
    return web.json_response({"status": "answered"}, status=202)


@routes.get("/comfytv/agent/run-mode")
async def agent_get_run_mode(_request: web.Request) -> web.Response:
    return web.json_response(run_mode())


@routes.put("/comfytv/agent/run-mode")
async def agent_put_run_mode(request: web.Request) -> web.Response:
    body = await _json(request)
    if isinstance(body, web.Response):
        return body
    mode = body.get("mode")
    if mode not in _RUN_MODES:
        return _error("invalid mode")
    storage.set_settings({"bot-run-mode": "auto" if mode == "auto_limited" else mode})
    return web.json_response(run_mode())


@routes.get("/comfytv/agent/workflows")
async def agent_workflow_index(_request: web.Request) -> web.Response:
    data = [agent_workflows.public(e) for e in agent_workflows.entries()]
    return web.json_response({"data": data, "pagination": agent_messages.pagination(len(data))})
