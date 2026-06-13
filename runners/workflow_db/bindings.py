import json
import logging
from pathlib import Path
from typing import Any, Optional

from sqlalchemy import select

from ... import db


_log = logging.getLogger(__name__)


def _api_json_matches_gui_workflow(file_path: str, api_json: Any) -> bool:
    if not isinstance(api_json, dict) or not api_json:
        return False
    if not file_path or not Path(file_path).exists():
        return True
    try:
        with open(file_path, encoding="utf-8") as f:
            doc = json.load(f)
    except (OSError, json.JSONDecodeError):
        return True
    if not isinstance(doc, dict):
        return True
    nodes = doc.get("nodes")
    if not isinstance(nodes, list) or not nodes:
        return True
    gui_top_ids = {
        str(n.get("id")) for n in nodes
        if isinstance(n, dict) and n.get("id") is not None
    }
    if not gui_top_ids:
        return True
    for key in api_json.keys():
        if str(key).split(":", 1)[0] in gui_top_ids:
            return True
    return False


def upsert_input_binding(
    workflow_id: int,
    node_id: str,
    input_name: str,
    from_: str,
    default: Optional[str] = None,
    prefix: Optional[str] = None,
    suffix: Optional[str] = None,
    required: bool = False,
    error_msg: Optional[str] = None,
    cast: Optional[str] = None,
) -> bool:
    db.init()
    with db.get_session() as s:
        row = s.get(db.Workflow, workflow_id)
        if row is None:
            return False
        existing = s.get(db.WorkflowInputBinding, (workflow_id, node_id, input_name))
        if existing is None:
            existing = db.WorkflowInputBinding(
                workflow_id=workflow_id, node_id=node_id, input_name=input_name,
                from_=from_,
            )
            s.add(existing)
        existing.from_         = from_
        existing.default_value = default
        existing.prefix        = prefix
        existing.suffix        = suffix
        existing.required      = bool(required)
        existing.error_msg     = error_msg
        existing.cast_         = cast
        s.commit()
    return True


def delete_input_binding(workflow_id: int, node_id: str, input_name: str) -> bool:
    db.init()
    with db.get_session() as s:
        existing = s.get(db.WorkflowInputBinding, (workflow_id, node_id, input_name))
        if existing is None:
            return False
        s.delete(existing)
        s.commit()
    return True


_SENTINEL = object()


def update_workflow_meta(
    workflow_id: int,
    *,
    description: Any = _SENTINEL,
    result_type: Any = _SENTINEL,
    result_node: Any = _SENTINEL,
    sizing: Any = _SENTINEL,
    prune_when_missing: Any = _SENTINEL,
) -> bool:
    db.init()
    with db.get_session() as s:
        row = s.get(db.Workflow, workflow_id)
        if row is None:
            return False
        if description is not _SENTINEL: row.description = description
        if result_type is not _SENTINEL: row.result_type = result_type
        if result_node is not _SENTINEL: row.result_node = result_node
        if sizing is not _SENTINEL:
            row.sizing_json = json.dumps(sizing) if sizing else None
        if prune_when_missing is not _SENTINEL:
            row.prune_when_missing_json = (
                json.dumps(prune_when_missing) if prune_when_missing else None
            )
        s.commit()
    return True


def list_workflow_bindings() -> list[dict]:
    db.init()
    with db.get_session() as s:
        out: list[dict] = []
        rows = s.execute(
            select(db.Workflow).order_by(db.Workflow.kind, db.Workflow.order_, db.Workflow.label)
        ).scalars().all()
        for row in rows:
            bindings = s.execute(
                select(db.WorkflowInputBinding)
                .where(db.WorkflowInputBinding.workflow_id == row.id)
            ).scalars().all()
            out.append({
                "kind":     row.kind,
                "label":    row.label,
                "bindings": [
                    {"from": b.from_, "required": b.required}
                    for b in bindings
                ],
            })
        return out


