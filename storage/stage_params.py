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


STAGE_PARAM_TYPES: tuple[str, ...] = ("boolean", "int", "float", "string", "combo")


_UNSET = object()


def _slugify_param_key(label: str) -> str:
    base = _re.sub(r"[^a-z0-9]+", "_", (label or "").strip().lower()).strip("_")
    return base or "param"


def seed_system_stage_params() -> int:
    from ..nodes.stages.common.caps import builtin_option_rows
    seeded = 0
    with db.get_session() as s:
        existing = {
            (r.kind, r.key)
            for r in s.execute(select(StageParam.kind, StageParam.key)).all()
        }
        for row in builtin_option_rows():
            kp = (row["kind"], row["key"])
            if kp in existing:
                continue
            s.add(StageParam(
                kind=row["kind"], key=row["key"], label=row["label"],
                type=row["type"], default_json=None, config_json=None,
                origin=0, order_=0,
            ))
            existing.add(kp)
            seeded += 1
        if seeded:
            s.commit()
    return seeded


def _stage_param_to_dict(p: StageParam) -> dict:
    return {
        "id": p.id,
        "kind": p.kind,
        "key": p.key,
        "label": p.label,
        "type": p.type,
        "default": json.loads(p.default_json) if p.default_json else None,
        "config": json.loads(p.config_json) if p.config_json else {},
        "origin": int(p.origin or 0),
        "order": p.order_,
    }


def list_stage_params(kind: Optional[str] = None) -> list[dict]:
    with db.get_session() as s:
        q = select(StageParam)
        if kind:
            q = q.where(StageParam.kind == kind)
        q = q.order_by(StageParam.kind, StageParam.order_, StageParam.id)
        rows = s.execute(q).scalars().all()
        return [_stage_param_to_dict(p) for p in rows]


def create_stage_param(
    *,
    kind: str,
    label: str,
    type: str,
    default=None,
    config: Optional[dict] = None,
    origin: int = 1,
) -> Optional[dict]:
    kind = (kind or "").strip()
    label = (label or "").strip()
    if not kind or not label:
        return None
    if type not in STAGE_PARAM_TYPES:
        return None
    with db.get_session() as s:
        base = _slugify_param_key(label)
        existing = set(s.execute(
            select(StageParam.key).where(StageParam.kind == kind)
        ).scalars().all())
        key = base
        n = 2
        while key in existing:
            key = f"{base}_{n}"
            n += 1
        max_order = s.execute(
            select(StageParam.order_).where(StageParam.kind == kind)
                .order_by(StageParam.order_.desc()).limit(1)
        ).scalar_one_or_none()
        row = StageParam(
            kind=kind,
            key=key,
            label=label,
            type=type,
            default_json=json.dumps(default) if default is not None else None,
            config_json=json.dumps(config) if config else None,
            origin=int(origin),
            order_=(max_order or 0) + 10,
        )
        s.add(row)
        s.commit()
        return _stage_param_to_dict(row)


def update_stage_param(
    param_id: int,
    *,
    label: Optional[str] = None,
    type: Optional[str] = None,
    default=_UNSET,
    config=_UNSET,
    order: Optional[int] = None,
) -> Optional[dict]:
    with db.get_session() as s:
        row = s.get(StageParam, param_id)
        if row is None:
            return None
        if row.origin == 0:
            return None
        if label is not None:
            label = label.strip()
            if label:
                row.label = label
        if type is not None and type in STAGE_PARAM_TYPES:
            row.type = type
        if default is not _UNSET:
            row.default_json = json.dumps(default) if default is not None else None
        if config is not _UNSET:
            row.config_json = json.dumps(config) if config else None
        if order is not None:
            row.order_ = int(order)
        s.commit()
        return _stage_param_to_dict(row)


def delete_stage_param(param_id: int) -> bool:
    with db.get_session() as s:
        row = s.get(StageParam, param_id)
        if row is None or row.origin == 0:
            return False
        s.delete(row)
        s.commit()
        return True
