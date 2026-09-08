import json
import re
from ...runners import WORKFLOW_KINDS
from ...runners import refresh_registry
from ...runners import workflow_db

from .._common import broadcast_workflow_event
from .nodes import _validate_api_prompt
from ._option_check import dangling_option_warnings


_FROM_RE = re.compile(
    r"^(main_prompt"
    r"|literal:.*"
    r"|option:[A-Za-z0-9_]+"
    r"|computed:(width|height|length)"
    r"|upstream_(image|video|audio|text|model):(annotated|value|masked)(\[\d+\])?)$",
    re.DOTALL,
)

_BIND_CASTS = ("int", "float", "str")

_META_KEYS = ("description", "result_type", "result_node", "sizing",
              "prune_when_missing", "meta")

_RESULT_TYPES = ("ui_save_url", "ui_save_batch", "graph_output_first")

def _validate_result_type(value) -> None:
    if value and str(value) not in _RESULT_TYPES:
        raise ValueError(
            f"result_type must be one of {_RESULT_TYPES} — 'ui_save_batch' "
            f"for image batches from a SaveImage-style node, 'ui_save_url' "
            f"for a single saved file, 'graph_output_first' for a node's "
            f"first graph output value")

_VALUE_CAP = 200

def _slim_api_nodes(api_obj) -> list[dict]:
    nodes: list[dict] = []
    if not isinstance(api_obj, dict):
        return nodes
    for nid, node in sorted(api_obj.items(), key=lambda kv: str(kv[0])):
        if not isinstance(node, dict):
            continue
        inputs = {}
        for name, val in (node.get("inputs") or {}).items():
            if isinstance(val, list) and len(val) == 2:
                inputs[name] = f"«linked from node {val[0]}»"
            elif isinstance(val, str) and len(val) > _VALUE_CAP:
                inputs[name] = val[:_VALUE_CAP] + "…"
            else:
                inputs[name] = val
        nodes.append({
            "node_id": str(nid),
            "class_type": node.get("class_type"),
            "title": (node.get("_meta") or {}).get("title") or "",
            "inputs": inputs,
        })
    return nodes

def _workflow_config(kind, label) -> dict:
    kind = str(kind or "")
    label = str(label or "")
    if kind not in WORKFLOW_KINDS:
        raise ValueError(
            f"unknown workflow kind {kind!r} — valid kinds: {', '.join(WORKFLOW_KINDS)}")
    if not label:
        raise ValueError("label is required")
    cfg = workflow_db.get_workflow_config(kind, label)
    if cfg is None:
        labels = [w["label"] for w in workflow_db.list_workflows_overview(kind)]
        raise ValueError(
            f"workflow {label!r} not found for kind {kind!r}; "
            f"available: {labels}")
    return cfg

async def _workflow_get(args: dict) -> dict:
    cfg = _workflow_config(args.get("kind"), args.get("label"))
    return {
        "id": cfg["id"],
        "kind": cfg["kind"],
        "label": cfg["label"],
        "description": cfg["description"],
        "link_type": cfg["link_type"],
        "file_exists": cfg["file_exists"],
        "has_api": cfg["has_api"],
        "result_type": cfg["result_type"],
        "result_node": cfg["result_node"],
        "sizing": cfg["sizing"],
        "meta": cfg["meta"],
        "custom_io": (cfg["meta"] or {}).get("custom_io"),
        "bindings": cfg["bindings"],
        "exposed_widgets": cfg.get("exposed_widgets") or [],
        "nodes": _slim_api_nodes(cfg.get("api_json")),
        "warnings": await dangling_option_warnings(cfg["kind"], cfg["bindings"]),
    }

