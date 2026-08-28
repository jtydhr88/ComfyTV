import json
import logging
from pathlib import Path
from typing import Optional

from ..vendor.workflow_to_api import WorkflowConversionError, convert_ui_to_api
from ... import db

_log = logging.getLogger(__name__)


def _node_schema(name: str, cls) -> Optional[dict]:
    getter = getattr(cls, "GET_NODE_INFO_V1", None)
    if getter is not None:
        try:
            return dict(getter())
        except Exception:
            pass
    try:
        input_types = cls.INPUT_TYPES()
    except Exception as e:
        _log.warning("[ComfyTV/convert] INPUT_TYPES() raised for %s: %s", name, e)
        return None
    if not isinstance(input_types, dict):
        return None
    return {
        "input": input_types,
        "input_order": {
            section: list(spec.keys())
            for section, spec in input_types.items()
            if isinstance(spec, dict)
        },
        "output_node": bool(getattr(cls, "OUTPUT_NODE", False)),
    }


def build_object_info() -> dict:
    import nodes

    mappings = getattr(nodes, "NODE_CLASS_MAPPINGS", {}) or {}
    out: dict = {}
    try:
        import folder_paths
        cache_ctx = folder_paths.cache_helper
    except (ImportError, AttributeError):
        cache_ctx = None

    def _build() -> None:
        for name, cls in mappings.items():
            schema = _node_schema(name, cls)
            if schema is not None:
                out[name] = schema

    if cache_ctx is not None:
        with cache_ctx:
            _build()
    else:
        _build()
    return out


def convert_gui_to_api(gui_json: dict) -> dict:
    return convert_ui_to_api(gui_json, build_object_info())


def convert_row(s, row) -> dict:
    from .bindings import _prune_orphaned_bindings

    path = Path(row.file_path or "")
    if not row.file_path or not path.exists():
        raise FileNotFoundError(f"workflow file missing: {row.file_path or '<none>'}")
    try:
        gui_json = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        raise WorkflowConversionError(f"could not read workflow file: {e}")

    api_json = convert_gui_to_api(gui_json)
    if not api_json:
        raise WorkflowConversionError(
            "conversion emitted an empty prompt (0 nodes) — nothing was saved. "
            "If this workflow needs frontend-only conversion, open it in ComfyUI, "
            "use 'Save (API Format)' and store the result as an .api.json sidecar."
        )
    mtime = path.stat().st_mtime
    row.api_json = json.dumps(api_json)
    row.file_mtime = mtime
    _prune_orphaned_bindings(s, row, api_json)
    s.commit()
    _log.info(
        "[ComfyTV/convert] converted %s/%s server-side (%d nodes)",
        row.kind, row.label, len(api_json),
    )
    return {"api_json": api_json, "file_mtime": mtime, "node_count": len(api_json)}


def convert_workflow(kind: str, label: str) -> dict:
    from sqlalchemy import select

    db.init()
    with db.get_session() as s:
        row = s.execute(
            select(db.Workflow).where(db.Workflow.kind == kind, db.Workflow.label == label)
        ).scalar_one_or_none()
        if row is None:
            raise FileNotFoundError(f"workflow not found: {kind}/{label}")
        return convert_row(s, row)