def list_workflows() -> list[dict]:
    db.init()
    with db.get_session() as s:
        rows = s.execute(
            select(db.Workflow).order_by(db.Workflow.kind, db.Workflow.order_, db.Workflow.label)
        ).scalars().all()
        return [
            {
                "kind":  r.kind,
                "label": r.label,
                "order": r.order_,
                "description": r.description,
            }
            for r in rows
        ]


def get_workflow_state(kind: str, label: str) -> Optional[dict]:
    db.init()
    with db.get_session() as s:
        row = s.execute(
            select(db.Workflow).where(db.Workflow.kind == kind, db.Workflow.label == label)
        ).scalar_one_or_none()
        if row is None:
            return None
        path = Path(row.file_path)
        cur_mtime = path.stat().st_mtime if path.exists() else None

        if cur_mtime is not None and row.file_mtime is not None \
                and cur_mtime != row.file_mtime:
            row.api_json = None
            row.file_mtime = cur_mtime
            s.commit()

        if row.api_json:
            try:
                api = json.loads(row.api_json)
            except (json.JSONDecodeError, TypeError):
                api = None
            if not _api_json_matches_gui_workflow(row.file_path, api):
                _log.warning(
                    "[ComfyTV/workflow_db] api_json for %s/%s does not match "
                    "the workflow file (keys=%s); wiping so prepareWorkflow "
                    "regenerates it.",
                    row.kind, row.label,
                    list(api.keys())[:6] if isinstance(api, dict) else None,
                )
                row.api_json = None
                s.commit()

        return {
            "has_api":    bool(row.api_json),
            "file_path":  row.file_path,
            "file_mtime": row.file_mtime,
            "file_exists": path.exists(),
        }


def read_workflow_file(kind: str, label: str) -> Optional[tuple[str, float]]:
    db.init()
    with db.get_session() as s:
        row = s.execute(
            select(db.Workflow).where(db.Workflow.kind == kind, db.Workflow.label == label)
        ).scalar_one_or_none()
        if row is None:
            return None
        path = Path(row.file_path)
        if not path.exists():
            return None
        try:
            content = path.read_text(encoding="utf-8")
        except OSError as e:
            _log.warning("[ComfyTV/workflow_db] read %s failed: %s", path, e)
            return None
        return content, path.stat().st_mtime


def set_api_json(kind: str, label: str, api_json: dict, file_mtime: float) -> bool:
    db.init()
    with db.get_session() as s:
        row = s.execute(
            select(db.Workflow).where(db.Workflow.kind == kind, db.Workflow.label == label)
        ).scalar_one_or_none()
        if row is None:
            return False
        row.api_json = json.dumps(api_json)
        row.file_mtime = file_mtime

        valid_ids = {str(k) for k in api_json.keys()} if isinstance(api_json, dict) else set()
        bindings = s.execute(
            select(db.WorkflowInputBinding)
            .where(db.WorkflowInputBinding.workflow_id == row.id)
        ).scalars().all()
        orphaned = [b for b in bindings if str(b.node_id) not in valid_ids]
        for b in orphaned:
            s.delete(b)
        if orphaned:
            gone = sorted({str(b.node_id) for b in orphaned})
            _log.warning(
                "[ComfyTV/workflow_db] %s/%s: pruned %d orphaned binding(s) after "
                "a workflow change — node id(s) gone: %s. Re-map these inputs in "
                "the Workflow Config sidebar if they're still needed.",
                kind, label, len(orphaned), gone[:8],
            )
            from ..notify import notify_toast
            notify_toast(
                "warn",
                f"{label}: workflow changed",
                f"{len(orphaned)} input mapping(s) no longer match this workflow "
                f"(node id(s) {', '.join(gone[:5])}) and were removed. Re-map them "
                f"in the Workflow Config sidebar.",
            )
        s.commit()
    return True
