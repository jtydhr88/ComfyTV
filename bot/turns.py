import asyncio
import logging
import time
from typing import Awaitable, Callable, Optional, Protocol

from . import bot_asks
from .agent_host import COMFY_MCP_ALLOWED_TOOLS
from .providers import BotEvent, TurnHandle, TurnRequest, get_provider

_log = logging.getLogger(__name__)

PERSIST_INTERVAL_S = 3.0
TITLE_MAX = 48


class ChatStore(Protocol):
    def get_chat(self, chat_id: str) -> Optional[dict]: ...

    def list_messages(self, chat_id: str) -> list[dict]: ...

    def create_message(self, *, chat_id: str, role: str, blocks: list[dict], status: str,
                       parent_id: Optional[str]) -> dict: ...

    def update_message(self, chat_id: str, message_id: str, **fields) -> Optional[dict]: ...

    def update_chat(self, chat_id: str, **fields) -> Optional[dict]: ...


class TurnState:
    def __init__(self, handle: TurnHandle, chat_id: str, message_id: str) -> None:
        self.handle = handle
        self.chat_id = chat_id
        self.message_id = message_id
        self.blocks: list[dict] = []
        self.last_persist = 0.0
        self.tool_started: dict[str, float] = {}


def allowed_tools(mcp_name: str, comfy_mcp_argv: list[str]) -> list[str]:
    tools = [f"mcp__{mcp_name}__*"]
    if comfy_mcp_argv:
        tools += [f"mcp__comfy__{t}" for t in COMFY_MCP_ALLOWED_TOOLS]
    return tools


def derive_title(text: str, fallback: str) -> str:
    line = " ".join(text.split())
    return line[:TITLE_MAX] if line else fallback


def apply_event(state: TurnState, ev: BotEvent) -> Optional[dict]:
    if ev.t in ("delta", "thinking"):
        kind = "text" if ev.t == "delta" else "thinking"
        if state.blocks and state.blocks[-1].get("type") == kind:
            state.blocks[-1]["text"] += ev.text
        else:
            state.blocks.append({"type": kind, "text": ev.text})
        return {"event": f"turn_{'delta' if ev.t == 'delta' else 'thinking'}", "text": ev.text}
    if ev.t == "tool_use":
        block = {"type": "tool_use", "name": ev.name, "input": ev.input or {}}
        payload = {"event": "turn_tool_use", "name": ev.name, "input": ev.input or {}}
        if ev.id:
            block["id"] = payload["id"] = ev.id
            state.tool_started[ev.id] = time.monotonic()
        state.blocks.append(block)
        return payload
    if ev.t == "tool_result":
        tool_status = "error" if ev.is_error else "success"
        block = {"type": "tool_result", "name": ev.name, "text": ev.text, "status": tool_status}
        payload = {"event": "turn_tool_result", "name": ev.name, "text": ev.text, "status": tool_status}
        if ev.id:
            block["id"] = payload["id"] = ev.id
            started = state.tool_started.pop(ev.id, None)
            if started is not None:
                block["duration_ms"] = payload["duration_ms"] = int((time.monotonic() - started) * 1000)
        state.blocks.append(block)
        return payload
    return None


