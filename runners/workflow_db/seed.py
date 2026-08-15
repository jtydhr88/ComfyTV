import hashlib
import json
import logging
import re
import shutil
from pathlib import Path
from typing import Optional

from sqlalchemy import select

from ... import db


_log = logging.getLogger(__name__)
_LEGACY_WORKFLOWS_DIR: Optional[Path] = (
    Path(__file__).resolve().parent.parent.parent / "workflows"
)
_WORKFLOWS_DIR: Optional[Path] = None


def _workflows_dir() -> Path:
    if _WORKFLOWS_DIR is not None:
        return Path(_WORKFLOWS_DIR)
    import folder_paths
    return Path(folder_paths.get_user_directory()) / "comfytv" / "workflows"


def _sync_manifest_path(root: Path) -> Path:
    return root / ".legacy-sync.json"


def _read_sync_manifest(root: Path) -> dict:
    try:
        data = json.loads(_sync_manifest_path(root).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def _write_sync_manifest(root: Path, manifest: dict) -> None:
    try:
        _sync_manifest_path(root).write_text(
            json.dumps(manifest, indent=1, sort_keys=True), encoding="utf-8"
        )
    except OSError as e:
        _log.warning("[ComfyTV/workflow_db] could not write sync manifest: %s", e)


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


def _sync_legacy_workflows(root: Path) -> tuple[list[str], list[str]]:
    if _LEGACY_WORKFLOWS_DIR is None:
        return [], []
    src_root = Path(_LEGACY_WORKFLOWS_DIR)
    if not src_root.is_dir():
        return [], []

    manifest = _read_sync_manifest(root)
    dirty = False
    copied: list[str] = []
    updated: list[str] = []
    for src in sorted(src_root.rglob("*.json")):
        if not src.is_file():
            continue
        rel = src.relative_to(src_root)
        if any(part.startswith(".") for part in rel.parts):
            continue
        rel_key = rel.as_posix()
        src_hash = _file_sha256(src)
        if src_hash is None:
            continue
        dest = root / rel

        if not dest.exists():
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)
            copied.append(rel_key)
            manifest[rel_key] = src_hash
            dirty = True
            continue

        dest_hash = _file_sha256(dest)
        if dest_hash == src_hash:
            if manifest.get(rel_key) != src_hash:
                manifest[rel_key] = src_hash
                dirty = True
            continue

        if manifest.get(rel_key) == dest_hash:
            shutil.copy2(src, dest)
            updated.append(rel_key)
            manifest[rel_key] = src_hash
            dirty = True

    if dirty and root.exists():
        _write_sync_manifest(root, manifest)
    if copied or updated:
        _log.warning(
            "[ComfyTV/workflow_db] %s is a legacy workflows location — "
            "copied %d new and updated %d unchanged file(s) in %s: %s. "
            "Put new workflow files under %s instead; this directory is only "
            "mirrored one-way at startup/rescan, and files you have edited "
            "there are never overwritten.",
            src_root, len(copied), len(updated), root,
            ", ".join(copied + updated), root,
        )
    return copied, updated


def _marker_rel(p: Path, parent_marker: str) -> Optional[Path]:
    parts = p.parts
    for i in range(len(parts) - 2, 0, -1):
        if parts[i].lower() == "workflows" and parts[i - 1].lower() == parent_marker:
            tail = parts[i + 1:]
            return Path(*tail) if tail else None
    return None


def _repoint_legacy_rows(s, root: Path) -> int:
    try:
        root_resolved = root.resolve()
    except OSError:
        return 0
    legacy_root = None
    if _LEGACY_WORKFLOWS_DIR is not None:
        try:
            legacy_root = Path(_LEGACY_WORKFLOWS_DIR).resolve()
        except OSError:
            legacy_root = None
    from .link import _native_workflows_dir
    native_root = _native_workflows_dir()
    native_resolved = None
    if native_root is not None:
        try:
            native_resolved = Path(native_root).resolve()
        except OSError:
            native_resolved = None

    rows = s.execute(select(db.Workflow)).scalars().all()
    taken = {r.file_path for r in rows}
    moved = 0
    for row in rows:
        try:
            rp = Path(row.file_path).resolve()
        except (OSError, ValueError):
            continue

        link_type = getattr(row, "link_type", db.LINK_TYPE_MANAGED) or db.LINK_TYPE_MANAGED
        if link_type == db.LINK_TYPE_NATIVE:
            if native_resolved is None:
                continue
            try:
                rp.relative_to(native_resolved)
                continue
            except ValueError:
                pass
            rel = _marker_rel(rp, "default")
            target_root = Path(native_root)
        else:
            try:
                rp.relative_to(root_resolved)
                continue
            except ValueError:
                pass
            rel = None
            if legacy_root is not None:
                try:
                    rel = rp.relative_to(legacy_root)
                except ValueError:
                    rel = None
            if rel is None:
                rel = _marker_rel(rp, "comfytv")
            target_root = root

        if rel is None:
            continue
        new_path = target_root / rel
        if not new_path.exists():
            continue
        np_str = str(new_path)
        if np_str in taken:
            continue
        taken.discard(row.file_path)
        row.file_path = np_str
        taken.add(np_str)
        moved += 1
    if moved:
        s.flush()
        _log.info("[ComfyTV/workflow_db] repointed %d workflow row(s) from a "
                  "previous workflows location to %s", moved, root)
    return moved


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


