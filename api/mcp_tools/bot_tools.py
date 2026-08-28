import asyncio
import json
from ... import storage


def _bot_turn_state():
    from ..mcp import BOT_CHAT_ID
    chat_id = BOT_CHAT_ID.get()
    if not chat_id:
        return "", None
    from ..bot import ACTIVE_TURNS
    return chat_id, ACTIVE_TURNS.get(chat_id)

async def _await_ask(chat_id: str, state, spec: dict) -> dict:
    from .. import bot_asks
    from ..bot_turns import _broadcast

    ask = bot_asks.create_ask(chat_id, state.message_id, spec)
    block = {"type": "ask", "ask_id": ask.id, "status": "pending", **spec}
    state.blocks.append(block)
    storage.update_bot_message(state.message_id,
                              content=json.dumps(state.blocks))
    _broadcast("turn_ask", {
        "chat_id": chat_id, "message_id": state.message_id,
        "ask_id": ask.id, **spec,
    })
    try:
        outcome = await asyncio.wait_for(ask.future,
                                         timeout=bot_asks.ASK_TIMEOUT_S)
    except asyncio.TimeoutError:
        bot_asks.resolve_ask(ask.id, "expired")
        outcome = {"status": "expired"}

    block["status"] = outcome["status"]
    if outcome.get("selected") is not None:
        block["selected"] = outcome["selected"]
    if outcome.get("other_text"):
        block["other_text"] = outcome["other_text"]
    storage.update_bot_message(state.message_id,
                              content=json.dumps(state.blocks))
    _broadcast("turn_ask_resolved", {
        "chat_id": chat_id, "message_id": state.message_id,
        "ask_id": ask.id, "status": outcome["status"],
        "selected": outcome.get("selected"),
        "other_text": outcome.get("other_text"),
    })
    return outcome

_PREFS_MAX = 20

async def _remember(args: dict) -> dict:
    chat_id, _state = _bot_turn_state()
    if not chat_id:
        raise ValueError("remember is only available inside ComfyTV bot chats")
    action = str(args.get("action") or "add")
    if action == "clear":
        chat = storage.update_bot_chat(chat_id, prefs=[])
        return {"prefs": (chat or {}).get("prefs") or []}
    if action != "add":
        raise ValueError("action must be 'add' or 'clear'")
    note = str(args.get("note") or "").strip()
    if not note:
        raise ValueError("note is required")
    current = (storage.get_bot_chat(chat_id) or {}).get("prefs") or []
    if note not in current:
        current = (current + [note])[-_PREFS_MAX:]
    chat = storage.update_bot_chat(chat_id, prefs=current)
    return {"prefs": (chat or {}).get("prefs") or []}

async def _ask_user(args: dict) -> dict:
    from .. import bot_asks

    chat_id, state = _bot_turn_state()
    if not chat_id:
        raise ValueError("ask_user is only available inside ComfyTV bot chats")
    if state is None:
        raise ValueError("no active bot turn for this chat")
    spec = bot_asks.validate_spec(args)
    outcome = await _await_ask(chat_id, state, spec)
    if outcome["status"] != "answered":
        return {"status": outcome["status"],
                "note": "the user did not answer; proceed conservatively or "
                        "end the turn"}
    return {"status": "answered",
            "selected": outcome.get("selected") or [],
            "other_text": outcome.get("other_text") or ""}

async def _maybe_ask_run_approval(action: str) -> dict | None:
    chat_id, state = _bot_turn_state()
    if not chat_id or state is None:
        return None
    try:
        if storage.get_setting("bot-always-allow-runs"):
            return None
    except Exception:
        pass
    chat = storage.get_bot_chat(chat_id)
    if not chat or (chat.get("run_mode") or "auto") != "ask":
        return None
    outcome = await _await_ask(chat_id, state, {
        "prompt": action,
        "options": [
            {"id": "run", "label": "Run"},
            {"id": "always", "label": "Always run",
             "description": "run this and switch the chat back to Auto"},
            {"id": "cancel", "label": "Cancel"},
        ],
        "min_selections": 1,
        "max_selections": 1,
        "allow_other": False,
        "kind": "run_approval",
    })
    selected = outcome.get("selected") or []
    if outcome["status"] == "answered" and "always" in selected:
        storage.update_bot_chat(chat_id, run_mode="auto")
        return None
    if outcome["status"] == "answered" and "run" in selected:
        return None
    return {"cancelled": True, "status": outcome["status"],
            "note": "the user declined this run; do not retry it without "
                    "new instructions"}


TOOLS: dict[str, dict] = {
    "ask_user": {
        "description": (
            "Pause and ask the user a question in the chat panel; blocks "
            "until they answer (or a few minutes pass). Use when a decision "
            "genuinely belongs to the user: creative direction, destructive "
            "actions, spending. options are the choices; set "
            "min/max_selections for multi-select and allow_other to accept "
            "free text. Returns {status, selected, other_text} — status "
            "cancelled/expired means no answer, don't retry immediately."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "prompt": {"type": "string"},
                "options": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "label": {"type": "string"},
                            "description": {"type": "string"},
                        },
                        "required": ["id", "label"],
                        "additionalProperties": False,
                    },
                },
                "min_selections": {"type": "integer"},
                "max_selections": {"type": "integer"},
                "allow_other": {"type": "boolean"},
            },
            "required": ["prompt", "options"],
            "additionalProperties": False,
        },
        "handler": _ask_user,
    },
    "remember": {
        "description": (
            "Save a chat-level preference the user states (default model, "
            "sizes, approval habits, style rules); it is replayed to you at "
            "the start of every later message in this chat. "
            "action='add' with note, or action='clear' to forget them all."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": ["add", "clear"]},
                "note": {"type": "string"},
            },
            "additionalProperties": False,
        },
        "handler": _remember,
    },
}
