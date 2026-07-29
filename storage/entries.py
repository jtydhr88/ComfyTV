import json
import logging
import os
import re as _re
import uuid
from typing import Any, Optional

from sqlalchemy import desc, select

from .. import db
from ..db import (
    Asset, AssetCategory, AssetCategoryLink, ComfyServer, Entry, Output,
    Preset, Project, ProxyMedia, RemoteJob, Resource, StageParam,
)

logger = logging.getLogger(__name__)


_ENTRY_LABEL_RE = _re.compile(r"^[^\W\d][\w-]*$")


ENTRY_KINDS: tuple[str, ...] = ("fragment",)


_DEFAULT_FRAGMENTS = [
    ("subject",  "a young Asian businesswoman, 30s, sharp jawline"),
    ("style",    "cinematic photograph, golden hour, shallow depth of field"),
    ("lighting", "rim light from behind, soft fill from the front"),
]


def _entry_to_dict(e: Entry) -> dict:
    return {
        "id":         e.id,
        "kind":       e.kind,
        "label":      e.label,
        "content":    e.content or "",
        "metadata":   json.loads(e.metadata_json) if e.metadata_json else {},
        "updated_at": e.updated_at.isoformat() if e.updated_at else None,
    }


def project_exists(project_id: str) -> bool:
    with db.get_session() as s:
        return s.get(Project, project_id) is not None


def list_entries(project_id: str) -> list[dict]:
    with db.get_session() as s:
        rows = s.execute(
            select(Entry)
                .where(Entry.project_id == project_id)
                .order_by(Entry.kind, Entry.label, Entry.id)
        ).scalars().all()
        return [_entry_to_dict(e) for e in rows]


def upsert_entry(
    project_id: str,
    *,
    kind: str,
    label: str,
    content: str,
    metadata: Optional[dict] = None,
    entry_id: Optional[int] = None,
) -> Optional[dict]:
    label = (label or "").strip()
    if not _ENTRY_LABEL_RE.match(label):
        return None
    if kind not in ENTRY_KINDS:
        return None
    meta_json = json.dumps(metadata) if metadata else None
    with db.get_session() as s:
        if entry_id is not None:
            row = s.get(Entry, entry_id)
            if row is None or row.project_id != project_id:
                return None
            row.kind = kind
            row.label = label
            row.content = content or ""
            row.metadata_json = meta_json
        else:
            row = Entry(
                project_id=project_id, kind=kind, label=label,
                content=content or "", metadata_json=meta_json,
            )
            s.add(row)
        s.commit()
        return _entry_to_dict(row)


def delete_entry(project_id: str, entry_id: int) -> bool:
    with db.get_session() as s:
        row = s.get(Entry, entry_id)
        if row is None or row.project_id != project_id:
            return False
        s.delete(row)
        s.commit()
        return True


def _seed_defaults(session, project_id: str) -> None:
    existing = session.execute(
        select(Entry.id).where(Entry.project_id == project_id).limit(1)
    ).scalar_one_or_none()
    if existing is not None:
        return
    for label, content in _DEFAULT_FRAGMENTS:
        session.add(Entry(project_id=project_id, kind="fragment", label=label, content=content))
    session.commit()