def _upsert_workflow_row(s, kind: str, file_path: Path) -> tuple[db.Workflow, bool]:
    mtime = file_path.stat().st_mtime if file_path.exists() else None

    row = s.execute(
        select(db.Workflow).where(db.Workflow.file_path == str(file_path))
    ).scalar_one_or_none()

    is_new_row = row is None
    if row is None:
        row = db.Workflow(
            kind=kind,
            label=_free_label(s, kind, _label_from_stem(file_path.stem)),
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

    return row, is_new_row


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
        row.label = _free_label(s, row.kind, _label_from_stem(file_path.stem), row.id)
        row.order_ = 100
        row.description = None
        row.result_type = None
        row.result_node = None
        row.sizing_json = None
        row.prune_when_missing_json = None
        row.meta_json = None
        s.flush()

        _apply_preset_to_new_row(s, row, preset)

        root = _workflows_dir()
        try:
            rel_key = file_path.relative_to(root).as_posix()
        except ValueError:
            rel_key = None
        if rel_key is not None:
            preset_hash = _file_sha256(_preset_file_path(file_path))
            if preset_hash is not None:
                ledger = _read_preset_ledger(root)
                _record_applied_preset(ledger, rel_key, preset_hash,
                                       _row_state_hash(s, row))
                _write_preset_ledger(root, ledger)

        s.commit()
        _log.info("[ComfyTV/workflow_db] reset workflow %s to shipped preset (kind=%s, label=%s)",
                  workflow_id, row.kind, row.label)
        return {"ok": True, "kind": row.kind, "label": row.label}


def _safe_stem(filename: str) -> str:
    stem = Path(filename or "").name
    if stem.lower().endswith(".json"):
        stem = stem[:-5]
    stem = re.sub(r"[^A-Za-z0-9._-]+", "-", stem).strip("-._ ")
    return stem


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


def seed_workflows_from_disk(kinds: tuple[str, ...]) -> dict:
    db.init()
    root = _workflows_dir()
    synced, updated = _sync_legacy_workflows(root)
    if not root.exists():
        return {"added": [], "pruned": 0, "total": 0,
                "synced": synced, "updated": updated}

    seen = 0
    added: list[dict] = []
    found_paths: set[str] = set()
    manifest = _read_sync_manifest(root)
    ledger = _read_preset_ledger(root)
    ledger_dirty = False
    with db.get_session() as s:
        pre_populated = s.execute(
            select(db.Workflow.id).limit(1)
        ).first() is not None

        _repoint_legacy_rows(s, root)

        for kind in kinds:
            kind_dir = root / kind
            if not kind_dir.is_dir():
                continue
            for path in sorted(kind_dir.glob("*.json")):
                if path.stem.endswith("_preset"):
                    continue
                if path.name.endswith(".api.json"):
                    continue
                row, is_new = _upsert_workflow_row(s, kind, path)
                if is_new:
                    added.append({"kind": kind, "label": row.label})
                    preset_hash = _file_sha256(_preset_file_path(path))
                    if preset_hash is not None:
                        _record_applied_preset(
                            ledger, path.relative_to(root).as_posix(),
                            preset_hash, _row_state_hash(s, row))
                        ledger_dirty = True
                else:
                    ledger_dirty |= _refresh_shipped_preset(
                        s, manifest, ledger, root, row, path)
                found_paths.add(str(path.resolve()))
                seen += 1

        managed_roots = [str(root.resolve())]
        if _LEGACY_WORKFLOWS_DIR is not None:
            managed_roots.append(str(Path(_LEGACY_WORKFLOWS_DIR).resolve()))
        rows = s.execute(select(db.Workflow)).scalars().all()
        pruned = 0
        for row in rows:
            try:
                rp = str(Path(row.file_path).resolve())
            except Exception:
                continue
            if not any(rp.startswith(mr) for mr in managed_roots):
                continue
            if rp in found_paths:
                continue
            s.delete(row)
            pruned += 1
        s.commit()

    if ledger_dirty and root.exists():
        _write_preset_ledger(root, ledger)

    if not pre_populated:
        added = []
    _log.info("[ComfyTV/workflow_db] seeded %d workflows%s%s",
              seen,
              f", {len(added)} new" if added else "",
              f", pruned {pruned} orphan rows" if pruned else "")
    return {"added": added, "pruned": pruned, "total": seen,
            "synced": synced, "updated": updated}
