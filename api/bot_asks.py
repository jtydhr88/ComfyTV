import asyncio
import uuid
from typing import Optional

ASK_TIMEOUT_S = 540.0

_MAX_OPTIONS = 12


class PendingAsk:
    def __init__(self, chat_id: str, message_id: str, spec: dict) -> None:
        self.id = uuid.uuid4().hex
        self.chat_id = chat_id
        self.message_id = message_id
        self.spec = spec
        self.future: asyncio.Future = asyncio.get_event_loop().create_future()


PENDING: dict[str, PendingAsk] = {}


def validate_spec(args: dict) -> dict:
    prompt = str(args.get("prompt") or "").strip()
    if not prompt:
        raise ValueError("prompt is required")
    raw_options = args.get("options")
    if not isinstance(raw_options, list) or not (2 <= len(raw_options) <= _MAX_OPTIONS):
        raise ValueError(f"options must be a list of 2..{_MAX_OPTIONS} items")
    options = []
    seen_ids: set[str] = set()
    for i, raw in enumerate(raw_options):
        if not isinstance(raw, dict):
            raise ValueError(f"options[{i}] must be an object")
        oid = str(raw.get("id") or "").strip()
        label = str(raw.get("label") or "").strip()
        if not oid or not label:
            raise ValueError(f"options[{i}] needs id and label")
        if oid in seen_ids:
            raise ValueError(f"duplicate option id {oid!r}")
        seen_ids.add(oid)
        option = {"id": oid, "label": label}
        if raw.get("description"):
            option["description"] = str(raw["description"])
        options.append(option)
    min_selections = int(args.get("min_selections") or 1)
    max_selections = int(args.get("max_selections") or 1)
    if not (0 <= min_selections <= max_selections <= len(options)):
        raise ValueError("min/max_selections out of range")
    return {
        "prompt": prompt,
        "options": options,
        "min_selections": min_selections,
        "max_selections": max_selections,
        "allow_other": bool(args.get("allow_other")),
    }


def create_ask(chat_id: str, message_id: str, spec: dict) -> PendingAsk:
    ask = PendingAsk(chat_id, message_id, spec)
    PENDING[ask.id] = ask
    return ask


def resolve_ask(ask_id: str, status: str,
                selected: Optional[list[str]] = None,
                other_text: Optional[str] = None) -> Optional[PendingAsk]:
    ask = PENDING.pop(ask_id, None)
    if ask is None:
        return None
    outcome = {"status": status}
    if selected is not None:
        outcome["selected"] = selected
    if other_text:
        outcome["other_text"] = other_text
    if not ask.future.done():
        ask.future.set_result(outcome)
    return ask


def cancel_chat_asks(chat_id: str) -> list[PendingAsk]:
    stale = [a for a in PENDING.values() if a.chat_id == chat_id]
    return [ask for a in stale
            if (ask := resolve_ask(a.id, "cancelled")) is not None]


def validate_answer(spec: dict, selected: list[str],
                    other_text: str) -> None:
    valid_ids = {o["id"] for o in spec["options"]}
    unknown = [s for s in selected if s not in valid_ids]
    if unknown:
        raise ValueError(f"unknown option ids: {unknown}")
    if len(selected) > spec["max_selections"]:
        raise ValueError(f"at most {spec['max_selections']} selections")
    if other_text and not spec["allow_other"]:
        raise ValueError("free-text answer is not allowed for this ask")
    if len(selected) < spec["min_selections"] and not (
            other_text and spec["allow_other"]):
        raise ValueError(f"at least {spec['min_selections']} selections")
