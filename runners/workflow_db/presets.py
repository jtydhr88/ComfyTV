import hashlib
import json
import logging
from pathlib import Path
from typing import Optional

from sqlalchemy import select

from ... import db
from .labels import _claim_label_or_skip

_log = logging.getLogger(__name__)


def _file_sha256(path: Path) -> Optional[str]:
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()
    except OSError:
        return None


def _preset_ledger_path(root: Path) -> Path:
    return root / ".preset-ledger.json"


def _read_preset_ledger(root: Path) -> dict:
    try:
        data = json.loads(_preset_ledger_path(root).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def _write_preset_ledger(root: Path, ledger: dict) -> None:
    try:
        _preset_ledger_path(root).write_text(
            json.dumps(ledger, indent=1, sort_keys=True), encoding="utf-8"
        )
    except OSError as e:
        _log.warning("[ComfyTV/workflow_db] could not write preset ledger: %s", e)


def _preset_file_path(file_path: Path) -> Path:
    return file_path.parent / f"{file_path.stem}_preset.json"


def _state_hash(state: dict) -> str:
    return hashlib.sha256(
        json.dumps(state, sort_keys=True, ensure_ascii=False).encode("utf-8")
    ).hexdigest()


def _row_state_hash(s, row) -> str:
    bindings = s.execute(
        select(db.WorkflowInputBinding)
        .where(db.WorkflowInputBinding.workflow_id == row.id)
    ).scalars().all()
    return _state_hash({
        "description": row.description,
        "result_type": row.result_type,
        "result_node": row.result_node,
        "sizing_json": row.sizing_json,
        "prune_when_missing_json": row.prune_when_missing_json,
        "meta_json": row.meta_json,
        "bindings": sorted(
            [b.node_id, b.input_name, b.from_, b.default_value, b.prefix,
             b.suffix, bool(b.required), b.error_msg, b.cast_]
            for b in bindings
        ),
    })


def _preset_binding_rows(preset: dict) -> list[list]:
    rows: list[list] = []
    for node_id, fields in (preset.get("inputs") or {}).items():
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
            rows.append([str(node_id), str(input_name), str(spec["from"]),
                         default, spec.get("prefix"), spec.get("suffix"),
                         bool(spec.get("required") or False), spec.get("error"),
                         spec.get("cast")])
    return rows


def _preset_state_hash(preset: dict) -> str:
    result = preset.get("result") or {}
    return _state_hash({
        "description": preset.get("description"),
        "result_type": result.get("type") if result.get("node") else None,
        "result_node": str(result["node"]) if result.get("node") else None,
        "sizing_json": json.dumps(preset["sizing"]) if preset.get("sizing") else None,
        "prune_when_missing_json": (
            json.dumps(preset["prune_when_missing"])
            if preset.get("prune_when_missing") else None
        ),
        "meta_json": json.dumps(preset["meta"]) if preset.get("meta") else None,
        "bindings": sorted(_preset_binding_rows(preset)),
    })


def _record_applied_preset(ledger: dict, rel_key: str,
                           preset_hash: str, row_hash: str) -> None:
    ledger[rel_key] = {"preset": preset_hash, "row": row_hash}


def _file_pristine(manifest: dict, root: Path, path: Path) -> bool:
    try:
        rel_key = path.relative_to(root).as_posix()
    except ValueError:
        return False
    h = _file_sha256(path)
    return h is not None and manifest.get(rel_key) == h


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
        _claim_label_or_skip(s, row, str(preset["label"]))
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
    if preset.get("meta"):
        row.meta_json = json.dumps(preset["meta"])
    s.flush()
    _add_preset_bindings(s, row, preset)


def _add_preset_bindings(s, row: db.Workflow, preset: dict) -> None:
    for (node_id, input_name, from_, default, prefix, suffix,
         required, error_msg, cast_) in _preset_binding_rows(preset):
        s.add(db.WorkflowInputBinding(
            workflow_id=row.id,
            node_id=node_id,
            input_name=input_name,
            from_=from_,
            default_value=default,
            prefix=prefix,
            suffix=suffix,
            required=required,
            error_msg=error_msg,
            cast_=cast_,
        ))


def _reapply_preset_to_row(s, row: db.Workflow, preset: dict) -> None:
    s.execute(
        db.WorkflowInputBinding.__table__.delete()
            .where(db.WorkflowInputBinding.workflow_id == row.id)
    )
    row.description = preset.get("description")
    result = preset.get("result") or {}
    row.result_type = result.get("type") if result.get("node") else None
    row.result_node = str(result["node"]) if result.get("node") else None
    row.sizing_json = json.dumps(preset["sizing"]) if preset.get("sizing") else None
    row.prune_when_missing_json = (
        json.dumps(preset["prune_when_missing"])
        if preset.get("prune_when_missing") else None
    )
    row.meta_json = json.dumps(preset["meta"]) if preset.get("meta") else None
    s.flush()
    _add_preset_bindings(s, row, preset)


def _refresh_shipped_preset(s, manifest: dict, ledger: dict, root: Path,
                            row: db.Workflow, path: Path) -> bool:
    preset_path = _preset_file_path(path)
    preset_hash = _file_sha256(preset_path)
    if preset_hash is None:
        return False
    rel_key = path.relative_to(root).as_posix()
    entry = ledger.get(rel_key)
    if isinstance(entry, dict) and entry.get("preset") == preset_hash:
        return False
    if not (_file_pristine(manifest, root, path)
            and _file_pristine(manifest, root, preset_path)):
        return False
    row_hash = _row_state_hash(s, row)
    if isinstance(entry, dict) and entry.get("row") != row_hash:
        _log.info(
            "[ComfyTV/workflow_db] shipped preset changed for %s/%s but the "
            "row has local edits — kept (use 'Reset to shipped preset' to "
            "adopt the update)", row.kind, row.label)
        return False
    preset = _read_preset(path)
    if not preset:
        return False
    if _preset_state_hash(preset) == row_hash:
        _record_applied_preset(ledger, rel_key, preset_hash, row_hash)
        return True
    _reapply_preset_to_row(s, row, preset)
    _record_applied_preset(ledger, rel_key, preset_hash, _row_state_hash(s, row))
    _log.info("[ComfyTV/workflow_db] re-applied updated shipped preset for %s/%s",
              row.kind, row.label)
    return True
