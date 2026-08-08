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
from .projects import DEFAULT_PROJECT_ID, ensure_default_project


OUTPUT_RETENTION_PER_STAGE = 50


def persist_output(
    *,
    project_id: str,
    stage_class: str,
    stage_node_id: Optional[str],
    output_type: str,
    payload_url: str,
    payload_json: Any = None,
    params: Any = None,
    parent_output_id: Optional[int] = None,
    picked_index: Optional[int] = None,
    duration_ms: Optional[int] = None,
) -> Optional[dict]:
    pid = (project_id or "").strip() or DEFAULT_PROJECT_ID
    if pid == DEFAULT_PROJECT_ID:
        ensure_default_project()

    with db.get_session() as s:
        proj = s.get(Project, pid)
        if proj is None:
            logger.warning("[ComfyTV] persist_output: project %s missing; falling back to default", pid)
            ensure_default_project()
            pid = DEFAULT_PROJECT_ID
        out = Output(
            project_id=pid,
            stage_class=stage_class,
            stage_node_id=str(stage_node_id) if stage_node_id is not None else None,
            output_type=output_type,
            payload_url=payload_url or "",
            payload_json=json.dumps(payload_json) if payload_json is not None else None,
            params_json=json.dumps(params, default=str) if params is not None else None,
            parent_output_id=parent_output_id,
            picked_index=int(picked_index) if picked_index is not None else None,
            duration_ms=int(duration_ms) if duration_ms is not None else None,
        )
        s.add(out)
        s.commit()
        new_id = out.id
        if stage_node_id is not None:
            from sqlalchemy import select
            keepers = select(Output.id).where(
                Output.project_id == pid,
                Output.stage_node_id == str(stage_node_id),
            ).order_by(Output.id.desc()).limit(OUTPUT_RETENTION_PER_STAGE)
            referenced_parents = (
                select(Output.parent_output_id)
                .where(Output.parent_output_id.isnot(None))
                .distinct()
            )
            s.query(Output).filter(
                Output.project_id == pid,
                Output.stage_node_id == str(stage_node_id),
                Output.id.notin_(keepers),
                Output.id.notin_(referenced_parents),
            ).delete(synchronize_session=False)
            s.commit()
        return _output_to_dict(out)


def list_outputs(project_id: str, stage_node_id: Optional[str] = None, limit: int = 50) -> list[dict]:
    with db.get_session() as s:
        q = select(Output).where(Output.project_id == project_id)
        if stage_node_id is not None:
            q = q.where(Output.stage_node_id == str(stage_node_id))
        q = q.order_by(desc(Output.id)).limit(limit)
        return [_output_to_dict(o) for o in s.execute(q).scalars().all()]


def latest_output(project_id: str, stage_node_id: str) -> Optional[dict]:
    rows = list_outputs(project_id, stage_node_id=stage_node_id, limit=1)
    return rows[0] if rows else None


def latest_output_by_uid(
    project_id: str, stage_uid: str, output_type: Optional[str] = None
) -> Optional[dict]:
    if not stage_uid:
        return None
    with db.get_session() as s:
        q = (
            select(Output)
            .where(Output.project_id == project_id, Output.stage_uid == str(stage_uid))
        )
        if output_type:
            q = q.where(Output.output_type == str(output_type))
        q = q.order_by(desc(Output.id)).limit(1)
        out = s.execute(q).scalars().first()
        return _output_to_dict(out) if out is not None else None


def set_output_stage_uid(output_id: int, stage_uid: str) -> Optional[dict]:
    if not stage_uid:
        return None
    with db.get_session() as s:
        out = s.get(Output, int(output_id))
        if out is None:
            return None
        out.stage_uid = str(stage_uid)
        s.commit()
        return _output_to_dict(out)


def adopt_outputs(
    project_id: str,
    stage_node_id: str,
    stage_class: str,
    stage_uid: str,
    output_type: Optional[str] = None,
) -> Optional[dict]:
    if not stage_uid or not stage_node_id or not stage_class:
        return None
    with db.get_session() as s:
        q = s.query(Output).filter(
            Output.project_id == project_id,
            Output.stage_node_id == str(stage_node_id),
            Output.stage_class == str(stage_class),
            Output.stage_uid.is_(None),
        )
        if output_type:
            q = q.filter(Output.output_type == str(output_type))
        rows = q.order_by(desc(Output.id)).all()
        if not rows:
            return None
        for r in rows:
            r.stage_uid = str(stage_uid)
        s.commit()
        return _output_to_dict(rows[0])


def find_output_by_param(
    project_id: str,
    stage_class: str,
    param_key: str,
    param_value: str,
    output_type: Optional[str] = None,
) -> Optional[dict]:
    needle = json.dumps({param_key: param_value})[1:-1]
    with db.get_session() as s:
        q = select(Output).where(
            Output.project_id == project_id,
            Output.stage_class == stage_class,
            Output.params_json.contains(needle),
        )
        if output_type:
            q = q.where(Output.output_type == str(output_type))
        q = q.order_by(desc(Output.id)).limit(1)
        out = s.execute(q).scalars().first()
        return _output_to_dict(out) if out is not None else None


def update_output_picked_index(output_id: int, picked_index: int) -> Optional[dict]:
    with db.get_session() as s:
        out = s.get(Output, int(output_id))
        if out is None:
            return None
        out.picked_index = int(picked_index) if picked_index is not None else None
        s.commit()
        return _output_to_dict(out)


def _output_to_dict(o: Output) -> dict:
    return {
        "id": o.id,
        "project_id": o.project_id,
        "stage_class": o.stage_class,
        "stage_node_id": o.stage_node_id,
        "stage_uid": o.stage_uid,
        "output_type": o.output_type,
        "payload_url": o.payload_url,
        "payload_json": json.loads(o.payload_json) if o.payload_json else None,
        "params_json": json.loads(o.params_json) if o.params_json else None,
        "parent_output_id": o.parent_output_id,
        "picked_index": o.picked_index,
        "duration_ms": o.duration_ms,
        "created_at": o.created_at.isoformat() if o.created_at else None,
    }
