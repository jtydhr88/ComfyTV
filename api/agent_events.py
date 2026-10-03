import logging
from typing import Any, Optional

from server import PromptServer

_log = logging.getLogger(__name__)

PREFIX = "comfytv_"
EVENT_TYPES = (
    "agent_thinking",
    "agent_tool_call",
    "agent_notice",
    "agent_message_delta",
    "agent_message_done",
    "agent_active_tab",
    "agent_ask",
    "agent_ask_resolved",
    "agent_interaction",
)


def emit(event_type: str, data: dict[str, Any]) -> None:
    if event_type not in EVENT_TYPES:
        raise ValueError(event_type)
    try:
        PromptServer.instance.send_sync(PREFIX + event_type, data)
    except Exception:
        _log.exception("[ComfyTV/agent] emit %s failed", event_type)


def message_delta(thread_id: str, message_id: str, delta: str) -> None:
    emit("agent_message_delta", {
        "thread_id": thread_id, "message_id": message_id, "delta": delta})


def thinking(thread_id: str, message_id: str, delta: str) -> None:
    emit("agent_thinking", {
        "thread_id": thread_id, "message_id": message_id, "delta": delta})


def tool_call(thread_id: str, message_id: str, tool_call_id: str,
              tool_name: str, status: str,
              duration_ms: Optional[int] = None) -> None:
    data: dict[str, Any] = {
        "thread_id": thread_id, "message_id": message_id,
        "tool_call_id": tool_call_id, "tool_name": tool_name, "status": status,
    }
    if duration_ms is not None:
        data["duration_ms"] = duration_ms
    emit("agent_tool_call", data)


def message_done(thread_id: str, message_id: str,
                 usage: Optional[dict] = None) -> None:
    emit("agent_message_done", {
        "thread_id": thread_id, "message_id": message_id, "usage": usage})


def ask(thread_id: str, message_id: str, ask_id: str, spec: dict) -> None:
    from .agent_messages import ask_payload
    emit("agent_ask", {"thread_id": thread_id,
                       **ask_payload(message_id, ask_id, spec)})


def ask_resolved(thread_id: str, message_id: str, ask_id: str, status: str,
                 selected: Optional[list[str]]) -> None:
    emit("agent_ask_resolved", {
        "thread_id": thread_id, "message_id": message_id, "ask_id": ask_id,
        "status": status, "selected": selected})


def from_bot_event(thread_id: str, message_id: str, ev, payload: dict) -> None:
    if ev.t == "notice":
        data = {
            "thread_id": thread_id, "message_id": message_id,
            "text": ev.text,
            "level": payload.get("level", "error" if ev.is_error else "info"),
        }
        if ev.detail:
            data["detail"] = ev.detail
        emit("agent_notice", data)
    elif ev.t == "delta":
        message_delta(thread_id, message_id, ev.text)
    elif ev.t == "thinking":
        thinking(thread_id, message_id, ev.text)
    elif ev.t == "tool_use":
        tool_call(thread_id, message_id, ev.id or ev.name, ev.name, "running")
    elif ev.t == "tool_result":
        tool_call(thread_id, message_id, ev.id or ev.name, ev.name,
                  "error" if ev.is_error else "success",
                  payload.get("duration_ms"))
