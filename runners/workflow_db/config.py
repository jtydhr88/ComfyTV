import json
import logging
import os
from typing import Any, Optional

from sqlalchemy import select

from ... import db


_log = logging.getLogger(__name__)


def _bindings_to_inputs_dict(rows: list[db.WorkflowInputBinding]) -> dict:
    out: dict[str, dict[str, dict]] = {}
    for r in rows:
        spec: dict[str, Any] = {"from": r.from_}
        if r.default_value is not None:
            spec["default"] = r.default_value
        if r.prefix:    spec["prefix"]   = r.prefix
        if r.suffix:    spec["suffix"]   = r.suffix
        if r.required:  spec["required"] = True
        if r.error_msg: spec["error"]    = r.error_msg
        if r.cast_:     spec["cast"]     = r.cast_
        out.setdefault(r.node_id, {})[r.input_name] = spec
    return out


def build_preset(kind: str, label: str) -> Optional[dict]:
    db.init()
    with db.get_session() as s:
        row = s.execute(
            select(db.Workflow).where(db.Workflow.kind == kind, db.Workflow.label == label)
        ).scalar_one_or_none()
        if row is None:
            return None
        bindings = s.execute(
            select(db.WorkflowInputBinding)
            .where(db.WorkflowInputBinding.workflow_id == row.id)
            .order_by(db.WorkflowInputBinding.node_id, db.WorkflowInputBinding.input_name)
        ).scalars().all()

        out: dict[str, Any] = {
            "_comment": (
                f"Exported preset for the '{label}' workflow (kind={kind}). "
                f"Drop this next to the workflow JSON as "
                f"`<name>_preset.json` so other users' first-seed picks up "
                f"these defaults. See docs/custom-workflows.md."
            ),
            "label": row.label,
        }
        if row.order_ is not None and row.order_ != 100:
            out["order"] = row.order_
        if row.description:
            out["description"] = row.description
        if row.result_node:
            out["result"] = {"type": row.result_type, "node": row.result_node}
        if row.sizing_json:
            try:
                sizing = json.loads(row.sizing_json)
                if sizing: out["sizing"] = sizing
            except json.JSONDecodeError:
                pass
        if row.prune_when_missing_json:
            try:
                prune = json.loads(row.prune_when_missing_json)
                if prune: out["prune_when_missing"] = prune
            except json.JSONDecodeError:
                pass
        if bindings:
            out["inputs"] = _bindings_to_inputs_dict(list(bindings))
        return out


def get_workflow_for_invoke(kind: str, label: str) -> Optional[dict]:
    db.init()
    with db.get_session() as s:
        row = s.execute(
            select(db.Workflow).where(db.Workflow.kind == kind, db.Workflow.label == label)
        ).scalar_one_or_none()
        if row is None:
            return None
        if not row.api_json:
            raise RuntimeError(
                f"Workflow {kind!r}/{label!r} hasn't been prepared yet — "
                f"open it once in the UI so the browser can convert it, then re-run."
            )
        bindings = s.execute(
            select(db.WorkflowInputBinding)
            .where(db.WorkflowInputBinding.workflow_id == row.id)
        ).scalars().all()

        try:
            api_obj = json.loads(row.api_json)
        except json.JSONDecodeError as e:
            raise RuntimeError(
                f"Workflow {kind!r}/{label!r}: stored api_json is invalid: {e}"
            )

        return {
            "api_json": api_obj,
            "result": {"type": row.result_type, "node": row.result_node}
                      if row.result_node else {},
            "inputs": _bindings_to_inputs_dict(bindings),
            "sizing": json.loads(row.sizing_json) if row.sizing_json else {},
            "prune_when_missing":
                json.loads(row.prune_when_missing_json)
                if row.prune_when_missing_json else [],
        }


