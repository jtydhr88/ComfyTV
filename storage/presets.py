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


def _preset_to_dict(p: Preset) -> dict:
    try:
        config = json.loads(p.config) if p.config else {}
    except ValueError:
        config = {}
    return {
        "id": p.id,
        "kind": p.kind,
        "name": p.name,
        "config": config if isinstance(config, dict) else {},
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def list_presets(kind: Optional[str] = None) -> list[dict]:
    with db.get_session() as s:
        q = select(Preset)
        if kind:
            q = q.where(Preset.kind == kind)
        rows = s.execute(q.order_by(Preset.name, Preset.id)).scalars().all()
        return [_preset_to_dict(p) for p in rows]


def save_preset(kind: str, name: str, config: dict) -> Optional[dict]:
    kind = (kind or "").strip()
    name = (name or "").strip()
    if not kind or not name or not isinstance(config, dict):
        return None
    with db.get_session() as s:
        row = s.execute(
            select(Preset).where(Preset.kind == kind, Preset.name == name).limit(1)
        ).scalar_one_or_none()
        if row is None:
            row = Preset(kind=kind, name=name, config=json.dumps(config))
            s.add(row)
        else:
            row.config = json.dumps(config)
        s.commit()
        return _preset_to_dict(row)


def update_preset(
    preset_id: int,
    *,
    name: Optional[str] = None,
    config: Optional[dict] = None,
) -> Optional[dict]:
    with db.get_session() as s:
        row = s.get(Preset, preset_id)
        if row is None:
            return None
        if name is not None:
            name = name.strip()
            if not name:
                return None
            clash = s.execute(
                select(Preset.id)
                    .where(Preset.kind == row.kind, Preset.name == name,
                           Preset.id != preset_id)
                    .limit(1)
            ).scalar_one_or_none()
            if clash is not None:
                return None
            row.name = name
        if config is not None:
            if not isinstance(config, dict):
                return None
            row.config = json.dumps(config)
        s.commit()
        return _preset_to_dict(row)


def delete_preset(preset_id: int) -> bool:
    with db.get_session() as s:
        row = s.get(Preset, preset_id)
        if row is None:
            return False
        s.delete(row)
        s.commit()
        return True
