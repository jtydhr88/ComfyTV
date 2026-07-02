import logging
from pathlib import Path
from typing import Optional

from sqlalchemy import select

from ... import db
from .seed import _label_from_stem, _is_gui_format

_log = logging.getLogger(__name__)


def _native_workflows_dir() -> Optional[Path]:
    try:
        import folder_paths
    except Exception:
        return None
    try:
        return Path(folder_paths.get_user_directory()) / "default" / "workflows"
    except Exception:
        return None


def _resolve_native_path(rel_path: str) -> Optional[Path]:
    root = _native_workflows_dir()
    if root is None:
        return None
    root = root.resolve()
    candidate = (root / rel_path).resolve()
    try:
        if candidate != root and root not in candidate.parents:
            return None
    except Exception:
        return None
    return candidate


def list_native_workflows(kind: Optional[str] = None) -> list[dict]:
    root = _native_workflows_dir()
    if root is None or not root.is_dir():
        return []

    root = root.resolve()
    db.init()
    with db.get_session() as s:
        q = select(db.Workflow.file_path, db.Workflow.id).where(
            db.Workflow.link_type == db.LINK_TYPE_NATIVE
        )
        if kind:
            q = q.where(db.Workflow.kind == kind)
        linked_by_path: dict[str, int] = {}
        for p, rid in s.execute(q).all():
            try:
                linked_by_path[str(Path(p).resolve())] = rid
            except Exception:
                continue

    items: list[dict] = []
    for path in root.rglob("*.json"):
        if not path.is_file():
            continue
        if path.stem.endswith("_preset") or path.name.endswith(".api.json"):
            continue
        try:
            st = path.stat()
        except OSError:
            continue
        rel = path.relative_to(root).as_posix()
        linked_id = linked_by_path.get(str(path.resolve()))
        items.append({
            "path":     rel,
            "name":     path.stem,
            "mtime":    st.st_mtime,
            "size":     st.st_size,
            "is_linked": linked_id is not None,
            "linked_id": linked_id,
        })
    items.sort(key=lambda it: it["mtime"], reverse=True)
    return items


def link_workflow(kind: str, rel_path: str, label: Optional[str] = None) -> dict:
    db.init()

    path = _resolve_native_path(rel_path)
    if path is None:
        raise ValueError("path is outside ComfyUI's workflow library")
    if not path.is_file():
        raise ValueError(f"workflow file not found: {rel_path}")

    try:
        content = path.read_text(encoding="utf-8")
    except OSError as e:
        raise ValueError(f"could not read workflow file: {e}")
    if not _is_gui_format(content):
        raise ValueError(
            "not a GUI-format workflow (missing a top-level 'nodes' array)"
        )

    lbl = (label or "").strip() or _label_from_stem(path.stem)
    abs_path = str(path)
    mtime = path.stat().st_mtime

    with db.get_session() as s:
        dup_label = s.execute(
            select(db.Workflow).where(
                db.Workflow.kind == kind, db.Workflow.label == lbl
            )
        ).scalar_one_or_none()
        if dup_label is not None:
            raise ValueError(f"a workflow named {lbl!r} already exists for {kind}")

        dup_link = s.execute(
            select(db.Workflow).where(
                db.Workflow.kind == kind, db.Workflow.file_path == abs_path
            )
        ).scalar_one_or_none()
        if dup_link is not None:
            raise ValueError("this workflow is already linked for this kind")

        row = db.Workflow(
            kind=kind,
            label=lbl,
            file_path=abs_path,
            file_mtime=mtime,
            link_type=db.LINK_TYPE_NATIVE,
            order_=100,
        )
        s.add(row)
        s.commit()
        result = {"kind": row.kind, "label": row.label, "id": row.id,
                  "file_path": row.file_path, "link_type": db.LINK_TYPE_NATIVE}

    _log.info("[ComfyTV/workflow_db] linked %s/%s -> %s", kind, lbl, abs_path)
    return result


def unlink_workflow(workflow_id: int) -> Optional[dict]:
    db.init()
    with db.get_session() as s:
        row = s.get(db.Workflow, workflow_id)
        if row is None:
            return None
        if row.link_type != db.LINK_TYPE_NATIVE:
            raise ValueError("only linked workflows can be unlinked")
        info = {"kind": row.kind, "label": row.label}
        s.execute(
            db.WorkflowInputBinding.__table__.delete()
            .where(db.WorkflowInputBinding.workflow_id == row.id)
        )
        s.delete(row)
        s.commit()
    _log.info("[ComfyTV/workflow_db] unlinked %s/%s", info["kind"], info["label"])
    return {"ok": True, **info}