def _validate_bind_op(i: int, op: dict, api_nodes: dict | None) -> None:
    node_id = str(op.get("node_id") or "")
    input_name = str(op.get("input_name") or "")
    src = str(op.get("from") or "")
    if not node_id or not input_name:
        raise ValueError(f"ops[{i}]: bind needs node_id and input_name")
    if not _FROM_RE.match(src):
        raise ValueError(
            f"ops[{i}]: invalid from {src!r} — valid sources: main_prompt, "
            "option:<key>, computed:width|height|length, literal:<value>, "
            "upstream_image:value[N] (or :annotated / :masked), "
            "upstream_video|audio|text|model:value[N]")
    cast = op.get("cast")
    if cast is not None and cast not in _BIND_CASTS:
        raise ValueError(
            f"ops[{i}]: invalid cast {cast!r} — valid: {', '.join(_BIND_CASTS)}")
    if api_nodes is not None:
        node = api_nodes.get(node_id)
        if not isinstance(node, dict):
            raise ValueError(
                f"ops[{i}]: node {node_id!r} not in this workflow's API graph "
                f"(nodes: {sorted(api_nodes)})")
        inputs = node.get("inputs") or {}
        if input_name not in inputs:
            raise ValueError(
                f"ops[{i}]: node {node_id} has no input {input_name!r} "
                f"(inputs: {sorted(inputs)})")

_CUSTOM_IO_INPUT_KINDS = ("image", "video", "audio", "model", "text", "param")
_CUSTOM_IO_OUTPUT_KINDS = ("image", "images", "video", "audio", "text", "model")


def _validate_custom_io_op(i: int, op: dict, api_nodes: dict | None) -> None:
    inputs, outputs = op.get("inputs"), op.get("outputs")
    if not isinstance(inputs, list) or not isinstance(outputs, list):
        raise ValueError(f"ops[{i}]: set_custom_io needs inputs[] and outputs[]")
    if not outputs:
        raise ValueError(f"ops[{i}]: set_custom_io needs at least one output")
    for j, it in enumerate(inputs):
        if not isinstance(it, dict) or not it.get("node") or not it.get("input"):
            raise ValueError(f"ops[{i}].inputs[{j}] needs node and input")
        if it.get("kind") not in _CUSTOM_IO_INPUT_KINDS:
            raise ValueError(
                f"ops[{i}].inputs[{j}]: kind must be one of {_CUSTOM_IO_INPUT_KINDS}")
        node = api_nodes.get(str(it["node"])) if api_nodes is not None else None
        if api_nodes is not None and node is None:
            raise ValueError(
                f"ops[{i}].inputs[{j}]: node {it['node']!r} not in this workflow's "
                f"API graph (nodes: {sorted(api_nodes)})")
        if node is not None and str(it["input"]) not in (node.get("inputs") or {}):
            raise ValueError(
                f"ops[{i}].inputs[{j}]: node {it['node']!r} has no input "
                f"{it['input']!r} (inputs: {sorted(node.get('inputs') or {})})")
        if node is not None and it["kind"] in ("text", "param") and it.get("default") is None:
            cur = (node.get("inputs") or {}).get(str(it["input"]))
            if not isinstance(cur, list):
                it["default"] = cur
    for j, it in enumerate(outputs):
        if not isinstance(it, dict) or not it.get("node"):
            raise ValueError(f"ops[{i}].outputs[{j}] needs node")
        if it.get("kind") not in _CUSTOM_IO_OUTPUT_KINDS:
            raise ValueError(
                f"ops[{i}].outputs[{j}]: kind must be one of {_CUSTOM_IO_OUTPUT_KINDS}")
        if api_nodes is not None and str(it["node"]) not in api_nodes:
            raise ValueError(
                f"ops[{i}].outputs[{j}]: node {it['node']!r} not in this workflow's "
                f"API graph (nodes: {sorted(api_nodes)})")


def _result(op: str, ok, reason: str) -> dict:
    return {"op": op, "ok": True} if ok else {"op": op, "ok": False, "reason": reason}

def _reset_reason(cfg: dict) -> str:
    from pathlib import Path
    from ...runners.workflow_db.seed import _read_preset
    path = Path(str(cfg.get("file_path") or ""))
    if not cfg.get("file_exists"):
        return f"workflow file is missing on disk ({path})"
    if not _read_preset(path):
        return ("this workflow has no shipped preset next to its file "
                "(imported or user-created workflows cannot be reset)")
    return "reset failed — see the server log"

