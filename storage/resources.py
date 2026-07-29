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


def _resource_to_dict(r: Resource) -> dict:
    return {
        "id": r.id,
        "kind": r.kind,
        "name": r.name,
        "filename": r.filename,
        "subfolder": r.subfolder,
        "size": r.size,
        "sha256": r.sha256,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


def list_resources(kind: Optional[str] = None) -> list[dict]:
    with db.get_session() as s:
        q = select(Resource)
        if kind:
            q = q.where(Resource.kind == kind)
        rows = s.execute(q.order_by(Resource.name, Resource.id)).scalars().all()
        return [_resource_to_dict(r) for r in rows]


def register_resource(
    kind: str,
    filename: str,
    subfolder: str,
    *,
    name: Optional[str] = None,
    size: Optional[int] = None,
    sha256: Optional[str] = None,
) -> Optional[dict]:
    kind = (kind or "").strip()
    filename = (filename or "").strip()
    if not kind or not filename:
        return None
    with db.get_session() as s:
        row = s.execute(
            select(Resource)
                .where(Resource.kind == kind, Resource.filename == filename)
                .limit(1)
        ).scalar_one_or_none()
        if row is None:
            row = Resource(
                kind=kind,
                name=(name or "").strip() or os.path.splitext(filename)[0],
                filename=filename,
                subfolder=subfolder or "",
                size=size,
                sha256=sha256,
            )
            s.add(row)
        else:
            if subfolder:
                row.subfolder = subfolder
            if size is not None:
                row.size = size
            if sha256 is not None:
                row.sha256 = sha256
        s.commit()
        return _resource_to_dict(row)


def rename_resource(resource_id: int, name: str) -> Optional[dict]:
    name = (name or "").strip()
    if not name:
        return None
    with db.get_session() as s:
        row = s.get(Resource, resource_id)
        if row is None:
            return None
        row.name = name
        s.commit()
        return _resource_to_dict(row)


def unregister_resource(resource_id: int) -> bool:
    with db.get_session() as s:
        row = s.get(Resource, resource_id)
        if row is None:
            return False
        s.delete(row)
        s.commit()
        return True
