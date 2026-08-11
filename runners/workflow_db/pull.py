import json
import logging
from pathlib import Path
from typing import Optional

from sqlalchemy import select

from ... import db
from .seed import (
    _free_label, _is_gui_format, _label_from_stem, _safe_stem,
    _upsert_workflow_row, _workflows_dir,
)

_log = logging.getLogger(__name__)


def _row_meta(row) -> dict:
    if not row.meta_json:
        return {}
    try:
        meta = json.loads(row.meta_json)
    except json.JSONDecodeError:
        return {}
    return meta if isinstance(meta, dict) else {}


def pulled_workflows(kind: str, server_id: int) -> dict[str, str]:
    db.init()
    out: dict[str, str] = {}
    with db.get_session() as s:
        rows = s.execute(
            select(db.Workflow).where(db.Workflow.kind == kind)
        ).scalars().all()
        for row in rows:
            src = _row_meta(row).get("pulled_from")
            if isinstance(src, dict) and src.get("server_id") == server_id:
                path = src.get("path")
                if isinstance(path, str):
                    out[path] = row.label
    return out


def import_pulled_workflow(kind: str, source: dict, filename: str, content: str) -> dict:
    db.init()
    stem = _safe_stem(filename)
    if not stem:
        raise ValueError("invalid or empty filename")
    if not _is_gui_format(content):
        raise ValueError(
            "not a GUI-format workflow (missing a top-level 'nodes' array) — "
            "save it on the remote with normal Save, not 'Save (API Format)'"
        )

    kind_dir = _workflows_dir() / kind
    kind_dir.mkdir(parents=True, exist_ok=True)

    target: Optional[Path] = None
    with db.get_session() as s:
        rows = s.execute(
            select(db.Workflow).where(db.Workflow.kind == kind)
        ).scalars().all()
        for row in rows:
            if _row_meta(row).get("pulled_from") == source:
                target = Path(row.file_path)
                break
    if target is None or target.parent != kind_dir:
        final = stem
        n = 2
        while (kind_dir / f"{final}.json").exists():
            final = f"{stem}-{n}"
            n += 1
        target = kind_dir / f"{final}.json"
    target.write_text(content, encoding="utf-8")

    with db.get_session() as s:
        row, is_new = _upsert_workflow_row(s, kind, target)
        if is_new:
            wanted = _label_from_stem(stem)
            if wanted:
                row.label = _free_label(s, kind, wanted, row.id)
        meta = _row_meta(row)
        meta["pulled_from"] = source
        row.meta_json = json.dumps(meta, ensure_ascii=False)
        label = row.label
        s.commit()

    _log.info("[ComfyTV/workflow_db] pulled workflow %s/%s from %s",
              kind, label, source)
    return {"ok": True, "kind": kind, "label": label, "file_path": str(target)}