def _node_widget_meta(class_type: str) -> dict:
    import nodes
    cls = (
        getattr(nodes, "NODE_CLASS_MAPPINGS", {}).get(class_type)
        if hasattr(nodes, "NODE_CLASS_MAPPINGS") else None
    )
    if cls is None:
        return []
    try:
        input_types = cls.INPUT_TYPES() if hasattr(cls, "INPUT_TYPES") else {}
    except Exception as e:
        _log.warning("[ComfyTV/workflow_db] INPUT_TYPES() raised for %s: %s",
                     class_type, e)
        return []

    out: list[dict] = []

    _WIDGET_TYPES = {"INT", "FLOAT", "STRING", "BOOLEAN"}
    for section in ("required", "optional"):
        for name, spec in (input_types.get(section) or {}).items():
            if not spec:
                continue
            if isinstance(spec, (list, tuple)):
                t = spec[0] if spec else None
                opts = spec[1] if len(spec) > 1 and isinstance(spec[1], dict) else {}
                if isinstance(t, (list, tuple)):
                    out.append({
                        "name": name, "type": "COMBO",
                        "options": {"values": list(t), **(opts or {})},
                    })
                elif isinstance(t, str) and t.upper() in _WIDGET_TYPES:
                    out.append({"name": name, "type": t.upper(), "options": opts})
            elif isinstance(spec, str) and spec.upper() in _WIDGET_TYPES:
                out.append({"name": name, "type": spec.upper(), "options": {}})
    return out


def _exposed_widgets(workflow_id: int, file_path: str,
                    bindings: list[db.WorkflowInputBinding],
                    api_json: Optional[dict]) -> list[dict]:

    if api_json is None or not isinstance(api_json, dict):
        return []

    if not file_path or not os.path.exists(file_path):
        return []
    try:
        with open(file_path, encoding="utf-8") as f:
            doc = json.load(f)
    except (OSError, json.JSONDecodeError):
        return []
    if not isinstance(doc, dict) or not isinstance(doc.get("nodes"), list):
        return []

    bindings_by_key: dict[tuple[str, str], db.WorkflowInputBinding] = {}
    for b in bindings:
        bindings_by_key[(str(b.node_id), str(b.input_name))] = b

    groups = []
    for g in doc.get("groups") or []:
        if isinstance(g, dict) and isinstance(g.get("bounding"), list):
            groups.append({"title": g.get("title"), "bounding": g["bounding"]})

    def group_for_pos(pos):
        if not pos or len(pos) < 2:
            return None
        x, y = pos[0], pos[1]
        for g in groups:
            b = g["bounding"]
            if len(b) != 4:
                continue
            gx, gy, gw, gh = b
            if gx <= x <= gx + gw and gy <= y <= gy + gh:
                return g["title"]
        return None

    subgraph_defs: dict[str, dict] = {}
    for sub in (doc.get("definitions") or {}).get("subgraphs") or []:
        sid = sub.get("id")
        if sid:
            subgraph_defs[str(sid)] = sub

    def iter_nodes_with_ids():
        deferred_subgraphs: list[tuple[str, dict, str]] = []
        for top in doc["nodes"]:
            if not isinstance(top, dict):
                continue
            top_id = str(top.get("id")) if top.get("id") is not None else ""
            top_type = top.get("type") or ""
            if top_type in subgraph_defs:
                sdef = subgraph_defs[top_type]
                sg_title = (
                    sdef.get("name")
                    or top.get("title")
                    or f"Subgraph #{top_id}"
                )
                deferred_subgraphs.append((top_id, sdef, sg_title))
                continue
            yield top_id, top, group_for_pos(top.get("pos"))

        for top_id, sdef, sg_title in deferred_subgraphs:
            for inner in (sdef.get("nodes") or []):
                if not isinstance(inner, dict):
                    continue
                inner_id = str(inner.get("id")) if inner.get("id") is not None else ""
                composite = f"{top_id}:{inner_id}"
                yield composite, inner, sg_title

    out: list[dict] = []
    for node_id, n, group_title in iter_nodes_with_ids():
        class_type = n.get("type") or ""
        if class_type in ("Note", "MarkdownNote", "Reroute", "PrimitiveNode"):
            continue

        api_node = api_json.get(node_id)
        if not isinstance(api_node, dict):
            continue
        api_inputs = api_node.get("inputs") or {}

        title       = n.get("title") or class_type
        widget_meta = _node_widget_meta(class_type)

        for wm in widget_meta:
            wname = wm["name"]
            if wname not in api_inputs:
                continue
            current = api_inputs[wname]
            if isinstance(current, list) and len(current) == 2:
                continue

            binding = bindings_by_key.get((node_id, wname))
            out.append({
                "node_id":      node_id,
                "node_title":   title,
                "node_type":    class_type,
                "group_title":  group_title,
                "widget_name":  wname,
                "widget_type":  wm["type"],
                "widget_props": wm.get("options") or {},
                "current_value": current,
                "stage_binding": binding.from_ if binding else None,
                "override_value": binding.default_value if binding else None,
                "cast":           binding.cast_ if binding else None,
            })
    return out


