import json
from pathlib import Path
from typing import Any, Optional

from sqlalchemy import select

from ... import db
from ..custom_io import (
    RESULT_TYPE_FOR_OUTPUT, bindings_for, normalize_custom_io,
)
from .bindings import delete_input_binding, upsert_input_binding
from .config import get_workflow_config
from .seed import _free_label, _safe_stem, import_workflow


def set_custom_io(workflow_id: int, raw: Any) -> Optional[dict]:
    db.init()
    with db.get_session() as s:
        row = s.get(db.Workflow, workflow_id)
        if row is None:
            return None
        kind, label = row.kind, row.label
        meta = json.loads(row.meta_json) if row.meta_json else {}
        prev = normalize_custom_io(meta.get("custom_io"))
        new = normalize_custom_io(raw)
        meta["custom_io"] = new
        row.meta_json = json.dumps(meta)
        if new["outputs"]:
            primary = new["outputs"][0]
            row.result_type = RESULT_TYPE_FOR_OUTPUT[primary["kind"]]
            row.result_node = primary["node"]
        s.commit()

    for it in prev["inputs"]:
        delete_input_binding(workflow_id, it["node"], it["input"])
    for b in bindings_for(new):
        upsert_input_binding(
            workflow_id, b["node_id"], b["input_name"], b["from"],
            default=b.get("default"), required=bool(b.get("required")),
            error_msg=b.get("error_msg"), cast=b.get("cast"),
        )
    return get_workflow_config(kind, label)


_COPY_FIELDS = (
    "api_json", "description", "result_type", "result_node",
    "sizing_json", "prune_when_missing_json", "meta_json", "order_",
)


def duplicate_workflow(workflow_id: int, new_label: str) -> Optional[dict]:
    db.init()
    new_label = (new_label or "").strip()
    if not new_label:
        raise ValueError("label required")
    with db.get_session() as s:
        row = s.get(db.Workflow, workflow_id)
        if row is None:
            return None
        kind = row.kind
        clash = s.execute(
            select(db.Workflow).where(db.Workflow.kind == kind, db.Workflow.label == new_label)
        ).scalar_one_or_none()
        if clash is not None:
            raise ValueError(f"a workflow named {new_label!r} already exists for {kind}")
        src = {f: getattr(row, f) for f in _COPY_FIELDS}
        src_path, src_mtime = row.file_path, row.file_mtime
        native = row.link_type == db.LINK_TYPE_NATIVE
        bindings = [
            (b.node_id, b.input_name, b.from_, b.default_value, b.prefix, b.suffix,
             bool(b.required), b.error_msg, b.cast_)
            for b in s.execute(
                select(db.WorkflowInputBinding)
                .where(db.WorkflowInputBinding.workflow_id == row.id)
            ).scalars().all()
        ]

    if native:
        with db.get_session() as s:
            new = db.Workflow(kind=kind, label=new_label, file_path=src_path,
                              file_mtime=src_mtime, link_type=db.LINK_TYPE_NATIVE)
            s.add(new)
            s.commit()
            new_id, label = new.id, new.label
    else:
        content = Path(src_path).read_text(encoding="utf-8")
        base = _safe_stem(new_label) or _safe_stem(Path(src_path).stem) or "workflow"
        stem, n = base, 1
        while (Path(src_path).parent / f"{stem}.json").exists():
            n += 1
            stem = f"{base}-{n}"
        res = import_workflow(kind, f"{stem}.json", content)
        with db.get_session() as s:
            new = s.execute(
                select(db.Workflow).where(db.Workflow.kind == kind, db.Workflow.label == res["label"])
            ).scalar_one()
            new.label = _free_label(s, kind, new_label, new.id)
            s.commit()
            new_id, label = new.id, new.label

    with db.get_session() as s:
        new = s.get(db.Workflow, new_id)
        for f in _COPY_FIELDS:
            setattr(new, f, src[f])
        s.commit()
    for (node_id, input_name, from_, default, prefix, suffix, required, error_msg, cast) in bindings:
        upsert_input_binding(new_id, node_id, input_name, from_, default=default,
                             prefix=prefix, suffix=suffix, required=required,
                             error_msg=error_msg, cast=cast)
    return get_workflow_config(kind, label)