async def _workflow_edit(args: dict) -> dict:
    cfg = _workflow_config(args.get("kind"), args.get("label"))
    ops = args.get("ops")
    if not isinstance(ops, list) or not ops:
        raise ValueError("ops must be a non-empty array of {op, ...} objects")
    api_obj = cfg.get("api_json")
    api_nodes = api_obj if isinstance(api_obj, dict) else None

    for i, op in enumerate(ops):
        if not isinstance(op, dict) or not op.get("op"):
            raise ValueError(f"ops[{i}] must be an object with an 'op' field")
        name = str(op["op"])
        if name == "bind":
            _validate_bind_op(i, op, api_nodes)
        elif name == "unbind":
            if not op.get("node_id") or not op.get("input_name"):
                raise ValueError(f"ops[{i}]: unbind needs node_id and input_name")
        elif name == "set_meta":
            if not any(k in op for k in _META_KEYS):
                raise ValueError(
                    f"ops[{i}]: set_meta needs at least one of {_META_KEYS}")
            try:
                _validate_result_type(op.get("result_type"))
            except ValueError as e:
                raise ValueError(f"ops[{i}]: {e}")
            rn = op.get("result_node")
            if rn not in (None, "") and api_nodes is not None \
                    and str(rn) not in api_nodes:
                raise ValueError(
                    f"ops[{i}]: result_node {rn!r} not in this workflow's "
                    f"API graph (nodes: {sorted(api_nodes)})")
        elif name == "set_custom_io":
            _validate_custom_io_op(i, op, api_nodes)
        elif name == "duplicate":
            if not str(op.get("label") or "").strip():
                raise ValueError(f"ops[{i}]: duplicate needs a non-empty label")
        elif name in ("set_default", "reset_to_preset"):
            pass
        else:
            raise ValueError(
                f"ops[{i}]: unknown op {name!r} — valid: bind, unbind, "
                "set_meta, set_custom_io, duplicate, set_default, reset_to_preset")

    wid = int(cfg["id"])
    results = []
    for op in ops:
        name = str(op["op"])
        if name == "bind":
            workflow_db.upsert_input_binding(
                workflow_id=wid,
                node_id=str(op["node_id"]),
                input_name=str(op["input_name"]),
                from_=str(op["from"]),
                default=op.get("default"),
                prefix=op.get("prefix"),
                suffix=op.get("suffix"),
                required=bool(op.get("required") or False),
                error_msg=op.get("error_msg"),
                cast=op.get("cast"),
            )
            results.append({"op": name, "ok": True,
                            "node_id": str(op["node_id"]),
                            "input_name": str(op["input_name"])})
        elif name == "unbind":
            ok = workflow_db.delete_input_binding(
                workflow_id=wid,
                node_id=str(op["node_id"]),
                input_name=str(op["input_name"]),
            )
            results.append(_result(name, ok, (
                f"no binding on node {op['node_id']} input "
                f"{str(op['input_name'])!r} — nothing to remove")))
        elif name == "set_meta":
            kwargs = {k: op[k] for k in _META_KEYS if k in op}
            ok = workflow_db.update_workflow_meta(wid, **kwargs)
            results.append({**_result(name, ok, "workflow row is gone"),
                            "fields": sorted(kwargs)})
        elif name == "set_custom_io":
            out = workflow_db.set_custom_io(
                wid, {"inputs": op["inputs"], "outputs": op["outputs"]})
            cio = ((out or {}).get("meta") or {}).get("custom_io") or {}
            results.append({**_result(name, out is not None, "workflow row is gone"),
                            "inputs": len(cio.get("inputs") or []),
                            "outputs": len(cio.get("outputs") or [])})
        elif name == "duplicate":
            try:
                out = workflow_db.duplicate_workflow(wid, str(op["label"]))
            except ValueError as e:
                results.append({"op": name, "ok": False, "reason": str(e)})
                continue
            if out is not None:
                refresh_registry()
                broadcast_workflow_event("import", {"kind": out["kind"], "label": out["label"]})
            results.append({**_result(name, out is not None, "workflow row is gone"),
                            "label": (out or {}).get("label"),
                            "id": (out or {}).get("id")})
        elif name == "set_default":
            out = workflow_db.set_default_workflow(
                wid, bool(op.get("default", True)))
            if out is not None:
                broadcast_workflow_event("default", {
                    "kind": out["kind"], "label": out["label"],
                    "default": bool(out.get("is_default"))})
            results.append(_result(name, out is not None, "workflow row is gone"))
        elif name == "reset_to_preset":
            out = workflow_db.reset_workflow_to_preset(wid)
            if out is not None:
                refresh_registry()
            results.append(_result(name, out is not None, _reset_reason(cfg)))
    fresh = workflow_db.get_workflow_config(cfg["kind"], cfg["label"])
    bindings = (fresh or {}).get("bindings", [])
    return {"results": results,
            "bindings": bindings,
            "warnings": await dangling_option_warnings(cfg["kind"], bindings)}

