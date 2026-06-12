import json
import logging
import uuid
from typing import Any, Optional

from sqlalchemy import desc, select

from . import db
from .db import Entry, Output, Project

logger = logging.getLogger(__name__)

DEFAULT_PROJECT_ID = "default"
DEFAULT_PROJECT_NAME = "Default"

OUTPUT_RETENTION_PER_STAGE = 50

def ensure_default_project() -> dict:
    with db.get_session() as s:
        proj = s.get(Project, DEFAULT_PROJECT_ID)
        if proj is None:
            proj = Project(id=DEFAULT_PROJECT_ID, name=DEFAULT_PROJECT_NAME)
            s.add(proj)
            s.commit()
            logger.info("[ComfyTV] created default project")
            _seed_defaults(s, DEFAULT_PROJECT_ID)
        return _project_to_dict(proj)


def list_projects() -> list[dict]:
    with db.get_session() as s:
        rows = s.execute(select(Project).order_by(Project.updated_at.desc())).scalars().all()
        return [_project_to_dict(p) for p in rows]


def get_project(project_id: str) -> Optional[dict]:
    with db.get_session() as s:
        proj = s.get(Project, project_id)
        return _project_to_dict(proj) if proj else None


def create_project(name: str = "Untitled") -> dict:
    pid = uuid.uuid4().hex
    with db.get_session() as s:
        proj = Project(id=pid, name=name.strip() or "Untitled")
        s.add(proj)
        s.commit()
        _seed_defaults(s, pid)
        return _project_to_dict(proj)


def rename_project(project_id: str, name: str) -> Optional[dict]:
    with db.get_session() as s:
        proj = s.get(Project, project_id)
        if proj is None:
            return None
        proj.name = name.strip() or proj.name
        s.commit()
        return _project_to_dict(proj)


def delete_project(project_id: str) -> bool:
    if project_id == DEFAULT_PROJECT_ID:
        return False
    with db.get_session() as s:
        proj = s.get(Project, project_id)
        if proj is None:
            return False
        s.query(Output).filter(Output.project_id == project_id).delete()
        s.delete(proj)
        s.commit()
        return True


def _project_to_dict(p: Optional[Project]) -> dict:
    if p is None:
        return {}
    return {
        "id": p.id,
        "name": p.name,
        "blueprint": p.blueprint,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


import re as _re
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
        "output_type": o.output_type,
        "payload_url": o.payload_url,
        "payload_json": json.loads(o.payload_json) if o.payload_json else None,
        "params_json": json.loads(o.params_json) if o.params_json else None,
        "parent_output_id": o.parent_output_id,
        "picked_index": o.picked_index,
        "created_at": o.created_at.isoformat() if o.created_at else None,
    }