def _extract_gui_view(file_path: str) -> dict:
    if not file_path or not os.path.exists(file_path):
        return {}
    try:
        with open(file_path, encoding="utf-8") as f:
            doc = json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}
    if not isinstance(doc, dict) or not isinstance(doc.get("nodes"), list):
        return {}

    gui_nodes  = []
    gui_notes  = []
    for n in doc["nodes"]:
        if not isinstance(n, dict):
            continue
        nid  = n.get("id")
        ntype = n.get("type") or ""
        if ntype in ("Note", "MarkdownNote"):
            wv = n.get("widgets_values") or []
            text = wv[0] if wv and isinstance(wv[0], str) else ""
            gui_notes.append({
                "type": ntype,
                "pos":  n.get("pos"),
                "text": text,
            })
            continue
        gui_nodes.append({
            "id":      str(nid) if nid is not None else "",
            "type":    ntype,
            "title":   n.get("title"),
            "pos":     n.get("pos"),
            "color":   n.get("color"),
            "bgcolor": n.get("bgcolor"),
            "mode":    n.get("mode", 0),
        })

    gui_groups = []
    for g in doc.get("groups") or []:
        if not isinstance(g, dict):
            continue
        gui_groups.append({
            "title":     g.get("title"),
            "bounding":  g.get("bounding"),
            "color":     g.get("color"),
            "font_size": g.get("font_size"),
        })

    return {
        "gui_nodes":  gui_nodes,
        "gui_groups": gui_groups,
        "gui_notes":  gui_notes,
    }


def get_workflow_config(kind: str, label: str) -> Optional[dict]:
    db.init()
    with db.get_session() as s:
        row = s.execute(
            select(db.Workflow).where(db.Workflow.kind == kind, db.Workflow.label == label)
        ).scalar_one_or_none()
        if row is None:
            return None
        bindings = s.execute(
            select(db.WorkflowInputBinding)
            .where(db.WorkflowInputBinding.workflow_id == row.id)
            .order_by(db.WorkflowInputBinding.node_id, db.WorkflowInputBinding.input_name)
        ).scalars().all()

        api_obj = None
        if row.api_json:
            try:
                api_obj = json.loads(row.api_json)
            except json.JSONDecodeError:
                api_obj = None
        gui_view = _extract_gui_view(row.file_path)

        exposed = _exposed_widgets(row.id, row.file_path, list(bindings), api_obj)
        return {
            "id":          row.id,
            "kind":        row.kind,
            "label":       row.label,
            "file_path":   row.file_path,
            "file_mtime":  row.file_mtime,
            "has_api":     bool(row.api_json),
            "api_json":    api_obj,
            "exposed_widgets": exposed,
            "gui_nodes":   gui_view.get("gui_nodes",  []),
            "gui_groups":  gui_view.get("gui_groups", []),
            "gui_notes":   gui_view.get("gui_notes",  []),
            "order":       row.order_,
            "description": row.description,
            "result_type": row.result_type,
            "result_node": row.result_node,
            "sizing":      json.loads(row.sizing_json) if row.sizing_json else {},
            "prune_when_missing":
                json.loads(row.prune_when_missing_json)
                if row.prune_when_missing_json else [],
            "bindings": [
                {
                    "node_id":    b.node_id,
                    "input_name": b.input_name,
                    "from":       b.from_,
                    "default":    b.default_value,
                    "prefix":     b.prefix,
                    "suffix":     b.suffix,
                    "required":   bool(b.required),
                    "error_msg":  b.error_msg,
                    "cast":       b.cast_,
                }
                for b in bindings
            ],
        }
