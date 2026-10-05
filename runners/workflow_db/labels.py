import json
import logging
import re
from pathlib import Path
from typing import Optional

from sqlalchemy import select

from ... import db

_log = logging.getLogger(__name__)


def _is_gui_format(content: str) -> bool:
    try:
        obj = json.loads(content)
    except (json.JSONDecodeError, ValueError):
        return False
    return (
        isinstance(obj, dict)
        and isinstance(obj.get("nodes"), list)
    )


def _label_from_stem(stem: str) -> str:
    return stem.strip()


def _free_label(s, kind: str, wanted: str, exclude_id: Optional[int] = None) -> str:
    base = wanted
    n = 2
    while True:
        q = select(db.Workflow.id).where(
            (db.Workflow.kind == kind) & (db.Workflow.label == wanted)
        )
        if exclude_id is not None:
            q = q.where(db.Workflow.id != exclude_id)
        if s.execute(q).first() is None:
            return wanted
        wanted = f"{base}-{n}"
        n += 1


def _claim_label_or_skip(s, row: db.Workflow, new_label: str) -> bool:
    existing = s.execute(
        select(db.Workflow).where(
            (db.Workflow.kind == row.kind)
            & (db.Workflow.label == new_label)
            & (db.Workflow.id != row.id)
        )
    ).scalar_one_or_none()
    if existing is None:
        row.label = new_label
        return True

    other_path = Path(existing.file_path) if existing.file_path else None
    if other_path is None or not other_path.exists():
        s.execute(
            db.WorkflowInputBinding.__table__.delete().where(
                db.WorkflowInputBinding.workflow_id == existing.id
            )
        )
        s.delete(existing)
        s.flush()
        row.label = new_label
        _log.info(
            "[ComfyTV/workflow_db] reclaimed label %r from orphan row id=%s "
            "(stale file_path=%s) for %s",
            new_label, existing.id, existing.file_path, row.file_path,
        )
        return True

    _log.warning(
        "[ComfyTV/workflow_db] preset label %r for %s already owned by %s "
        "(row id=%s); keeping default label %r",
        new_label, row.file_path, existing.file_path, existing.id, row.label,
    )
    return False


def _safe_stem(filename: str) -> str:
    stem = Path(filename or "").name
    if stem.lower().endswith(".json"):
        stem = stem[:-5]
    stem = re.sub(r"[^A-Za-z0-9._-]+", "-", stem).strip("-._ ")
    return stem
