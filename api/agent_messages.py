import json
from typing import Any, Optional


_STATUS = {
    "done": "complete",
    "streaming": "streaming",
    "error": "error",
    "aborted": "interrupted",
    "queued": "complete",
}
_MEDIA = ("image", "video", "audio")


def blocks_of(content: Any) -> list[dict]:
    if isinstance(content, list):
        return [b for b in content if isinstance(b, dict)]
    try:
        parsed = json.loads(content or "[]")
    except (TypeError, ValueError):
        return []
    return [b for b in parsed if isinstance(b, dict)] if isinstance(parsed, list) else []


def _text_of(blocks: list[dict]) -> str:
    return "\n".join(str(b.get("text") or "") for b in blocks
                     if b.get("type") == "text").strip()


def ask_payload(message_id: str, ask_id: str, spec: dict) -> dict:
    payload = {
        "message_id": message_id,
        "ask_id": ask_id,
        "prompt": str(spec.get("prompt") or ""),
        "options": list(spec.get("options") or []),
        "min_selections": int(spec.get("min_selections") or 1),
        "max_selections": int(spec.get("max_selections") or 1),
        "allow_other": bool(spec.get("allow_other")),
    }
    kind = spec.get("kind")
    if kind:
        payload["kind"] = str(kind)
        if kind == "run_approval":
            payload["context"] = {"workflow_name": payload["prompt"]}
    return payload


def pending_ask(blocks: list[dict], message_id: str) -> Optional[dict]:
    for block in reversed(blocks):
        if block.get("type") == "ask" and block.get("status") == "pending":
            return ask_payload(message_id, str(block.get("ask_id") or ""), block)
    return None


def native_blocks(blocks: list[dict]) -> list[dict]:
    out: list[dict] = []
    for b in blocks:
        kind = b.get("type")
        if kind == "tool_use":
            out.append({"type": "tool_call", "tool_call_id": b.get("id") or b.get("name"),
                        "tool_name": b.get("name"), "args": b.get("input") or {},
                        "status": "running"})
        elif kind == "tool_result":
            call_id = b.get("id") or b.get("name")
            for prev in reversed(out):
                if prev.get("type") == "tool_call" and prev.get("tool_call_id") == call_id \
                        and prev.get("status") == "running":
                    prev.update({"status": b.get("status") or "success",
                                 "result": b.get("text")})
                    if b.get("duration_ms") is not None:
                        prev["duration_ms"] = b["duration_ms"]
                    break
            else:
                out.append({"type": "tool_call", "tool_call_id": call_id,
                            "tool_name": b.get("name"),
                            "status": b.get("status") or "success",
                            "result": b.get("text")})
        elif kind == 'hermes_interaction':
            from .hermes_interactions import history_card
            try:
                out.append({'type':'hermes_interaction','interaction':history_card(b.get('interaction'))})
            except (ValueError,TypeError,KeyError):
                pass
        elif kind in ("text", "notice", "ask", "skill", "ref"):
            out.append(dict(b))
    return out


def _attachment_ref(block: dict) -> Optional[str]:
    if block.get("type") not in _MEDIA:
        return None
    if block.get("asset_id") is not None:
        return f"asset:{block['asset_id']}"
    return str(block["input_name"]) if block.get("input_name") else None


def user_content(blocks: list[dict]) -> dict:
    content: dict[str, Any] = {"text": _text_of(blocks)}
    for block in blocks:
        if block.get('type') == 'attachment_manifest':
            content['attachment_manifest'] = block['manifest']
            content['text'] = "\n".join(str(b.get('text') or '') for b in blocks if b.get('type') == 'text')
    refs, previews, labels = [], {}, {}
    for b in blocks:
        ref = _attachment_ref(b)
        if ref is None:
            continue
        refs.append(ref)
        if b.get("url"):
            previews[ref] = str(b["url"])
        if b.get("name"):
            labels[ref] = str(b["name"])
    if refs:
        content["attachments"] = refs
        content["attachment_previews"] = previews
        content["attachment_labels"] = labels
    refs = [b for b in blocks if b.get("type") == "ref"]
    if refs:
        content["refs"] = refs
    return content


def assistant_content(blocks: list[dict]) -> dict:
    return {"text": _text_of(blocks), "blocks": native_blocks(blocks)}


def to_agent_message(row: dict, seq: int, live_blocks: Optional[list[dict]] = None) -> dict:
    blocks = live_blocks if live_blocks is not None else blocks_of(row.get("content"))
    role = str(row.get("role") or "assistant")
    turn_id = row.get("parent_id") if role == "assistant" and row.get("parent_id") else row["id"]
    out = {
        "id": row["id"],
        "thread_id": row.get("chat_id") or "",
        "seq": seq,
        "role": role,
        "status": _STATUS.get(str(row.get("status") or "done"), "complete"),
        "turn_id": turn_id,
        "content": user_content(blocks) if role == "user" else assistant_content(blocks),
        "created_at": row.get("created_at"),
    }
    if role == "assistant" and out["status"] == "streaming":
        ask = pending_ask(blocks, row["id"])
        if ask is not None:
            out["pending_ask"] = ask
    if row.get("usage") is not None:
        out["usage"] = row["usage"]
    return out


def thread_summary(chat: dict, rows: list[dict]) -> dict:
    first_user = next((r for r in rows if r.get("role") == "user"), None)
    preview = _text_of(blocks_of(first_user.get("content"))) if first_user else ""
    created = str(chat.get("created_at") or "")
    updated = str((rows[-1].get("created_at") if rows else None)
                  or chat.get("updated_at") or created)
    return {
        "id": chat["id"],
        "title": str(chat.get("title") or preview[:60] or "New chat"),
        "preview": preview[:160],
        "status": "archived" if chat.get("archived") else "active",
        "message_count": len(rows),
        "workflow_id": "",
        "provider": chat.get("provider"),
        "pinned": bool(chat.get("pinned")),
        "created_at": created,
        "updated_at": updated,
        "last_message_at": updated,
    }


def pagination(count: int) -> dict:
    return {"has_more": False, "limit": max(count, 1), "offset": 0, "total": count}