async def _workflow_create(args: dict) -> dict:
    kind = str(args.get("kind") or "")
    if kind not in WORKFLOW_KINDS:
        raise ValueError(f"unknown workflow kind {kind!r} — valid kinds: "
                         f"{', '.join(WORKFLOW_KINDS)}")
    label = str(args.get("label") or "").strip()
    if not label:
        raise ValueError("label is required")
    api_json = args.get("api_json")
    graph = args.get("graph")
    if api_json is None and graph is None:
        raise ValueError("either api_json (API-format prompt) or graph "
                         "(GUI-format workflow export) is required")
    if api_json is not None and not isinstance(api_json, dict):
        raise ValueError("api_json must be an object mapping node ids to "
                         "{class_type, inputs}")
    if isinstance(graph, dict):
        graph = json.dumps(graph)
    if graph is not None and not isinstance(graph, str):
        raise ValueError("graph must be a GUI-format workflow object or its "
                         "JSON string")

    _validate_result_type(args.get("result_type"))

    validation = None
    if api_json is not None:
        validation = await _validate_api_prompt(api_json)
        if not validation["valid"]:
            return {"created": False, "validation": validation}
    if args.get("validate_only"):
        return {"created": False, "validation": validation}

    out = workflow_db.create_workflow(
        kind, label, graph=graph, api_json=api_json,
        description=args.get("description"))
    result_node = args.get("result_node")
    result_type = args.get("result_type")
    if result_node or result_type:
        cfg = workflow_db.get_workflow_config(kind, out["label"])
        if cfg:
            kwargs: dict = {}
            if result_node:
                kwargs["result_node"] = str(result_node)
            if result_type:
                kwargs["result_type"] = str(result_type)
            workflow_db.update_workflow_meta(int(cfg["id"]), **kwargs)
    refresh_registry()
    broadcast_workflow_event("import", {"kind": kind, "label": out["label"]})
    note = None
    if api_json is None:
        try:
            converted = workflow_db.convert_workflow(kind, out["label"])
            note = f"graph converted server-side ({converted['node_count']} nodes)"
            out = {**out, "has_api": True}
        except Exception as e:
            note = (f"registered, but the graph could not be converted to API "
                    f"format yet ({e}); conversion is retried on first run")
    return {"created": True, **out, "validation": validation, "note": note}


