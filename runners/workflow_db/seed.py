import json
import logging
from pathlib import Path
from typing import Optional

from sqlalchemy import select

from ... import db


_log = logging.getLogger(__name__)
_WORKFLOWS_DIR = Path(__file__).resolve().parent.parent.parent / "workflows"


def _is_gui_format(content: str) -> bool:
    try:
        obj = json.loads(content)
    except (json.JSONDecodeError, ValueError):
        return False
    return (
        isinstance(obj, dict)
        and isinstance(obj.get("nodes"), list)
    )


def _humanize(stem: str) -> str:
    parts = stem.replace("_", "-").split("-")
    return " ".join(p.capitalize() for p in parts if p)


def _read_preset(file_path: Path) -> dict:
    p = file_path.parent / f"{file_path.stem}_preset.json"
    if not p.exists():
        return {}
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        _log.warning("[ComfyTV/workflow_db] preset %s ignored: %s", p.name, e)
        return {}
    return data if isinstance(data, dict) else {}


def _apply_preset_to_new_row(s, row: db.Workflow, preset: dict) -> None:
    if preset.get("label"):
        row.label = str(preset["label"])
    if isinstance(preset.get("order"), (int, float)):
        row.order_ = int(preset["order"])
    if preset.get("description") is not None:
        row.description = preset["description"]
    result = preset.get("result") or {}
    if result.get("node"):
        row.result_type = result.get("type")
        row.result_node = str(result["node"])
    if preset.get("sizing"):
        row.sizing_json = json.dumps(preset["sizing"])
    if preset.get("prune_when_missing"):
        row.prune_when_missing_json = json.dumps(preset["prune_when_missing"])
    s.flush()

    inputs = preset.get("inputs") or {}
    for node_id, fields in inputs.items():
        if not isinstance(fields, dict):
            continue
        for input_name, spec in fields.items():
            if not isinstance(spec, dict) or not spec.get("from"):
                continue
            default = spec.get("default")
            if default is not None and not isinstance(default, str):
                default = (
                    json.dumps(default) if isinstance(default, (list, dict))
                    else str(default)
                )
            s.add(db.WorkflowInputBinding(
                workflow_id=row.id,
                node_id=str(node_id),
                input_name=str(input_name),
                from_=str(spec["from"]),
                default_value=default,
                prefix=spec.get("prefix"),
                suffix=spec.get("suffix"),
                required=bool(spec.get("required") or False),
                error_msg=spec.get("error"),
                cast_=spec.get("cast"),
            ))


def _upsert_workflow_row(s, kind: str, file_path: Path) -> db.Workflow:
    mtime = file_path.stat().st_mtime if file_path.exists() else None

    row = s.execute(
        select(db.Workflow).where(db.Workflow.file_path == str(file_path))
    ).scalar_one_or_none()

    is_new_row = row is None
    if row is None:
        row = db.Workflow(
            kind=kind,
            label=_humanize(file_path.stem),
            file_path=str(file_path),
            order_=100,
        )
        s.add(row)

    if row.file_mtime is not None and mtime is not None and row.file_mtime != mtime:
        row.api_json = None

    row.kind       = kind
    row.file_path  = str(file_path)
    row.file_mtime = mtime

    if file_path.exists():
        try:
            content = file_path.read_text(encoding="utf-8")
            if not _is_gui_format(content):
                _log.warning(
                    "[ComfyTV/workflow_db] %s is not a GUI-format workflow "
                    "(missing top-level `nodes` array). Open it in ComfyUI "
                    "and save normally (not 'Save (API Format)') to convert.",
                    file_path,
                )
        except OSError as e:
            _log.warning("[ComfyTV/workflow_db] couldn't read %s: %s", file_path, e)

    s.flush()

    if is_new_row:
        preset = _read_preset(file_path)
        if preset:
            _apply_preset_to_new_row(s, row, preset)
            _log.info("[ComfyTV/workflow_db] applied preset for new workflow %s/%s",
                      kind, row.label)

    return row


def reset_workflow_to_preset(workflow_id: int) -> Optional[dict]:
    with db.get_session() as s:
        row = s.get(db.Workflow, workflow_id)
        if row is None:
            return None
        file_path = Path(row.file_path)
        if not file_path.exists():
            _log.warning("[ComfyTV/workflow_db] reset: file missing %s", file_path)
            return None
        preset = _read_preset(file_path)
        if not preset:
            _log.warning("[ComfyTV/workflow_db] reset: no preset next to %s", file_path)
            return None

        s.execute(
            db.WorkflowInputBinding.__table__.delete()
                .where(db.WorkflowInputBinding.workflow_id == row.id)
        )
        row.label = _humanize(file_path.stem)
        row.order_ = 100
        row.description = None
        row.result_type = None
        row.result_node = None
        row.sizing_json = None
        row.prune_when_missing_json = None
        s.flush()

        _apply_preset_to_new_row(s, row, preset)
        s.commit()
        _log.info("[ComfyTV/workflow_db] reset workflow %s to shipped preset (kind=%s, label=%s)",
                  workflow_id, row.kind, row.label)
        return {"ok": True, "kind": row.kind, "label": row.label}


def seed_workflows_from_disk(kinds: tuple[str, ...]) -> None:
    db.init()
    if not _WORKFLOWS_DIR.exists():
        return

    seen = 0
    found_paths: set[str] = set()
    with db.get_session() as s:
        for kind in kinds:
            kind_dir = _WORKFLOWS_DIR / kind
            if not kind_dir.is_dir():
                continue
            for path in sorted(kind_dir.glob("*.json")):
                if path.stem.endswith("_preset"):
                    continue
                _upsert_workflow_row(s, kind, path)
                found_paths.add(str(path.resolve()))
                seen += 1

        managed_root = str(_WORKFLOWS_DIR.resolve())
        rows = s.execute(select(db.Workflow)).scalars().all()
        pruned = 0
        for row in rows:
            try:
                rp = str(Path(row.file_path).resolve())
            except Exception:
                continue
            if not rp.startswith(managed_root):
                continue
            if rp in found_paths:
                continue
            s.delete(row)
            pruned += 1
        s.commit()
    _log.info("[ComfyTV/workflow_db] seeded %d workflows%s",
              seen, f", pruned {pruned} orphan rows" if pruned else "")
