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


def _server_to_dict(r: ComfyServer) -> dict:
    return {
        "id": r.id,
        "label": r.label,
        "host": r.host,
        "port": int(r.port or 8188),
        "enabled": bool(r.enabled),
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


def list_servers() -> list[dict]:
    with db.get_session() as s:
        rows = s.execute(select(ComfyServer).order_by(ComfyServer.id)).scalars().all()
        return [_server_to_dict(r) for r in rows]


def get_server(server_id: int) -> Optional[dict]:
    with db.get_session() as s:
        row = s.get(ComfyServer, server_id)
        return _server_to_dict(row) if row else None


def create_server(*, label: str, host: str, port: int) -> Optional[dict]:
    label = (label or "").strip()
    host = (host or "").strip()
    if not label or not host:
        return None
    with db.get_session() as s:
        exists = s.execute(
            select(ComfyServer.id).where(ComfyServer.label == label)
        ).scalar_one_or_none()
        if exists is not None:
            return None
        row = ComfyServer(label=label, host=host, port=int(port or 8188))
        s.add(row)
        s.commit()
        return _server_to_dict(row)


def update_server(
    server_id: int,
    *,
    label: Optional[str] = None,
    host: Optional[str] = None,
    port: Optional[int] = None,
    enabled: Optional[bool] = None,
) -> Optional[dict]:
    with db.get_session() as s:
        row = s.get(ComfyServer, server_id)
        if row is None:
            return None
        if label is not None and label.strip():
            clash = s.execute(
                select(ComfyServer.id)
                    .where(ComfyServer.label == label.strip())
                    .where(ComfyServer.id != server_id)
            ).scalar_one_or_none()
            if clash is not None:
                return None
            row.label = label.strip()
        if host is not None and host.strip():
            row.host = host.strip()
        if port is not None:
            row.port = int(port)
        if enabled is not None:
            row.enabled = bool(enabled)
        s.commit()
        return _server_to_dict(row)


def delete_server(server_id: int) -> bool:
    with db.get_session() as s:
        row = s.get(ComfyServer, server_id)
        if row is None:
            return False
        s.delete(row)
        s.commit()
        return True
