import json
import uuid
from typing import Optional

from sqlalchemy import desc, select

from .. import db
from ..db import BotChat, BotMessage


def _prefs_from_json(raw: Optional[str]) -> list[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return []
    return [str(p) for p in parsed] if isinstance(parsed, list) else []


def _chat_to_dict(r: BotChat) -> dict:
    return {
        "id": r.id,
        "title": r.title or "",
        "provider": r.provider or "claude-code",
        "resume_token": r.resume_token,
        "run_mode": r.run_mode or "auto",
        "prefs": _prefs_from_json(r.prefs_json),
        "pinned": bool(r.pinned),
        "archived": bool(r.archived),
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


def _usage_from_json(raw: Optional[str]) -> Optional[dict]:
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None
    return parsed if isinstance(parsed, dict) else None


def _message_to_dict(r: BotMessage) -> dict:
    return {
        "id": r.id,
        "chat_id": r.chat_id,
        "parent_id": r.parent_id,
        "role": r.role,
        "content": r.content or "[]",
        "status": r.status,
        "resume_token_after": r.resume_token_after,
        "usage": _usage_from_json(r.usage_json),
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


def list_bot_chats(*, include_archived: bool = False) -> list[dict]:
    with db.get_session() as s:
        q = select(BotChat)
        if not include_archived:
            q = q.where(BotChat.archived.is_(False))
        q = q.order_by(desc(BotChat.pinned), desc(BotChat.updated_at))
        rows = s.execute(q).scalars().all()
        return [_chat_to_dict(r) for r in rows]


def get_bot_chat(chat_id: str) -> Optional[dict]:
    with db.get_session() as s:
        row = s.get(BotChat, chat_id)
        return _chat_to_dict(row) if row else None


def create_bot_chat(*, provider: str, title: str = "") -> dict:
    with db.get_session() as s:
        row = BotChat(id=uuid.uuid4().hex, title=title, provider=provider)
        s.add(row)
        s.commit()
        return _chat_to_dict(row)


def update_bot_chat(
    chat_id: str,
    *,
    title: Optional[str] = None,
    resume_token: Optional[str] = None,
    run_mode: Optional[str] = None,
    prefs: Optional[list[str]] = None,
    pinned: Optional[bool] = None,
    archived: Optional[bool] = None,
) -> Optional[dict]:
    with db.get_session() as s:
        row = s.get(BotChat, chat_id)
        if row is None:
            return None
        if title is not None:
            row.title = title
        if resume_token is not None:
            row.resume_token = resume_token
        if run_mode is not None:
            row.run_mode = run_mode
        if prefs is not None:
            row.prefs_json = json.dumps(prefs)
        if pinned is not None:
            row.pinned = bool(pinned)
        if archived is not None:
            row.archived = bool(archived)
        s.commit()
        return _chat_to_dict(row)


def delete_bot_chat(chat_id: str) -> bool:
    with db.get_session() as s:
        row = s.get(BotChat, chat_id)
        if row is None:
            return False
        for msg in s.execute(
            select(BotMessage).where(BotMessage.chat_id == chat_id)
        ).scalars().all():
            s.delete(msg)
        s.delete(row)
        s.commit()
        return True


def branch_bot_chat(chat_id: str, message_id: str) -> Optional[dict]:
    with db.get_session() as s:
        source = s.get(BotChat, chat_id)
        if source is None:
            return None
        rows = s.execute(
            select(BotMessage)
            .where(BotMessage.chat_id == chat_id)
            .order_by(BotMessage.created_at, BotMessage.id)
        ).scalars().all()
        cut = next((i for i, r in enumerate(rows) if r.id == message_id), None)
        if cut is None:
            return None
        kept = rows[:cut + 1]

        resume_token = next(
            (r.resume_token_after for r in reversed(kept)
             if r.resume_token_after), None)
        branch = BotChat(
            id=uuid.uuid4().hex,
            title=(source.title or "").strip(),
            provider=source.provider,
            run_mode=source.run_mode,
            resume_token=resume_token,
        )
        s.add(branch)
        s.flush()

        id_map: dict[str, str] = {}
        for r in kept:
            copy = BotMessage(
                id=uuid.uuid4().hex,
                chat_id=branch.id,
                role=r.role,
                content=r.content,
                status=r.status,
                parent_id=id_map.get(r.parent_id or ""),
                resume_token_after=r.resume_token_after,
                usage_json=r.usage_json,
                created_at=r.created_at,
            )
            id_map[r.id] = copy.id
            s.add(copy)
        s.commit()
        return _chat_to_dict(branch)


def list_bot_messages(chat_id: str) -> list[dict]:
    with db.get_session() as s:
        rows = s.execute(
            select(BotMessage)
            .where(BotMessage.chat_id == chat_id)
            .order_by(BotMessage.created_at, BotMessage.id)
        ).scalars().all()
        return [_message_to_dict(r) for r in rows]


def create_bot_message(
    *,
    chat_id: str,
    role: str,
    content: str = "[]",
    status: str = "done",
    parent_id: Optional[str] = None,
) -> dict:
    with db.get_session() as s:
        row = BotMessage(
            id=uuid.uuid4().hex,
            chat_id=chat_id,
            role=role,
            content=content,
            status=status,
            parent_id=parent_id,
        )
        s.add(row)
        s.commit()
        return _message_to_dict(row)


def update_bot_message(
    message_id: str,
    *,
    content: Optional[str] = None,
    status: Optional[str] = None,
    resume_token_after: Optional[str] = None,
    usage: Optional[dict] = None,
) -> Optional[dict]:
    with db.get_session() as s:
        row = s.get(BotMessage, message_id)
        if row is None:
            return None
        if content is not None:
            row.content = content
        if status is not None:
            row.status = status
        if resume_token_after is not None:
            row.resume_token_after = resume_token_after
        if usage is not None:
            row.usage_json = json.dumps(usage)
        s.commit()
        return _message_to_dict(row)
