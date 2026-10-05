import json
import logging
from pathlib import Path
from typing import Optional

from ... import db
from .labels import _free_label, _is_gui_format, _label_from_stem, _safe_stem
from .seed import _upsert_workflow_row, _workflows_dir

_log = logging.getLogger(__name__)


def import_workflow(kind: str, filename: str, content: str) -> dict:
    db.init()
    stem = _safe_stem(filename)
    if not stem:
        raise ValueError("invalid or empty filename")
    if stem.endswith("_preset"):
        raise ValueError("'_preset.json' files are binding presets, not workflows")
    if not _is_gui_format(content):
        raise ValueError(
            "not a GUI-format workflow (missing a top-level 'nodes' array) — "
            "export it from ComfyUI with normal Save, not 'Save (API Format)'"
        )

    kind_dir = _workflows_dir() / kind
    kind_dir.mkdir(parents=True, exist_ok=True)
    path = kind_dir / f"{stem}.json"
    path.write_text(content, encoding="utf-8")

    original = Path(filename or "").name
    if original.lower().endswith(".json"):
        original = original[:-5]
    original_label = _label_from_stem(original)

    with db.get_session() as s:
        row, _ = _upsert_workflow_row(s, kind, path)
        if original_label:
            row.label = _free_label(s, kind, original_label, row.id)
        label = row.label
        s.commit()

    _log.info("[ComfyTV/workflow_db] imported workflow %s/%s from upload (%s)",
              kind, label, path.name)
    return {"kind": kind, "label": label, "file_path": str(path)}


def create_workflow(kind: str, label: str, *, graph: Optional[str] = None,
                    api_json: Optional[dict] = None,
                    description: Optional[str] = None) -> dict:
    db.init()
    if graph is None and api_json is None:
        raise ValueError("either graph or api_json is required")
    stem = _safe_stem(label)
    if not stem:
        raise ValueError("invalid or empty label")
    if stem.endswith("_preset"):
        raise ValueError("'_preset' labels are reserved for binding presets")
    if graph is not None and not _is_gui_format(graph):
        raise ValueError(
            "graph is not a GUI-format workflow (missing a top-level 'nodes' "
            "array) — pass an API-format prompt via api_json instead")

    kind_dir = _workflows_dir() / kind
    kind_dir.mkdir(parents=True, exist_ok=True)
    final = stem
    n = 2
    while (kind_dir / f"{final}.json").exists():
        final = f"{stem}-{n}"
        n += 1
    path = kind_dir / f"{final}.json"
    content = graph if graph is not None else json.dumps(api_json, indent=2)
    path.write_text(content, encoding="utf-8")

    with db.get_session() as s:
        row, _ = _upsert_workflow_row(s, kind, path)
        wanted = label.strip()
        if wanted:
            row.label = _free_label(s, kind, wanted, row.id)
        if description:
            row.description = description
        meta = {}
        if row.meta_json:
            try:
                loaded = json.loads(row.meta_json)
                if isinstance(loaded, dict):
                    meta = loaded
            except json.JSONDecodeError:
                pass
        meta["created_by"] = "mcp"
        if graph is None:
            meta["api_only"] = True
        row.meta_json = json.dumps(meta, ensure_ascii=False)
        if api_json is not None:
            row.api_json = json.dumps(api_json)
        label_out = row.label
        s.commit()

    _log.info("[ComfyTV/workflow_db] created workflow %s/%s via MCP (%s)",
              kind, label_out, path.name)
    return {"kind": kind, "label": label_out, "file_path": str(path),
            "has_api": api_json is not None}
