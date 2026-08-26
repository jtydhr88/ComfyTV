import json
from typing import Optional

from sqlalchemy import func, select

from .. import db
from ..db import EaglePending

__all__ = [
    "enqueue_eagle_send",
    "list_eagle_pending",
    "eagle_pending_count",
    "delete_eagle_pending",
    "resolve_eagle_pending",
]


def _to_dict(row: EaglePending) -> dict:
    try:
        tags = json.loads(row.tags_json) if row.tags_json else []
    except (ValueError, TypeError):
        tags = []
    return {
        "id": row.id,
        "payload_url": row.payload_url,
        "name": row.name or "",
        "tags": tags if isinstance(tags, list) else [],
        "annotation": row.annotation,
        "folder": row.folder,
        "status": row.status,
        "error": row.error,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def enqueue_eagle_send(
    *,
    payload_url: str,
    name: str = "",
    tags: Optional[list[str]] = None,
    annotation: Optional[str] = None,
    folder: Optional[str] = None,
) -> dict:
    with db.get_session() as s:
        existing = s.execute(
            select(EaglePending).where(
                EaglePending.payload_url == payload_url,
                EaglePending.status.in_(("pending", "error")),
            )
        ).scalars().first()
        if existing is not None:
            return _to_dict(existing)
        row = EaglePending(
            payload_url=payload_url,
            name=name or "",
            tags_json=json.dumps(tags) if tags else None,
            annotation=annotation,
            folder=folder,
        )
        s.add(row)
        s.commit()
        return _to_dict(row)


def list_eagle_pending(limit: int = 200) -> list[dict]:
    with db.get_session() as s:
        rows = s.execute(
            select(EaglePending)
            .where(EaglePending.status.in_(("pending", "error")))
            .order_by(EaglePending.id)
            .limit(limit)
        ).scalars().all()
        return [_to_dict(r) for r in rows]


def eagle_pending_count() -> int:
    with db.get_session() as s:
        return int(s.execute(
            select(func.count()).select_from(EaglePending)
            .where(EaglePending.status.in_(("pending", "error")))
        ).scalar_one())


def delete_eagle_pending(pending_id: int) -> bool:
    with db.get_session() as s:
        row = s.get(EaglePending, pending_id)
        if row is None:
            return False
        s.delete(row)
        s.commit()
        return True


def resolve_eagle_pending(pending_id: int, *, error: Optional[str] = None) -> None:
    with db.get_session() as s:
        row = s.get(EaglePending, pending_id)
        if row is None:
            return
        if error is None:
            s.delete(row)
        else:
            row.status = "error"
            row.error = error[:2000]
        s.commit()