class TurnRunner:
    def __init__(self, *, label: str, mcp_name: str, store: ChatStore,
                 broadcast: Callable[[str, dict], None],
                 spawn: Callable[[Awaitable[None], str], None],
                 mcp_endpoint: Callable[[str], str],
                 comfy_mcp_argv: Callable[[], list[str]],
                 provider_model: Callable[[str], str],
                 replay_text: Callable[[list[dict]], str],
                 finish_notice: Callable[[list[dict]], Optional[dict]],
                 fallback_title: str = "",
                 on_event: Optional[Callable[[str, str, BotEvent, dict], None]] = None,
                 on_done: Optional[Callable[[str, str, list[dict], str, Optional[dict]], None]] = None) -> None:
        self.label = label
        self.mcp_name = mcp_name
        self.store = store
        self.broadcast = broadcast
        self.spawn = spawn
        self.mcp_endpoint = mcp_endpoint
        self.comfy_mcp_argv = comfy_mcp_argv
        self.provider_model = provider_model
        self.replay_text = replay_text
        self.finish_notice = finish_notice
        self.fallback_title = fallback_title
        self.on_event = on_event
        self.on_done = on_done
        self.active: dict[str, TurnState] = {}
        self.queued: dict[str, list[dict]] = {}

    def replay_history(self, chat_id: str, current_message_id: str) -> list[dict]:
        rows = self.store.list_messages(chat_id)
        current = next((r for r in rows if r["id"] == current_message_id), None)
        skip = {current_message_id}
        if current and current.get("parent_id"):
            skip.add(current["parent_id"])
        history = []
        for row in rows:
            if row["id"] in skip or row["role"] not in ("user", "assistant"):
                continue
            text = self.replay_text([b for b in row["blocks"] if isinstance(b, dict)])
            if text:
                history.append({"role": row["role"], "text": text})
        return history

    def begin(self, chat: dict, *, text: str, provider_text: str, attachments: list[dict],
              user_msg: dict) -> dict:
        assistant_msg = self.store.create_message(chat_id=chat["id"], role="assistant", blocks=[],
                                                  status="streaming", parent_id=user_msg["id"])
        state = TurnState(TurnHandle(), chat["id"], assistant_msg["id"])
        self.active[chat["id"]] = state
        self.broadcast("turn_start", {"chat_id": chat["id"], "user_message": user_msg,
                                      "assistant_message": assistant_msg})
        self.spawn(self._run(chat, text, state, provider_text=provider_text, attachments=attachments),
                   f"{self.mcp_name}-bot-{chat['id'][:8]}")
        return assistant_msg

    async def _run(self, chat: dict, text: str, state: TurnState, *, provider_text: Optional[str],
                   attachments: list[dict]) -> None:
        chat_id = chat["id"]
        provider = get_provider(chat["provider"])
        # The chat panels need the POST ack before the first delta reaches them.
        await asyncio.sleep(0.1)

        async def emit(ev: BotEvent) -> None:
            if ev.t == "session":
                if not ev.id:
                    return
                if self.store.update_message(chat_id, state.message_id, resume_token_after=ev.id) is None:
                    raise RuntimeError("bot message no longer exists")
                if self.store.update_chat(chat_id, resume_token=ev.id) is None:
                    raise RuntimeError("bot chat no longer exists")
                return
            payload = apply_event(state, ev)
            if payload is None:
                return
            payload.update({"chat_id": chat_id, "message_id": state.message_id})
            self.broadcast(payload.pop("event"), payload)
            if self.on_event is not None:
                self.on_event(chat_id, state.message_id, ev, payload)
            now = time.monotonic()
            if ev.t in ("tool_use", "tool_result") or now - state.last_persist > PERSIST_INTERVAL_S:
                state.last_persist = now
                self.store.update_message(chat_id, state.message_id, blocks=state.blocks)

        comfy_mcp_argv = self.comfy_mcp_argv()
        try:
            history = None
            if not provider.capabilities().stateful:
                try:
                    history = self.replay_history(chat_id, state.message_id)
                except Exception:
                    _log.exception("[%s/bot] history replay failed for %s", self.label, chat_id)
            result = await provider.send(
                TurnRequest(
                    chat_id=chat_id,
                    user_text=provider_text if provider_text is not None else text,
                    resume_token=chat.get("resume_token"),
                    history=history,
                    mcp_endpoint=self.mcp_endpoint(chat_id),
                    allowed_tools=allowed_tools(self.mcp_name, comfy_mcp_argv),
                    attachments=attachments or [],
                    model=self.provider_model(chat["provider"]),
                    comfy_mcp_argv=comfy_mcp_argv,
                ),
                emit,
                state.handle,
            )
        except Exception as e:
            _log.exception("[%s/bot] turn failed for chat %s", self.label, chat_id)
            result = None
            error = str(e) or type(e).__name__
            status = "error"
        else:
            error = result.error
            status = "aborted" if result.aborted else ("error" if error else "done")

        self.active.pop(chat_id, None)
        bot_asks.cancel_chat_asks(chat_id)
        token = result.resume_token if result else None
        usage = result.usage if result else None
        if error:
            state.blocks.append({"type": "notice", "level": "error", "text": error})
        elif status == "done":
            notice = self.finish_notice(state.blocks)
            if notice:
                state.blocks.append(notice)
        self.store.update_message(chat_id, state.message_id, blocks=state.blocks, status=status,
                                  resume_token_after=token, usage=usage)
        updates: dict = {"resume_token": token} if token else {}
        if not (chat.get("title") or "").strip():
            updates["title"] = derive_title(text, self.fallback_title)
        if updates:
            self.store.update_chat(chat_id, **updates)
        self.broadcast("turn_done", {"chat_id": chat_id, "message_id": state.message_id, "status": status,
                                     "error": error, "title": updates.get("title"), "usage": usage})
        if self.on_done is not None:
            self.on_done(chat_id, state.message_id, state.blocks, error, usage)
        self.drain(chat_id)

    def drain(self, chat_id: str) -> None:
        queue = self.queued.get(chat_id)
        if not queue:
            self.queued.pop(chat_id, None)
            return
        item = queue.pop(0)
        if not queue:
            self.queued.pop(chat_id, None)
        chat = self.store.get_chat(chat_id)
        if chat is None:
            return
        user_msg = self.store.update_message(chat_id, item["user_msg"]["id"], status="done")
        self.begin(chat, text=item["text"], provider_text=item["provider_text"],
                   attachments=item["attachments"], user_msg=user_msg or item["user_msg"])