TOOLS: dict[str, dict] = {
    "workflow_get": {
        "description": (
            "Read a workflow's full ComfyTV configuration: input bindings, "
            "the API graph's node inventory (node_id, class_type, title, "
            "current input values — linked inputs shown as «linked»), exposed "
            "widgets, sizing, meta and warnings (option:<key> bindings that "
            "would resolve empty at run time). Use this before workflow_edit to "
            "see which node inputs exist and what is already bound. kind + label "
            "come from list_workflows. Server-side — no open page needed."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "kind": {"type": "string"},
                "label": {"type": "string"},
            },
            "required": ["kind", "label"],
            "additionalProperties": False,
        },
        "handler": _workflow_get,
    },
    "workflow_edit": {
        "description": (
            "Edit a workflow's ComfyTV configuration with an ops array "
            "(validated up front, then applied in order). Ops: {op:'bind', "
            "node_id, input_name, from, default?, prefix?, suffix?, "
            "required?, error_msg?, cast?} wires a stage value into a "
            "workflow node input — from sources: 'main_prompt' (stage "
            "prompt), 'option:<key>' (a stage widget; a key the stage lacks "
            "resolves empty, so pair it with a default — e.g. option:seed "
            "+ default:'random_int31'), "
            "'computed:width'/'computed:height'/'computed:length' (sizing "
            "engine — use these for width/height so aspect settings apply), "
            "'literal:<value>', 'upstream_image:value[N]' (also :annotated / "
            ":masked) and upstream_video/audio/text/model:value[N]; cast is "
            "int/float/str. {op:'unbind', node_id, input_name} removes a "
            "binding. {op:'set_meta', description?/result_type?/result_node?/"
            "sizing?/prune_when_missing?/meta?} updates workflow meta. "
            "{op:'set_custom_io', inputs:[{node, input, kind:image|video|"
            "audio|model|text|param, label?, required?, prompt?, ptype?, "
            "default?}], outputs:[{node, kind:image|images|video|audio|text|"
            "model, label?}]} defines what a ComfyTV.CustomStage exposes for a "
            "kind='custom' workflow (media kinds become sockets, text/param "
            "become on-card editors, prompt:true feeds a text input from the "
            "stage's main_prompt; first output is the card preview; one output "
            "per kind, image+images allowed together) — it rewrites the "
            "matching bindings and meta.custom_io, replacing any previous "
            "set. {op:'duplicate', label} copies this workflow (file, "
            "bindings, custom_io) into a new entry of the same kind under "
            "that label — use it before set_custom_io when other cards "
            "already share this workflow and must keep their exposure; "
            "later ops in the same call still target the original, so "
            "edit the copy in a second workflow_edit call with the new "
            "label. {op:'set_default', default?} stars it for its kind. "
            "{op:'reset_to_preset'} restores the shipped preset (undo "
            "button). bind ops are checked against the API graph — unknown "
            "node_id/input_name is rejected with the valid list. Returns "
            "per-op results plus the workflow's bindings after the edit, and "
            "warnings for option:<key> bindings that would resolve empty at "
            "run time (no widget, no default) — fix those before running. "
            "Server-side — no open page needed."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "kind": {"type": "string"},
                "label": {"type": "string"},
                "ops": {"type": "array", "items": {"type": "object"},
                        "minItems": 1},
            },
            "required": ["kind", "label", "ops"],
            "additionalProperties": False,
        },
        "handler": _workflow_edit,
    },
    "workflow_create": {
        "description": (
            "Create and register a NEW workflow for a kind. Provide kind + "
            "label plus EITHER api_json (an API-format prompt: {node_id: "
            "{class_type, inputs}} — author it with node_info, it is "
            "validated against the live node registry and rejected with "
            "per-node errors before anything is written) OR graph (a "
            "GUI-format workflow export; it is converted to an API prompt "
            "server-side, so it can run headlessly right away). "
            "validate_only=true only runs the api_json validation. Optional "
            "description, result_node (node id whose output is the stage "
            "result) and result_type (ui_save_batch for image batches from a "
            "SaveImage-style node, ui_save_url for a single saved file, "
            "graph_output_first for a node's first graph output value). "
            "After creating, wire stage inputs "
            "with workflow_edit bind ops (main_prompt, option:<key>, "
            "upstream_image:value[N], computed:width/height/length, ...). "
            "The label lands deduplicated (label-2, ...) if taken. "
            "Server-side — no open page needed."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "kind": {"type": "string"},
                "label": {"type": "string"},
                "api_json": {"type": "object"},
                "graph": {},
                "description": {"type": "string"},
                "result_node": {"type": "string"},
                "result_type": {"type": "string"},
                "validate_only": {"type": "boolean"},
            },
            "required": ["kind", "label"],
            "additionalProperties": False,
        },
        "handler": _workflow_create,
    },
}
