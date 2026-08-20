import asyncio
import json
import re
import time
from urllib.parse import urlencode

from .. import storage
from ..nodes.stages import STAGE_META
from ..runners import WORKFLOW_KINDS, refresh_registry, workflow_db
from ..runners.exec_errors import list_exec_errors
from ._common import broadcast_asset_event, broadcast_entry_event
from .assets import _with_file_missing
from .canvas_state import get_canvas_state, mirror_summary
from .capabilities import VERSION
from .mcp_commands import submit_command
from .stages import stages_payload, workflow_info_payload


def _no_args_schema() -> dict:
    return {"type": "object", "properties": {}, "additionalProperties": False}


async def _server_info(_args: dict) -> dict:
    projects = storage.list_projects()
    return {
        "comfytv_version": VERSION,
        "stage_types": len(stages_payload()),
        "workflow_kinds": list(WORKFLOW_KINDS),
        "projects": len(projects),
        "canvas_mirror": mirror_summary() or "absent",
        "recent_exec_errors": len(list_exec_errors(50)),
        "readonly": False,
        "write_tools_need_open_tab": True,
    }


async def _projects(args: dict) -> dict:
    action = args.get("action", "list")
    if action == "list":
        storage.ensure_default_project()
        return {"projects": storage.list_projects()}
    if action == "get":
        pid = args.get("project_id")
        if not pid:
            raise ValueError("project_id is required for action='get'")
        proj = storage.get_project(pid)
        if proj is None:
            raise ValueError(f"project {pid!r} not found")
        latest = storage.list_outputs(pid, limit=1)
        return {
            "project": proj,
            "latest_output_at": latest[0]["created_at"] if latest else None,
        }
    raise ValueError(f"unknown action {action!r} (use 'list' or 'get')")


async def _stage_catalog(_args: dict) -> dict:
    return {
        "stages": stages_payload(),
        "workflow_info": workflow_info_payload(),
    }


async def _list_workflows(args: dict) -> dict:
    kind = args.get("kind")
    if kind and kind not in WORKFLOW_KINDS:
        raise ValueError(
            f"unknown workflow kind {kind!r} — valid kinds: {', '.join(WORKFLOW_KINDS)}"
        )
    return {
        "kinds": list(WORKFLOW_KINDS),
        "workflows": workflow_db.list_workflows_overview(kind or None),
    }


async def _get_canvas(args: dict) -> dict:
    return get_canvas_state(args.get("project_id") or None)


async def _outputs(args: dict) -> dict:
    pid = args.get("project_id")
    if not pid:
        raise ValueError("project_id is required")
    if args.get("latest_only"):
        stage_uid = args.get("stage_uid")
        stage_node_id = args.get("stage_node_id")
        if stage_uid:
            row = storage.latest_output_by_uid(pid, stage_uid)
        elif stage_node_id:
            row = storage.latest_output(pid, stage_node_id)
        else:
            raise ValueError("latest_only requires stage_uid or stage_node_id")
        return {"output": row}
    limit = max(1, min(int(args.get("limit", 20)), 100))
    rows = storage.list_outputs(
        pid, stage_node_id=args.get("stage_node_id"), limit=limit,
    )
    return {"outputs": rows}


async def _assets(args: dict) -> dict:
    category = str(args.get("category", "all"))
    limit = max(1, min(int(args.get("limit", 50)), 200))
    offset = max(0, int(args.get("offset", 0)))
    if category == "all":
        rows = storage.list_assets(limit=limit, offset=offset)
    elif category == "none":
        rows = storage.list_assets(uncategorized=True, limit=limit, offset=offset)
    else:
        try:
            cid = int(category)
        except ValueError:
            raise ValueError("category must be 'all', 'none' or a category id")
        rows = storage.list_assets(category_id=cid, limit=limit, offset=offset)
    out = []
    for r in rows:
        r = _with_file_missing(r)
        meta = r.pop("metadata", None)
        r["has_metadata"] = bool(meta)
        out.append(r)
    return {
        "assets": out,
        "categories": storage.list_asset_categories(),
    }


async def _jobs(args: dict) -> dict:
    job_id = args.get("job_id")
    if job_id:
        job = storage.get_remote_job(job_id)
        if job is None:
            raise ValueError(f"remote job {job_id!r} not found")
        return {"job": job}
    status = args.get("status")
    if status and status not in ("queued", "running", "done", "error", "cancelled"):
        raise ValueError(f"unknown status {status!r}")
    return {"jobs": storage.list_remote_jobs(status or None)}


async def _exec_errors(args: dict) -> dict:
    limit = max(1, min(int(args.get("limit", 10)), 50))
    return {"errors": list_exec_errors(limit)}


def _normalize_stage_class(value: str) -> str:
    name = value.removeprefix("ComfyTV.")
    if name not in STAGE_META:
        raise ValueError(
            f"unknown stage class {value!r} — see stage_catalog for valid node_id values"
        )
    return f"ComfyTV.{name}"


def _validate_workflow_label(stage_class: str, label: str) -> None:
    kind = STAGE_META.get(stage_class.removeprefix("ComfyTV."), {}).get("workflow_kind")
    if not kind:
        raise ValueError(
            f"{stage_class} has no workflow selector — drop the 'workflow' argument"
        )
    labels = [w["label"] for w in workflow_db.list_workflows_overview(kind)]
    if label not in labels:
        raise ValueError(
            f"workflow {label!r} not found for kind {kind!r} — "
            f"valid labels: {', '.join(labels) or '(none)'}"
        )


def _command_payload(args: dict, keys: tuple[str, ...]) -> dict:
    return {k: args[k] for k in keys if args.get(k) is not None}


def _validate_widgets(args: dict) -> None:
    widgets = args.get("widgets")
    if widgets is not None and not isinstance(widgets, dict):
        raise ValueError("widgets must be an object mapping widget name -> value")


async def _add_stage(args: dict) -> dict:
    stage_class = _normalize_stage_class(str(args.get("node_class") or ""))
    if args.get("workflow"):
        _validate_workflow_label(stage_class, str(args["workflow"]))
    _validate_widgets(args)
    _validate_asset_refs(args)
    payload = _command_payload(
        args, ("title", "prompt", "workflow", "widgets", "asset_refs", "pos",
               "project_id"))
    payload["node_class"] = stage_class
    return await submit_command("add_stage", payload)


def _validate_server(args: dict) -> None:
    server = args.get("server")
    if server is None or str(server).lower() in ("", "local"):
        return
    try:
        sid = int(server)
    except (TypeError, ValueError):
        raise ValueError("server must be a server id from the servers tool, or 'local'")
    row = storage.get_server(sid)
    if row is None:
        raise ValueError(f"server {sid} not found — see the servers tool")
    if not row.get("enabled", True):
        raise ValueError(f"server {sid} ({row['label']}) is disabled")


def _validate_asset_refs(args: dict) -> None:
    refs = args.get("asset_refs")
    if refs is None:
        return
    if not isinstance(refs, list):
        raise ValueError(
            "asset_refs must be an array of {asset_id, slot?, type?} objects")
    for r in refs:
        if not isinstance(r, dict) or "asset_id" not in r:
            raise ValueError("each asset_refs entry needs an asset_id")
        try:
            aid = int(r["asset_id"])
        except (TypeError, ValueError):
            raise ValueError(f"invalid asset_id {r.get('asset_id')!r}")
        asset = storage.get_asset(aid)
        if asset is None:
            raise ValueError(f"asset {aid} not found — see the assets tool")
        rtype = r.get("type")
        if rtype is not None and rtype not in ("image", "video", "audio"):
            raise ValueError(f"asset_refs type must be image/video/audio, got {rtype!r}")


async def _set_stage(args: dict) -> dict:
    node = args.get("node")
    if not node:
        raise ValueError("node is required (stage uid or graph node id)")
    if not any(args.get(k) is not None
               for k in ("prompt", "workflow", "title", "widgets", "server",
                         "asset_refs")):
        raise ValueError(
            "nothing to set — pass prompt, workflow, title, widgets, server "
            "and/or asset_refs")
    _validate_widgets(args)
    _validate_server(args)
    _validate_asset_refs(args)
    payload = _command_payload(
        args, ("prompt", "workflow", "title", "widgets", "server",
               "asset_refs", "project_id"))
    payload["node"] = str(node)
    return await submit_command("set_stage", payload)


async def _servers(_args: dict) -> dict:
    from .servers import _active_jobs_by_server, _fetch_server_queue
    import aiohttp
    import asyncio as _asyncio

    servers = storage.list_servers()
    enabled = [s for s in servers if s.get("enabled", True)]
    statuses: list[dict] = []
    if enabled:
        timeout = aiohttp.ClientTimeout(total=4)
        active = _active_jobs_by_server()
        async with aiohttp.ClientSession(timeout=timeout) as session:
            results = await _asyncio.gather(
                *(_fetch_server_queue(session, s) for s in enabled))
        for st in results:
            st["jobs"] = active.get(st["id"], 0)
            statuses.append(st)
    by_id = {st["id"]: st for st in statuses}
    return {
        "servers": [
            {**s, "status": by_id.get(s["id"])} for s in servers
        ],
    }


async def _connect_stages(args: dict) -> dict:
    from_node = args.get("from_node")
    to_node = args.get("to_node")
    if not from_node or not to_node:
        raise ValueError("from_node and to_node are required")
    payload = _command_payload(args, ("from_slot", "to_slot", "project_id"))
    payload["from_node"] = str(from_node)
    payload["to_node"] = str(to_node)
    return await submit_command("connect_stages", payload)


_RUN_STARTED: dict[str, float] = {}
_RUN_STARTED_MAX = 500


async def _run_stage(args: dict) -> dict:
    node = args.get("node")
    if not node:
        raise ValueError("node is required (stage uid or graph node id)")
    payload = _command_payload(args, ("project_id",))
    payload["node"] = str(node)
    started_at = time.time()
    result = await submit_command("run_stage", payload, timeout=60.0)
    if isinstance(result, dict) and result.get("started"):
        uid = str(result.get("uid") or "")
        if uid:
            _RUN_STARTED[uid] = started_at
            while len(_RUN_STARTED) > _RUN_STARTED_MAX:
                _RUN_STARTED.pop(next(iter(_RUN_STARTED)))
    return result


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
_RESOURCE_KINDS = ("lut", "font", "soundfont")
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
        "bindings": cfg["bindings"],
        "exposed_widgets": cfg.get("exposed_widgets") or [],
        "nodes": _slim_api_nodes(cfg.get("api_json")),
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
        elif name in ("set_default", "reset_to_preset"):
            pass
        else:
            raise ValueError(
                f"ops[{i}]: unknown op {name!r} — valid: bind, unbind, "
                "set_meta, set_default, reset_to_preset")

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
            results.append({"op": name, "ok": bool(ok)})
        elif name == "set_meta":
            kwargs = {k: op[k] for k in _META_KEYS if k in op}
            ok = workflow_db.update_workflow_meta(wid, **kwargs)
            results.append({"op": name, "ok": bool(ok),
                            "fields": sorted(kwargs)})
        elif name == "set_default":
            out = workflow_db.set_default_workflow(
                wid, bool(op.get("default", True)))
            results.append({"op": name, "ok": out is not None})
        elif name == "reset_to_preset":
            out = workflow_db.reset_workflow_to_preset(wid)
            if out is not None:
                refresh_registry()
            results.append({"op": name, "ok": out is not None})
    fresh = workflow_db.get_workflow_config(cfg["kind"], cfg["label"])
    return {"results": results,
            "bindings": (fresh or {}).get("bindings", [])}


_NODE_INFO_MAX_RESULTS = 20
_NODE_INFO_MAX_CHOICES = 24


def _slim_input_spec(spec) -> dict:
    if not isinstance(spec, (list, tuple)) or not spec:
        return {"type": str(spec)}
    head = spec[0]
    cfg = spec[1] if len(spec) > 1 and isinstance(spec[1], dict) else {}
    out: dict = {}
    choices = None
    if isinstance(head, (list, tuple)):
        choices = [str(c) for c in head]
    elif str(head) == "COMBO" and isinstance(cfg.get("options"), list):
        choices = [str(c) for c in cfg["options"]]
    if choices is not None:
        out["type"] = "COMBO"
        out["choices"] = choices[:_NODE_INFO_MAX_CHOICES]
        if len(choices) > _NODE_INFO_MAX_CHOICES:
            out["choices_total"] = len(choices)
    else:
        out["type"] = str(head)
    for key in ("default", "min", "max", "step", "multiline", "tooltip"):
        if key in cfg:
            out[key] = cfg[key]
    return out


def _node_info_dict(name: str, cls) -> dict:
    getter = getattr(cls, "GET_NODE_INFO_V1", None)
    if getter is not None:
        try:
            return dict(getter())
        except Exception:
            pass
    import nodes as comfy_nodes
    display = getattr(comfy_nodes, "NODE_DISPLAY_NAME_MAPPINGS", {})
    try:
        input_types = cls.INPUT_TYPES()
    except Exception as e:
        raise ValueError(f"node {name!r} failed to report its inputs: {e}")
    return {
        "name": name,
        "display_name": display.get(name, name),
        "description": str(getattr(cls, "DESCRIPTION", "") or ""),
        "category": str(getattr(cls, "CATEGORY", "") or ""),
        "output_node": bool(getattr(cls, "OUTPUT_NODE", False)),
        "input": input_types,
        "output": list(getattr(cls, "RETURN_TYPES", ()) or ()),
        "output_name": list(getattr(cls, "RETURN_NAMES", ()) or ()),
    }


def _slim_node_info(info: dict) -> dict:
    inputs: dict = {}
    for section in ("required", "optional"):
        src = (info.get("input") or {}).get(section) or {}
        slim = {n: _slim_input_spec(spec) for n, spec in src.items()}
        if slim:
            inputs[section] = slim
    names = info.get("output_name") or []
    outputs = []
    for i, typ in enumerate(info.get("output") or []):
        outputs.append({
            "type": "COMBO" if isinstance(typ, (list, tuple)) else str(typ),
            "name": str(names[i]) if i < len(names) else "",
        })
    return {
        "name": info.get("name"),
        "display_name": info.get("display_name"),
        "category": info.get("category"),
        "description": str(info.get("description") or "")[:400],
        "output_node": bool(info.get("output_node")),
        "inputs": inputs,
        "outputs": outputs,
    }


async def _node_info(args: dict) -> dict:
    import nodes as comfy_nodes
    mappings = getattr(comfy_nodes, "NODE_CLASS_MAPPINGS", {})
    action = str(args.get("action") or "search")
    if action == "get":
        name = str(args.get("name") or "")
        cls = mappings.get(name)
        if cls is None:
            close = sorted(k for k in mappings if name.lower() in k.lower())[:8]
            hint = f" — close names: {close}" if close else ""
            raise ValueError(f"unknown node class {name!r}{hint}")
        return _slim_node_info(_node_info_dict(name, cls))
    if action == "search":
        query = str(args.get("query") or "").strip().lower()
        if not query:
            raise ValueError("query is required for action='search'")
        tokens = query.split()
        display = getattr(comfy_nodes, "NODE_DISPLAY_NAME_MAPPINGS", {})
        hits = []
        for cname, cls in mappings.items():
            hay = " ".join((
                cname,
                display.get(cname, ""),
                str(getattr(cls, "CATEGORY", "") or ""),
                str(getattr(cls, "DESCRIPTION", "") or "")[:200],
            )).lower()
            if all(t in hay for t in tokens):
                hits.append({
                    "name": cname,
                    "display_name": display.get(cname, cname),
                    "category": str(getattr(cls, "CATEGORY", "") or ""),
                })
        return {"total": len(hits), "nodes": hits[:_NODE_INFO_MAX_RESULTS]}
    raise ValueError(f"unknown action {action!r} (use 'search' or 'get')")


async def _validate_api_prompt(api_json: dict) -> dict:
    import uuid
    import execution
    result = await execution.validate_prompt(str(uuid.uuid4()), api_json, None)
    valid = bool(result[0])
    out: dict = {"valid": valid}
    if not valid:
        err = result[1] or {}
        out["error"] = {k: err.get(k) for k in ("type", "message", "details")
                        if err.get(k)}
        slim = {}
        for nid, info in (result[3] or {}).items():
            msgs = []
            for e in (info or {}).get("errors", []):
                msg = str(e.get("message") or "")
                if e.get("details"):
                    msg += f": {e['details']}"
                msgs.append(msg)
            slim[nid] = {"class_type": (info or {}).get("class_type"),
                         "errors": msgs}
        if slim:
            out["node_errors"] = slim
    return out


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
    note = None
    if api_json is None:
        note = ("registered without API JSON — the workflow must be opened "
                "once in the ComfyTV UI (Desktop or browser, which converts the graph) "
                "before it can run headlessly")
    return {"created": True, **out, "validation": validation, "note": note}


_GRAPH_OPS = ("add_node", "remove_node", "set_widget", "set_title",
              "connect", "disconnect", "set_mode", "clone", "set_color",
              "create_group", "collapse", "pin", "convert_to_subgraph",
              "unpack_subgraph")

_CANVAS_COMMANDS = (
    "Comfy.Undo",
    "Comfy.Redo",
    "Comfy.SaveWorkflow",
    "Comfy.Canvas.FitView",
    "Comfy.Canvas.ResetView",
    "Comfy.Interrupt",
    "Comfy.ClearPendingTasks",
    "Comfy.RefreshNodeDefinitions",
    "Comfy.Graph.GroupSelectedNodes",
)


async def _canvas_command(args: dict) -> dict:
    command = str(args.get("command") or "")
    if command not in _CANVAS_COMMANDS:
        raise ValueError(
            f"command {command!r} is not allowed — allowed: "
            f"{', '.join(_CANVAS_COMMANDS)}")
    nodes = args.get("nodes")
    if nodes is not None and (
            not isinstance(nodes, list)
            or not all(isinstance(n, (str, int)) for n in nodes)):
        raise ValueError("nodes must be an array of node ids")
    payload = _command_payload(args, ("project_id", "nodes"))
    payload["command"] = command
    return await submit_command("canvas_command", payload)


async def _canvas_focus(args: dict) -> dict:
    node = str(args.get("node") or "")
    if not node:
        raise ValueError("node is required (a graph node id from graph_get)")
    payload = _command_payload(args, ("project_id",))
    payload["node"] = node
    return await submit_command("canvas_focus", payload)


async def _graph_get(args: dict) -> dict:
    return await submit_command(
        "graph_get", _command_payload(args, ("project_id",)))


async def _graph_edit(args: dict) -> dict:
    ops = args.get("ops")
    if not isinstance(ops, list) or not ops:
        raise ValueError("ops must be a non-empty array of {op, ...} objects")
    for i, op in enumerate(ops):
        if not isinstance(op, dict) or str(op.get("op") or "") not in _GRAPH_OPS:
            raise ValueError(
                f"ops[{i}] must be an object with op one of: "
                f"{', '.join(_GRAPH_OPS)}")
    payload = _command_payload(args, ("project_id",))
    payload["ops"] = ops
    return await submit_command("graph_edit", payload)


def _history_outputs(entry: dict) -> list[str]:
    urls: list[str] = []
    for node_out in (entry.get("outputs") or {}).values():
        if not isinstance(node_out, dict):
            continue
        for files in node_out.values():
            if not isinstance(files, list):
                continue
            for f in files:
                if not isinstance(f, dict) or not f.get("filename"):
                    continue
                urls.append("/view?" + urlencode({
                    "filename": f["filename"],
                    "subfolder": f.get("subfolder") or "",
                    "type": f.get("type") or "output",
                }))
    return urls


def _history_error_message(status: dict) -> str:
    for msg in status.get("messages") or []:
        if (isinstance(msg, (list, tuple)) and len(msg) == 2
                and msg[0] == "execution_error"):
            data = msg[1] or {}
            return (f"{data.get('node_type')} (node {data.get('node_id')}): "
                    f"{data.get('exception_message')}")
    return "execution failed"


async def _graph_run(args: dict) -> dict:
    prompt_id = str(args.get("prompt_id") or "")
    base: dict = {}
    if not prompt_id:
        base = await submit_command(
            "graph_run", _command_payload(args, ("project_id",)), timeout=60.0)
        prompt_id = str(base.get("prompt_id") or "")
        if not prompt_id:
            return base

    wait_s = args.get("wait_s")
    wait_s = 60.0 if wait_s is None else max(0.0, float(wait_s))
    wait_s = min(wait_s, 170.0)

    from server import PromptServer
    queue = getattr(PromptServer.instance, "prompt_queue", None)
    if queue is None:
        return {**base, "prompt_id": prompt_id, "status": "queued",
                "note": "history unavailable in this server"}

    deadline = time.monotonic() + wait_s
    while True:
        hist = queue.get_history(prompt_id=prompt_id) or {}
        entry = hist.get(prompt_id)
        if entry:
            status = entry.get("status") or {}
            out = {**base, "prompt_id": prompt_id,
                   "outputs": _history_outputs(entry)}
            if status.get("status_str") == "error":
                out["status"] = "error"
                out["error"] = _history_error_message(status)
            else:
                out["status"] = "done"
            return out
        if time.monotonic() >= deadline:
            return {**base, "prompt_id": prompt_id, "status": "running",
                    "hint": "re-call graph_run with this prompt_id to keep "
                            "waiting"}
        await asyncio.sleep(1.0)


async def _asset_edit(args: dict) -> dict:
    action = str(args.get("action") or "")
    if action == "create_category":
        name = str(args.get("name") or "").strip()
        if not name:
            raise ValueError("name is required")
        row = storage.create_asset_category(name)
        if row is None:
            raise ValueError(f"category {name!r} already exists")
        return {"category": row}
    if action == "create":
        payload_url = str(args.get("payload_url") or "").strip()
        if not payload_url:
            raise ValueError("payload_url is required (e.g. an output's "
                             "payload_url from the outputs tool)")
        media_type = str(args.get("media_type") or "image")
        if media_type not in storage.ASSET_MEDIA_TYPES:
            raise ValueError(
                f"unknown media_type {media_type!r}; "
                f"valid: {list(storage.ASSET_MEDIA_TYPES)}")
        row = storage.create_asset(
            name=str(args.get("name") or ""),
            payload_url=payload_url,
            media_type=media_type,
            category_ids=_category_ids(args.get("categories")),
            source="mcp",
        )
        if row is None:
            raise ValueError("invalid asset (bad category or payload)")
        row = _with_file_missing(row)
        broadcast_asset_event("create", {"asset": row})
        return {"asset": row}
    if action == "update":
        aid = args.get("asset_id")
        if not isinstance(aid, int):
            raise ValueError("asset_id (integer) is required")
        cats = args.get("categories")
        row = storage.update_asset(
            aid,
            name=str(args["name"]) if args.get("name") is not None else None,
            category_ids=_category_ids(cats) if cats is not None else None,
        )
        if row is None:
            raise ValueError(f"asset {aid} not found (or bad category)")
        row = _with_file_missing(row)
        broadcast_asset_event("update", {"asset": row})
        return {"asset": row}
    if action == "delete":
        aid = args.get("asset_id")
        if not isinstance(aid, int):
            raise ValueError("asset_id (integer) is required")
        if not storage.delete_asset(aid):
            raise ValueError(f"asset {aid} not found")
        broadcast_asset_event("delete", {"id": aid})
        return {"ok": True}
    raise ValueError(f"unknown action {action!r} — valid: create, update, "
                     "delete, create_category")


def _category_ids(raw) -> list[int]:
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ValueError("categories must be an array of names or ids")
    existing = {c["name"]: c["id"] for c in storage.list_asset_categories()}
    ids: list[int] = []
    for item in raw:
        if isinstance(item, int):
            ids.append(item)
            continue
        name = str(item).strip()
        if not name:
            continue
        cid = existing.get(name)
        if cid is None:
            row = storage.create_asset_category(name)
            cid = row["id"] if row else None
        if cid is not None:
            ids.append(cid)
            existing[name] = cid
    return ids


async def _entries(args: dict) -> dict:
    action = str(args.get("action") or "list")
    pid = str(args.get("project_id") or "default")
    if not storage.project_exists(pid):
        raise ValueError(f"project {pid!r} not found")
    if action == "list":
        rows = storage.list_entries(pid)
        kind = args.get("kind")
        if kind:
            rows = [r for r in rows if r["kind"] == kind]
        return {"entries": rows}
    if action == "upsert":
        kind = str(args.get("kind") or "")
        label = str(args.get("label") or "").strip()
        if kind not in storage.ENTRY_KINDS:
            raise ValueError(
                f"unknown kind {kind!r}; valid: {list(storage.ENTRY_KINDS)}")
        if not label:
            raise ValueError("label is required")
        entry_id = args.get("id")
        row = storage.upsert_entry(
            pid, kind=kind, label=label,
            content=str(args.get("content") or ""),
            metadata=args.get("metadata")
            if isinstance(args.get("metadata"), dict) else None,
            entry_id=int(entry_id) if entry_id is not None else None,
        )
        if row is None:
            raise ValueError(
                "invalid label — must start with a letter/underscore (CJK ok), "
                "then letters/digits/_/-")
        broadcast_entry_event("upsert", pid, {"entry": row})
        return {"entry": row}
    if action == "delete":
        eid = args.get("id")
        if not isinstance(eid, int):
            raise ValueError("id (integer) is required")
        if not storage.delete_entry(pid, eid):
            raise ValueError(f"entry {eid} not found")
        broadcast_entry_event("delete", pid, {"id": eid})
        return {"ok": True}
    raise ValueError(f"unknown action {action!r} — valid: list, upsert, delete")


async def _resources(args: dict) -> dict:
    kind = args.get("kind")
    if kind is not None and kind not in _RESOURCE_KINDS:
        raise ValueError(
            f"unknown kind {kind!r}; valid: {', '.join(_RESOURCE_KINDS)}")
    return {"resources": storage.list_resources(kind),
            "kinds": list(_RESOURCE_KINDS)}


async def _stage_params_tool(args: dict) -> dict:
    action = str(args.get("action") or "list")
    if action == "list":
        return {"params": storage.list_stage_params(args.get("kind"))}
    if action == "create":
        kind = str(args.get("kind") or "").strip()
        label = str(args.get("label") or "").strip()
        type_ = str(args.get("type") or "").strip()
        if not kind:
            raise ValueError("kind is required (a stage kind like 'video')")
        if not label:
            raise ValueError("label is required")
        if type_ not in storage.STAGE_PARAM_TYPES:
            raise ValueError(
                f"unknown type {type_!r}; valid: {list(storage.STAGE_PARAM_TYPES)}")
        config = args.get("config")
        row = storage.create_stage_param(
            kind=kind, label=label, type=type_,
            default=args.get("default"),
            config=config if isinstance(config, dict) else None,
        )
        if row is None:
            raise ValueError("could not create stage param")
        from ._common import broadcast_stage_param_event
        broadcast_stage_param_event("create", {"param": row})
        return {"param": row}
    if action == "update":
        pid = args.get("id")
        if not isinstance(pid, int):
            raise ValueError("id (integer) is required")
        type_ = args.get("type")
        if type_ is not None and type_ not in storage.STAGE_PARAM_TYPES:
            raise ValueError(f"unknown type {type_!r}")
        kwargs: dict = {}
        if args.get("label") is not None:
            kwargs["label"] = str(args["label"])
        if type_ is not None:
            kwargs["type"] = type_
        if "default" in args:
            kwargs["default"] = args["default"]
        if "config" in args:
            cfg = args.get("config")
            kwargs["config"] = cfg if isinstance(cfg, dict) else None
        row = storage.update_stage_param(pid, **kwargs)
        if row is None:
            raise ValueError(f"param {pid} not found or read-only (system param)")
        from ._common import broadcast_stage_param_event
        broadcast_stage_param_event("update", {"param": row})
        return {"param": row}
    if action == "delete":
        pid = args.get("id")
        if not isinstance(pid, int):
            raise ValueError("id (integer) is required")
        if not storage.delete_stage_param(pid):
            raise ValueError(f"param {pid} not found or read-only (system param)")
        from ._common import broadcast_stage_param_event
        broadcast_stage_param_event("delete", {"id": pid})
        return {"ok": True}
    raise ValueError(
        f"unknown action {action!r} — valid: list, create, update, delete")


async def _media_probe(args: dict) -> dict:
    url = str(args.get("url") or "")
    if not url:
        raise ValueError("url is required (a /view?… payload_url)")
    from ..runners import media
    return await asyncio.to_thread(media.get_video_info, url)


async def _media_frame(args: dict) -> dict:
    url = str(args.get("url") or "")
    if not url:
        raise ValueError("url is required (a /view?… payload_url)")
    position = args.get("position", "middle")
    from ..runners import media
    image = await asyncio.to_thread(media.extract_frame, url, position)
    return {"image": image}


async def _media_waveform(args: dict) -> dict:
    url = str(args.get("url") or "")
    if not url:
        raise ValueError("url is required (a /view?… payload_url)")
    width = max(200, min(int(args.get("width", 1200)), 4000))
    height = max(100, min(int(args.get("height", 480)), 2000))
    from ..runners import audio_render
    image = await asyncio.to_thread(
        audio_render.render_waveform_image, url, width, height)
    return {"image": image}


_VIEW_MAX_PX_DEFAULT = 768
_VIEW_MAX_PX_CAP = 1200
_VIEW_JPEG_QUALITY = 80


def _render_view_image(url: str, max_px: int) -> dict:
    import base64
    import io

    from PIL import Image

    from ..runners.media import localize

    src = localize(url)
    with Image.open(str(src)) as im:
        source_w, source_h = im.size
        im = im.convert("RGB")
        im.thumbnail((max_px, max_px))
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=_VIEW_JPEG_QUALITY)
        return {
            "url": url,
            "source_width": source_w,
            "source_height": source_h,
            "width": im.width,
            "height": im.height,
            "_images": [{
                "data": base64.b64encode(buf.getvalue()).decode("ascii"),
                "mime": "image/jpeg",
            }],
        }


async def _view_image(args: dict) -> dict:
    url = str(args.get("url") or "")
    if not url:
        raise ValueError("url is required (a /view?… image URL)")
    try:
        max_px = int(args.get("max_px", _VIEW_MAX_PX_DEFAULT))
    except (TypeError, ValueError):
        raise ValueError("max_px must be an integer")
    max_px = max(256, min(max_px, _VIEW_MAX_PX_CAP))
    try:
        return await asyncio.to_thread(_render_view_image, url, max_px)
    except Exception as e:
        raise ValueError(
            f"could not open {url!r} as an image ({e}) — for videos, "
            "extract a frame with media_frame first")


_FX_PREVIEW_WINDOW_DEFAULT = 1.2
_FX_PREVIEW_WINDOW_MIN = 0.4
_FX_PREVIEW_WINDOW_MAX = 3.0


async def _fx_preview(args: dict) -> dict:
    node_class = _normalize_stage_class(str(args.get("node_class") or ""))
    if node_class.removeprefix("ComfyTV.") == "FXChainStage":
        raise ValueError(
            "FXChainStage renders the whole chain — preview individual FX "
            "stages here, then run the chain node for the final output")
    url = str(args.get("video") or "")
    if not url:
        raise ValueError("video is required (a /view?… video payload_url)")
    params = args.get("params") or {}
    if not isinstance(params, dict):
        raise ValueError("params must be an object of widget values")
    try:
        t = float(args.get("t", 0.0) or 0.0)
    except (TypeError, ValueError):
        raise ValueError("t must be a number (seconds into the video)")
    try:
        window = float(args.get("window") or _FX_PREVIEW_WINDOW_DEFAULT)
    except (TypeError, ValueError):
        raise ValueError("window must be a number (seconds)")
    window = max(_FX_PREVIEW_WINDOW_MIN,
                 min(_FX_PREVIEW_WINDOW_MAX, window))

    from .fx_preview import _render_preview, _spec_from_stage
    from .presets import _stage_class_map
    stage_cls = (await _stage_class_map()).get(node_class)
    if stage_cls is None:
        raise ValueError(f"unknown node_class {node_class!r}")
    try:
        data = _spec_from_stage(node_class, stage_cls, params, url)
    except Exception as e:
        raise ValueError(f"{node_class} does not support fx preview: {e}")
    result = await asyncio.to_thread(_render_preview, url, data, t, window)

    from ..runners import media
    frame_url = await asyncio.to_thread(
        media.extract_frame, result["url"], "middle")
    frame = await asyncio.to_thread(
        _render_view_image, frame_url, _VIEW_MAX_PX_DEFAULT)
    return {
        "url": result["url"],
        "t0": result["t0"],
        "t1": result["t1"],
        "frame_url": frame_url,
        "_images": frame["_images"],
    }


async def _pick_output(args: dict) -> dict:
    oid = args.get("output_id")
    idx = args.get("picked_index")
    if not isinstance(oid, int):
        raise ValueError("output_id (integer) is required")
    if not isinstance(idx, int) or idx < 1:
        raise ValueError("picked_index (1-based integer, >= 1) is required")
    row = storage.update_output_picked_index(oid, idx)
    if row is None:
        raise ValueError(f"output {oid} not found")
    return {"output": row}


async def _director_get(args: dict) -> dict:
    node = args.get("node")
    if not node:
        raise ValueError("node is required (DirectorStage uid or graph node id)")
    payload = _command_payload(args, ("project_id",))
    payload["node"] = str(node)
    return await submit_command("director_get", payload)


async def _director_edit(args: dict) -> dict:
    node = args.get("node")
    if not node:
        raise ValueError("node is required (DirectorStage uid or graph node id)")
    ops = args.get("ops")
    if not isinstance(ops, list) or not ops:
        raise ValueError("ops must be a non-empty array of {op, ...} objects")
    for i, op in enumerate(ops):
        if not isinstance(op, dict) or not op.get("op"):
            raise ValueError(f"ops[{i}] must be an object with an 'op' field")
    payload = _command_payload(args, ("project_id",))
    payload["node"] = str(node)
    payload["ops"] = ops
    return await submit_command("director_edit", payload, timeout=30.0)


async def _arrange_canvas(args: dict) -> dict:
    payload = _command_payload(args, ("project_id",))
    margin = args.get("margin")
    if margin is not None:
        try:
            payload["margin"] = float(margin)
        except (TypeError, ValueError):
            raise ValueError("margin must be a number")
    layout = args.get("layout")
    if layout is not None:
        if layout not in ("horizontal", "vertical"):
            raise ValueError("layout must be 'horizontal' or 'vertical'")
        payload["layout"] = layout
    return await submit_command("arrange_canvas", payload, timeout=30.0)


async def _cancel_stage(args: dict) -> dict:
    node = args.get("node")
    if not node:
        raise ValueError("node is required (stage uid or graph node id)")
    payload = _command_payload(args, ("project_id",))
    payload["node"] = str(node)
    return await submit_command("cancel_stage", payload, timeout=30.0)


async def _get_stage(args: dict) -> dict:
    node = args.get("node")
    if not node:
        raise ValueError("node is required (stage uid or graph node id)")
    payload = _command_payload(args, ("project_id",))
    payload["node"] = str(node)
    return await submit_command("get_stage", payload)


_WAIT_POLL_S = 1.0
_WAIT_DEFAULT_S = 25.0
_WAIT_MAX_S = 170.0


def _mirror_stage(project_id, node_ref: str):
    snap = get_canvas_state(project_id)
    if not snap.get("available"):
        raise ValueError(str(snap.get("reason") or "canvas mirror unavailable"))
    for s in snap.get("stages", []):
        uid = str(s.get("uid") or "")
        if str(s.get("graph_node_id")) == node_ref or uid == node_ref \
                or (len(node_ref) >= 8 and uid.startswith(node_ref)):
            return snap["project_id"], s
    raise ValueError(f"stage {node_ref!r} not found on the mirrored canvas")


def _output_created_ts(row) -> float | None:
    from datetime import datetime, timezone
    raw = (row or {}).get("created_at")
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(str(raw))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.timestamp()


async def _wait_stage(args: dict) -> dict:
    node = args.get("node")
    if not node:
        raise ValueError("node is required (stage uid or graph node id)")
    try:
        timeout_s = float(args.get("timeout_s", _WAIT_DEFAULT_S))
    except (TypeError, ValueError):
        raise ValueError("timeout_s must be a number")
    timeout_s = max(2.0, min(timeout_s, _WAIT_MAX_S))

    pid, stage = _mirror_stage(args.get("project_id"), str(node))
    uid = str(stage.get("uid") or "")
    initial_run = dict(stage.get("last_run") or {})
    run_started = _RUN_STARTED.get(uid)

    after = args.get("after_output_id")
    if after is not None:
        baseline = int(after)
    else:
        row = storage.latest_output_by_uid(pid, uid)
        baseline = int(row["id"]) if row else 0

    def _is_fresh(row) -> bool:
        if not row:
            return False
        if int(row["id"]) > baseline:
            return True
        if run_started is None:
            return False
        created = _output_created_ts(row)
        return created is not None and created >= run_started

    t0 = time.monotonic()
    while True:
        row = storage.latest_output_by_uid(pid, uid)
        if _is_fresh(row):
            return {
                "status": "done",
                "output": row,
                "waited_s": round(time.monotonic() - t0, 1),
            }
        try:
            _, fresh = _mirror_stage(pid, uid)
        except ValueError:
            fresh = None
        if fresh is not None:
            run = dict(fresh.get("last_run") or {})
            if run.get("status") == "error" and run != initial_run:
                return {
                    "status": "error",
                    "error": run.get("error") or "stage run failed",
                    "waited_s": round(time.monotonic() - t0, 1),
                }
        if time.monotonic() - t0 >= timeout_s:
            return {
                "status": "running",
                "after_output_id": baseline,
                "waited_s": round(time.monotonic() - t0, 1),
                "hint": "still running — call wait_stage again with the same "
                        "node and after_output_id to keep waiting",
            }
        await asyncio.sleep(_WAIT_POLL_S)


async def _remove_stage(args: dict) -> dict:
    node = args.get("node")
    if not node:
        raise ValueError("node is required (stage uid or graph node id)")
    payload = _command_payload(args, ("project_id",))
    payload["node"] = str(node)
    return await submit_command("remove_stage", payload)


_SCENE_CHANNELS = ("color", "depth", "normal", "openpose", "id")

_SCENE_LAYERS_SCHEMA = {
    "type": "object",
    "properties": {
        "characters": {"type": "boolean"},
        "props": {"type": "boolean"},
        "room": {"type": "boolean"},
        "floor": {"type": "boolean"},
    },
    "additionalProperties": False,
}


def _scene_target(args: dict) -> dict:
    node = args.get("node")
    if not node:
        raise ValueError("node is required (a ComfyTV.Scene3DStage uid or graph node id)")
    payload = _command_payload(args, ("project_id",))
    payload["node"] = str(node)
    return payload


def _validate_channel(args: dict) -> None:
    channel = args.get("channel")
    if channel is not None and channel not in _SCENE_CHANNELS:
        raise ValueError(
            f"channel must be one of {', '.join(_SCENE_CHANNELS)}")


async def _scene_get(args: dict) -> dict:
    return await submit_command("scene_get", _scene_target(args))


async def _scene_edit(args: dict) -> dict:
    ops = args.get("ops")
    if not isinstance(ops, list) or not ops:
        raise ValueError("ops must be a non-empty array of operation objects")
    if not all(isinstance(op, dict) and op.get("op") for op in ops):
        raise ValueError("every op must be an object with an 'op' field")
    payload = _scene_target(args)
    payload["ops"] = ops
    return await submit_command("scene_edit", payload)


async def _scene_capture(args: dict) -> dict:
    _validate_channel(args)
    payload = _scene_target(args)
    payload.update(_command_payload(args, ("channel", "width", "height", "layers")))
    return await submit_command("scene_capture", payload, timeout=120.0)


async def _scene_record(args: dict) -> dict:
    _validate_channel(args)
    payload = _scene_target(args)
    payload.update(_command_payload(args, ("channel", "width", "height", "layers")))
    return await submit_command("scene_record", payload, timeout=300.0)


TOOLS: dict[str, dict] = {
    "server_info": {
        "description": (
            "Report the ComfyTV install: version, stage-type and project counts, "
            "canvas-mirror freshness, recent local execution error count. Call this "
            "first. This server is READ-ONLY — it observes ComfyTV state and cannot "
            "run or modify anything."
        ),
        "inputSchema": _no_args_schema(),
        "handler": _server_info,
    },
    "projects": {
        "description": (
            "List ComfyTV projects (action='list') or fetch one project with its "
            "latest-output timestamp (action='get' + project_id)."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": ["list", "get"]},
                "project_id": {"type": "string"},
            },
            "additionalProperties": False,
        },
        "handler": _projects,
    },
    "stage_catalog": {
        "description": (
            "Catalog of INSTALLED ComfyTV stage node types (compile-time registry, "
            "NOT the user's canvas — use get_canvas for that) plus, per workflow "
            "kind, each configured workflow's input usage: which image/video/audio/"
            "text/model slots it uses or requires and its max input counts."
        ),
        "inputSchema": _no_args_schema(),
        "handler": _stage_catalog,
    },
    "list_workflows": {
        "description": (
            "List the workflows backing ComfyTV stages, optionally filtered by kind. "
            "has_api=false means the workflow has no pre-converted API JSON yet (it "
            "must be opened in the ComfyTV UI (Desktop or browser) once before it can run "
            "headlessly); file_exists/gui_valid flag broken files."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"kind": {"type": "string"}},
            "additionalProperties": False,
        },
        "handler": _list_workflows,
    },
    "get_canvas": {
        "description": (
            "Snapshot of the user's live ComfyTV canvas (stages, prompts, selected "
            "workflows, connections, last-run status), mirrored from an open ComfyTV "
            "page (Desktop or browser). Mirroring activates lazily on first MCP contact — right after "
            "connecting, retry once after ~10 seconds. available=false after that "
            "means no page is open or it never reported; stale=true means the page "
            "stopped updating (likely closed). Never guess canvas contents when "
            "unavailable — say so instead."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"project_id": {"type": "string"}},
            "additionalProperties": False,
        },
        "handler": _get_canvas,
    },
    "outputs": {
        "description": (
            "Execution outputs for a project (newest first), optionally filtered by "
            "stage_node_id. Each row carries params_json (the exact parameters of "
            "that run), duration_ms, and a payload_url relative to the ComfyUI "
            "server (e.g. /view?...). latest_only=true with stage_uid or "
            "stage_node_id returns just that stage's most recent output."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string"},
                "stage_node_id": {"type": "string"},
                "stage_uid": {"type": "string"},
                "limit": {"type": "integer", "minimum": 1, "maximum": 100},
                "latest_only": {"type": "boolean"},
            },
            "required": ["project_id"],
            "additionalProperties": False,
        },
        "handler": _outputs,
    },
    "assets": {
        "description": (
            "List asset-library entries (images/video/audio/models) and categories. "
            "category: 'all', 'none' (uncategorized) or a category id. "
            "file_missing=true marks orphaned rows whose file is gone from disk — "
            "worth flagging to the user."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "category": {"type": "string"},
                "limit": {"type": "integer", "minimum": 1, "maximum": 200},
                "offset": {"type": "integer", "minimum": 0},
            },
            "additionalProperties": False,
        },
        "handler": _assets,
    },
    "jobs": {
        "description": (
            "Remote-execution jobs (stages routed to another ComfyUI server). "
            "Filter by status (queued/running/done/error/cancelled) or fetch one by "
            "job_id. error_text holds the failure reason. Local execution errors "
            "are NOT here — use exec_errors for those."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "status": {"type": "string",
                           "enum": ["queued", "running", "done", "error", "cancelled"]},
                "job_id": {"type": "string"},
            },
            "additionalProperties": False,
        },
        "handler": _jobs,
    },
    "exec_errors": {
        "description": (
            "Most recent LOCAL stage execution errors (in-memory, newest first, "
            "cleared on ComfyUI restart). Each entry has the stage kind, workflow "
            "label, error text and a traceback tail — the primary lead when a "
            "locally-run stage fails."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"limit": {"type": "integer", "minimum": 1, "maximum": 50}},
            "additionalProperties": False,
        },
        "handler": _exec_errors,
    },
    "add_stage": {
        "description": (
            "Add a ComfyTV stage node to the user's live canvas (requires an open "
            "ComfyTV page in Desktop or a browser — the page executes the command). "
            "node_class is a "
            "stage_catalog node_id (e.g. 'ComfyTV.ImageStage'). Optionally set "
            "title, prompt, workflow (a list_workflows label for the stage's "
            "kind), widgets (an object setting any stage widget by name, e.g. "
            "{\"duration\": 5, \"end_zoom\": 1.3}) and asset_refs (asset-library "
            "references: [{asset_id, slot?, type?}] with ids from the assets "
            "tool; they are sent as the stage's reference media at run time "
            "and addressable as @image_N / @video_N / @audio_N in the prompt) "
            "in the same call. Mention ordinals are ZERO-BASED per media type: "
            "the first sendable image is @image_0 (wired stage inputs and "
            "asset_refs occupy slots in order; a token past the sendable range "
            "expands to nothing and the result carries a warning). Returns the "
            "new node's graph_node_id and uid. Placement is automatic unless "
            "pos [x, y] is given."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "node_class": {"type": "string"},
                "title": {"type": "string"},
                "prompt": {"type": "string"},
                "workflow": {"type": "string"},
                "widgets": {"type": "object"},
                "asset_refs": {"type": "array", "items": {"type": "object"}},
                "pos": {"type": "array", "items": {"type": "number"},
                        "minItems": 2, "maxItems": 2},
                "project_id": {"type": "string"},
            },
            "required": ["node_class"],
            "additionalProperties": False,
        },
        "handler": _add_stage,
    },
    "set_stage": {
        "description": (
            "Update an existing stage on the live canvas: prompt (main_prompt), "
            "workflow (a list_workflows label), title, widgets (an object "
            "setting any stage widget by name; on an unknown name the error "
            "lists the stage's widget names), server (a server id from the "
            "servers tool to route this stage's runs to that machine, or "
            "'local') and/or asset_refs (asset-library references replacing "
            "the stage's current set: [{asset_id, slot?, type?}] with ids "
            "from the assets tool, addressable as @image_N / @video_N / "
            "@audio_N in the prompt; pass [] to clear). Mention ordinals are "
            "ZERO-BASED per media type (first image = @image_0; wired inputs "
            "and asset_refs occupy slots in order; out-of-range tokens expand "
            "to nothing and the result carries a warning). Asset loader "
            "stages (AssetImageLoaderStage / AssetVideoLoaderStage / "
            "AssetAudioLoaderStage / AssetModelLoaderStage) are selection "
            "nodes, not runnable: set widgets {\"asset_id\": <id>} and the "
            "loader selects that library asset and emits its output "
            "immediately — do NOT run_stage them, just run the downstream "
            "stage. Multi-candidate stages (Image/Audio/Video Picker pools "
            "and image-batch generators like ImageStage) select the same "
            "way: widgets {\"selected_index\": N} (1-BASED) picks that "
            "candidate on the live card and updates the downstream output. "
            "node is a stage uid or graph_node_id from get_canvas. "
            "Requires an open ComfyTV page in Desktop or a browser."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {"type": "string"},
                "prompt": {"type": "string"},
                "workflow": {"type": "string"},
                "title": {"type": "string"},
                "widgets": {"type": "object"},
                "server": {"type": "string"},
                "asset_refs": {"type": "array", "items": {"type": "object"}},
                "project_id": {"type": "string"},
            },
            "required": ["node"],
            "additionalProperties": False,
        },
        "handler": _set_stage,
    },
    "remove_stage": {
        "description": (
            "Remove a ComfyTV stage node from the live canvas (its stored "
            "outputs stay in the project history). node is a stage uid or "
            "graph_node_id from get_canvas. Only ComfyTV stages can be "
            "removed. Requires an open ComfyTV page in Desktop or a browser."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {"type": "string"},
                "project_id": {"type": "string"},
            },
            "required": ["node"],
            "additionalProperties": False,
        },
        "handler": _remove_stage,
    },
    "scene_get": {
        "description": (
            "Read a Scene3D stage's full scene: characters, primitives, models, "
            "lights, cameras (with motion presets), environment and output "
            "settings, plus available resources (character library, camera "
            "motion presets, model assets, capture channels) and busy state. "
            "Characters and models in the scene include available_clips — "
            "pick one with scene_edit set_animation {id, clip}, otherwise "
            "the character holds a static pose and only the camera moves. "
            "ALWAYS call this before scene_edit to see current ids and "
            "resources. node is the Scene3DStage uid or graph_node_id."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {"type": "string"},
                "project_id": {"type": "string"},
            },
            "required": ["node"],
            "additionalProperties": False,
        },
        "handler": _scene_get,
    },
    "scene_edit": {
        "description": (
            "Build/modify a Scene3D scene with an atomic array of structured "
            "ops (one undo step). Ops: add_primitive {shape: cube|sphere|"
            "cylinder|plane, color?, name?}, add_model {asset_id|url} "
            "(meshes glb/gltf/fbx/obj AND gaussian splats spz/splat/ksplat/"
            "ply — splats render in the color channel only, hidden in depth/"
            "normal/id control renders), "
            "add_character {model (from resources)}, add_light {type: "
            "directional|point|spot, color?, intensity?, position?, target?}, "
            "add_camera {fov?, output?}, set_transform {id, position?, "
            "rotation_deg?|quaternion?|look_at?, scale?}, set_color (on a "
            "character it tints the mannequin — use distinct colors in "
            "multi-character scenes so prompts can bind identity, e.g. "
            "'@image_0 is the red figure'; '' clears), "
            "patch_light, set_animation {id, clip (an available_clips name "
            "from scene_get — required for a character/model to actually "
            "move), speed?, loop?}, rename, "
            "set_hidden, remove, set_environment {show_grid?, background?, "
            "show_room?, floor_only? (ground plane without walls — an "
            "outdoor-friendly parallax anchor for control renders)}, "
            "set_output {fps?, frame_count?, camera_id?}, "
            "bind_camera_preset {id, preset_id (from resources — this is how "
            "you get dolly/orbit/push camera moves), speed?}, "
            "set_camera_tuning {id, reverse?, path_scale?, yaw_degrees?, ...}, "
            "set_camera_fov. Director cut track: add_shot {camera_id, "
            "dur_frames?, name?, lock? (character id the camera aims at), "
            "index?} — ordered shots pack gaplessly on the global clock and "
            "playback/recording switches to each shot's camera in turn "
            "(camera presets restart per shot; the world runs continuously); "
            "patch_shot {id, camera_id?, dur_frames?, lock? ('' clears), "
            "name?}, move_shot {id, index}, remove also deletes shots. "
            "Prompt strips (frame-range prompts for downstream generation): "
            "add_prompt {start, end, text?}, patch_prompt {id, start?, end?, "
            "text?}. Character paths: set_path {id (character), points "
            "([[x,z]|[x,y,z], ...] ground waypoints, >=2), times_sec? (per-"
            "waypoint arrival seconds -> non-linear speed), straight?, "
            "range? {start, end frames — when the walk happens}, sync_speed? "
            "(m/s: drives the clip by distance so feet don't slide; ~1.4 "
            "for Walk_Loop), clear?} — the character travels the spline "
            "facing its tangent (pair with set_animation Walk_Loop). "
            "All add_* ops accept position/rotation_deg/"
            "look_at/scale; positions are [x,y,z] with y up, units≈meters. "
            "After editing, verify visually with scene_capture. An unknown op "
            "or id errors with the full valid list and applies nothing."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {"type": "string"},
                "ops": {"type": "array", "items": {"type": "object"},
                        "minItems": 1},
                "project_id": {"type": "string"},
            },
            "required": ["node", "ops"],
            "additionalProperties": False,
        },
        "handler": _scene_edit,
    },
    "scene_capture": {
        "description": (
            "Render the Scene3D scene to still image(s) — every camera plus "
            "the free view when no output camera is set — and return their "
            "URLs. channel: color (default), depth, normal, openpose or id "
            "(flat unique color per entity + an id_legend mapping id/name/"
            "color in the response — key masks for downstream regional "
            "control). layers {characters?, props?, room?, floor?: bool} "
            "hides scene layers for THIS capture only — e.g. {characters: "
            "false} renders environment-only depth so the control signal "
            "does not lock the character silhouette; {room: false, floor: "
            "true} keeps just the ground plane as a parallax anchor. Use "
            "after every scene_edit to visually verify the scene (fetch the "
            "returned URL and look at it) before recording. Also writes the "
            "capture into the stage so run_stage persists it to history."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {"type": "string"},
                "channel": {"type": "string",
                            "enum": list(_SCENE_CHANNELS)},
                "width": {"type": "integer", "minimum": 64, "maximum": 4096},
                "height": {"type": "integer", "minimum": 64, "maximum": 4096},
                "layers": _SCENE_LAYERS_SCHEMA,
                "project_id": {"type": "string"},
            },
            "required": ["node"],
            "additionalProperties": False,
        },
        "handler": _scene_capture,
    },
    "scene_record": {
        "description": (
            "Record the Scene3D scene along its timeline into a webm video "
            "and return its URL — the reference-video output. With a shot "
            "cut track (add_shot) the recording follows the cut: total "
            "duration is the summed shot dur_frames and the camera switches "
            "per shot. Otherwise duration comes from bound camera motion "
            "presets / character animations, or an explicit set_output "
            "frame_count; fps from set_output. Requires "
            "something recordable (a shot cut track, bind_camera_preset, an "
            "animated character, or frame_count > 0). channel and layers "
            "work like scene_capture: depth/openpose sequences feed "
            "control-video workflows (e.g. 'Local LTX 2.3 Control V2V'); "
            "channel 'id' returns an id_legend for per-entity masking; "
            "layers {characters: false} makes environment-only control, "
            "{room: false, floor: true} keeps just a ground-plane parallax "
            "anchor. The color webm can feed MiniMax H3 R2V as a loose "
            "reference."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {"type": "string"},
                "channel": {"type": "string",
                            "enum": list(_SCENE_CHANNELS)},
                "width": {"type": "integer", "minimum": 64, "maximum": 4096},
                "height": {"type": "integer", "minimum": 64, "maximum": 4096},
                "layers": _SCENE_LAYERS_SCHEMA,
                "project_id": {"type": "string"},
            },
            "required": ["node"],
            "additionalProperties": False,
        },
        "handler": _scene_record,
    },
    "servers": {
        "description": (
            "List configured remote ComfyUI servers with live load: each entry "
            "has host/port/enabled plus status {online, running, pending, "
            "jobs} (running/pending = that server's ComfyUI queue depth, jobs "
            "= ComfyTV remote jobs active on it; status null when disabled). "
            "To run stages on several machines concurrently: pick the online "
            "enabled server with the lowest running + pending + jobs (or use "
            "'local'), assign it per stage via set_stage {server}, then "
            "run_stage each — remote runs execute in parallel, results land "
            "locally, progress via jobs/get_canvas."
        ),
        "inputSchema": _no_args_schema(),
        "handler": _servers,
    },
    "connect_stages": {
        "description": (
            "Wire one stage's output into another stage's input on the live "
            "canvas. from_node/to_node are stage uids or graph_node_ids. "
            "from_slot is the source output index (default 0). to_slot is the "
            "target input name (e.g. 'images.0'); omit it to auto-pick the first "
            "free type-compatible input. Requires an open ComfyTV page in Desktop or a browser."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "from_node": {"type": "string"},
                "to_node": {"type": "string"},
                "from_slot": {"type": "integer", "minimum": 0},
                "to_slot": {"type": "string"},
                "project_id": {"type": "string"},
            },
            "required": ["from_node", "to_node"],
            "additionalProperties": False,
        },
        "handler": _connect_stages,
    },
    "run_stage": {
        "description": (
            "Queue a run of a stage on the live canvas, exactly like clicking its "
            "Run button (upstream snapshots, @mentions and asset refs all apply). "
            "Returns as soon as the run is queued — then call wait_stage on the "
            "same node to block until it finishes instead of polling. node is a "
            "stage uid or graph_node_id. Requires an open ComfyTV page in Desktop or a browser."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {"type": "string"},
                "project_id": {"type": "string"},
            },
            "required": ["node"],
            "additionalProperties": False,
        },
        "handler": _run_stage,
    },
    "director_get": {
        "description": (
            "Read a Director stage's full timeline: settings (chain mode "
            "off/prepend/replace — how each clip receives the previous "
            "clip's last frame), total seconds, default workflow, and every "
            "clip in order with id/enabled/workflow/prompt/duration_s/seed/"
            "transition(+_s)/per-clip images/videos/audio reference URLs and "
            "render status ({url, cached} — cached means an unchanged clip "
            "reuses its render on the next run). Also lists valid "
            "workflow_options, transitions and chain_modes. ALWAYS call "
            "before director_edit to get clip ids. node is the "
            "DirectorStage uid or graph node id; its card must be open in "
            "the tab."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {"type": "string"},
                "project_id": {"type": "string"},
            },
            "required": ["node"],
            "additionalProperties": False,
        },
        "handler": _director_get,
    },
    "director_edit": {
        "description": (
            "Edit a Director stage's clip timeline with an ops array, then "
            "run_stage the director node to render (unchanged clips reuse "
            "cached renders — only edited clips re-generate). Ops: "
            "{op:'add_clip', prompt?, workflow?, duration_s? (1-120s), "
            "transition?, transition_s?, enabled?, images?/videos?/audio? "
            "(arrays of /view?… URLs from assets/outputs), index?} → "
            "returns the new clip id; {op:'update_clip', id, ...same "
            "fields}; {op:'remove_clip', id}; {op:'duplicate_clip', id}; "
            "{op:'move_clip', id, index}; {op:'reroll', id?} re-seeds one "
            "clip (or all without id) to force a fresh take; "
            "{op:'set_chain', chain: off/prepend/replace}. Clip prompts may "
            "@-mention media: ordinals are ZERO-BASED per type over the "
            "MERGED pool — the director node's shared asset_refs (set via "
            "set_stage, the whole-film cast) come first, then the clip's "
            "own refs; @image_0 is the first shared image. No mentions = "
            "send all refs; mentioning = only the mentioned ones are sent. "
            "Rejected while the director is running."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {"type": "string"},
                "ops": {"type": "array", "items": {"type": "object"},
                        "minItems": 1},
                "project_id": {"type": "string"},
            },
            "required": ["node", "ops"],
            "additionalProperties": False,
        },
        "handler": _director_edit,
    },
    "stage_params": {
        "description": (
            "Manage custom stage parameters — extra widgets users define on a "
            "stage kind so workflows can bind values ComfyTV has no built-in "
            "key for. action 'list' (optional kind filter), 'create' (kind = "
            "a stage kind like 'video'/'image', label, type "
            "boolean/int/float/string/combo, optional default and config "
            "like {min,max,step} or {choices}), 'update' (id + fields), "
            "'delete' (id; system params are read-only). The returned "
            "param's 'key' is what you bind in workflow_edit as "
            "'option:<key>' — typical flow: stage_params create → "
            "workflow_edit bind {from: 'option:<key>'}."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {"type": "string",
                           "enum": ["list", "create", "update", "delete"]},
                "kind": {"type": "string"},
                "label": {"type": "string"},
                "type": {"type": "string"},
                "default": {},
                "config": {"type": "object"},
                "id": {"type": "integer"},
            },
            "required": ["action"],
            "additionalProperties": False,
        },
        "handler": _stage_params_tool,
    },
    "media_probe": {
        "description": (
            "Probe a video file's metadata: duration (seconds), fps, width, "
            "height, has_audio. url is a /view?… payload_url from outputs, "
            "assets or wait_stage results. Use to verify a render's length "
            "and resolution before wiring it downstream."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"url": {"type": "string"}},
            "required": ["url"],
            "additionalProperties": False,
        },
        "handler": _media_probe,
    },
    "media_frame": {
        "description": (
            "Extract a single frame from a video as a PNG and return its "
            "/view URL. Pair with view_image to actually look at the frame "
            "(media_frame alone only returns a URL). position: 'first', "
            "'middle', 'last', a percentage like '25%', or seconds. url is a "
            "/view?… payload_url."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "url": {"type": "string"},
                "position": {},
            },
            "required": ["url"],
            "additionalProperties": False,
        },
        "handler": _media_frame,
    },
    "media_waveform": {
        "description": (
            "Render an audio file's waveform to a PNG (RMS overlay + "
            "clipping markers) and return its /view URL — quick visual QC "
            "for generated audio: silence, clipping, envelope shape. url is "
            "a /view?… payload_url; optional width/height."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "url": {"type": "string"},
                "width": {"type": "integer"},
                "height": {"type": "integer"},
            },
            "required": ["url"],
            "additionalProperties": False,
        },
        "handler": _media_waveform,
    },
    "view_image": {
        "description": (
            "Actually SEE an image: returns the image itself (downscaled "
            "JPEG, default max 768px, cap 1200) so you can inspect "
            "composition, identity and quality with your own eyes — the "
            "only tool that returns visual content rather than a URL. url "
            "is any /view?… image URL (asset payload_url, an output's "
            "image, a media_frame result). For video QC: media_frame to "
            "pull a frame, then view_image on it. Use this before judging "
            "or picking outputs — never guess what an image looks like "
            "from its filename."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "url": {"type": "string"},
                "max_px": {"type": "integer"},
            },
            "required": ["url"],
            "additionalProperties": False,
        },
        "handler": _view_image,
    },
    "fx_preview": {
        "description": (
            "Cheap look at what ONE FX stage would do to a video before "
            "running anything: renders a short window (default 1.2s, max "
            "3s, downscaled to 640px) of the video through that stage's "
            "real filter chain and returns the preview clip URL plus its "
            "middle frame as an actual image you can see. node_class is an "
            "FX stage from stage_catalog (VideoColorStage, "
            "VideoCurvesStage, CDLStage…), params are its widget values "
            "(same names as set_stage widgets — read current ones with "
            "get_stage), video is the source /view?… payload_url, t is "
            "where in the video to look. Iterate params here until the "
            "frame looks right, THEN set_stage + run the FXChainStage for "
            "the full render — two orders of magnitude cheaper than "
            "re-rendering the whole video per attempt. Not for "
            "FXChainStage itself."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "node_class": {"type": "string"},
                "video": {"type": "string"},
                "params": {"type": "object"},
                "t": {"type": "number"},
                "window": {"type": "number"},
            },
            "required": ["node_class", "video"],
            "additionalProperties": False,
        },
        "handler": _fx_preview,
    },
    "pick_output": {
        "description": (
            "Record which candidate of a stored multi-image output is the "
            "chosen one (sets picked_index on an output row from the outputs "
            "tool; 1-BASED index into its payload images, matching the "
            "cards' selected_index). NOTE: for a stage that is live on the "
            "canvas, prefer set_stage widgets {\"selected_index\": N} — "
            "that drives the card itself (picker pools and image-batch "
            "generators) and updates downstream immediately; pick_output "
            "alone does not refresh an open card. Inspect candidates first "
            "via view_image on the output's payload_json image URLs."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "output_id": {"type": "integer"},
                "picked_index": {"type": "integer"},
            },
            "required": ["output_id", "picked_index"],
            "additionalProperties": False,
        },
        "handler": _pick_output,
    },
    "arrange_canvas": {
        "description": (
            "Tidy the whole canvas using litegraph's native arrange: nodes "
            "are laid out in dependency order, column by column, sized to "
            "their cards. Use after building a pipeline so nodes don't "
            "overlap. CAUTION: repositions EVERY node on the canvas and "
            "discards the user's manual layout — ask before arranging a "
            "canvas the user laid out by hand. margin is the spacing in "
            "pixels (default 100, 20-400); layout 'horizontal' (default) "
            "or 'vertical'. Requires an open ComfyTV page in Desktop or a browser."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "margin": {"type": "number"},
                "layout": {"type": "string",
                           "enum": ["horizontal", "vertical"]},
                "project_id": {"type": "string"},
            },
            "additionalProperties": False,
        },
        "handler": _arrange_canvas,
    },
    "cancel_stage": {
        "description": (
            "Stop a stage's in-flight run (local runs interrupt the ComfyUI "
            "queue; remote runs cancel the remote job) — use when a render "
            "is clearly wrong or stuck instead of waiting it out. node is a "
            "stage uid or graph node id; errors if the stage is not "
            "running. Requires an open ComfyTV page in Desktop or a browser."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {"type": "string"},
                "project_id": {"type": "string"},
            },
            "required": ["node"],
            "additionalProperties": False,
        },
        "handler": _cancel_stage,
    },
    "get_stage": {
        "description": (
            "Read one stage in full detail from the live canvas: every "
            "widget value (get_canvas only mirrors prompt/workflow), input "
            "connections with source nodes, output connections with target "
            "nodes, asset_refs, running state, position and any dangling "
            "@mention warnings. Call before set_stage widgets so you edit "
            "from actual values instead of guessing. node is a stage uid or "
            "graph node id. Requires an open ComfyTV page in Desktop or a browser."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {"type": "string"},
                "project_id": {"type": "string"},
            },
            "required": ["node"],
            "additionalProperties": False,
        },
        "handler": _get_stage,
    },
    "workflow_get": {
        "description": (
            "Read a workflow's full ComfyTV configuration: input bindings, "
            "the API graph's node inventory (node_id, class_type, title, "
            "current input values — linked inputs shown as «linked»), exposed "
            "widgets, sizing and meta. Use this before workflow_edit to see "
            "which node inputs exist and what is already bound. kind + label "
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
            "prompt), 'option:<key>' (a stage widget, e.g. option:seed), "
            "'computed:width'/'computed:height'/'computed:length' (sizing "
            "engine — use these for width/height so aspect settings apply), "
            "'literal:<value>', 'upstream_image:value[N]' (also :annotated / "
            ":masked) and upstream_video/audio/text/model:value[N]; cast is "
            "int/float/str. {op:'unbind', node_id, input_name} removes a "
            "binding. {op:'set_meta', description?/result_type?/result_node?/"
            "sizing?/prune_when_missing?/meta?} updates workflow meta. "
            "{op:'set_default', default?} stars it for its kind. "
            "{op:'reset_to_preset'} restores the shipped preset (undo "
            "button). bind ops are checked against the API graph — unknown "
            "node_id/input_name is rejected with the valid list. Returns "
            "per-op results plus the workflow's bindings after the edit. "
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
    "node_info": {
        "description": (
            "Look up ComfyUI node classes in the LIVE in-process registry "
            "(includes every installed custom node). action 'search' + query "
            "(space-separated tokens, all must match against class name / "
            "display name / category / description) lists matching classes; "
            "action 'get' + name returns one class's schema: inputs "
            "(required/optional with type, default, combo choices capped at "
            f"{_NODE_INFO_MAX_CHOICES}) and outputs. Use this to author "
            "API-format graphs for workflow_create. Server-side — no open "
            "tab needed."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": ["search", "get"]},
                "query": {"type": "string"},
                "name": {"type": "string"},
            },
            "additionalProperties": False,
        },
        "handler": _node_info,
    },
    "workflow_create": {
        "description": (
            "Create and register a NEW workflow for a kind. Provide kind + "
            "label plus EITHER api_json (an API-format prompt: {node_id: "
            "{class_type, inputs}} — author it with node_info, it is "
            "validated against the live node registry and rejected with "
            "per-node errors before anything is written) OR graph (a "
            "GUI-format workflow export, stored as-is; it must be opened "
            "once in the ComfyTV UI (Desktop or browser) before it can run headlessly). "
            "validate_only=true only runs the api_json validation. Optional "
            "description, result_node (node id whose output is the stage "
            "result) and result_type. After creating, wire stage inputs "
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
    "graph_get": {
        "description": (
            "Snapshot the NATIVE ComfyUI graph on the user's open canvas "
            "(the root graph — every node, not just ComfyTV stages): "
            "node_id, class type, title, widget values and connections "
            "(ComfyTV stage nodes carry is_stage=true — drive those with "
            "set_stage/run_stage instead). Use before graph_edit to see "
            "what is on the canvas. Requires an open ComfyTV page in Desktop "
            "or a browser (the page executes the command)."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"project_id": {"type": "string"}},
            "additionalProperties": False,
        },
        "handler": _graph_get,
    },
    "graph_edit": {
        "description": (
            "Edit the NATIVE ComfyUI graph on the open canvas — changes are "
            "immediately visible to the user. ops array, applied in order "
            "(stops at the first failing op; earlier ops stay applied): "
            "{op:'add_node', type, pos?, title?, widgets?} creates a node "
            "(type is a node class name — node_info can search them; "
            "returns the new node_id); {op:'set_widget', node, name, value} "
            "writes a widget; {op:'set_title', node, title}; {op:'connect', "
            "from_node, from_slot?, to_node, to_slot?} wires an output to "
            "an input (slots by name or index; to_slot omitted = first free "
            "type-compatible input); {op:'disconnect', node, input}; "
            "{op:'remove_node', node}; {op:'set_mode', node, mode: "
            "always/mute/bypass} (bypass to A/B a node's effect); "
            "{op:'clone', node, pos?}; {op:'set_color', node, color?, "
            "bgcolor?}; {op:'create_group', title, nodes: [ids], color?}; "
            "{op:'collapse', node, collapsed?}; {op:'pin', node, pinned?}; "
            "{op:'convert_to_subgraph', nodes: [ids]} packs the nodes into "
            "a subgraph (returns the new subgraph node's id); "
            "{op:'unpack_subgraph', node} explodes a subgraph node "
            "(graph_get flags them is_subgraph=true) back inline. "
            "The whole call is one undo step (Comfy.Undo reverts it). "
            "Requires an open ComfyTV page in Desktop or a browser."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string"},
                "ops": {"type": "array", "items": {"type": "object"},
                        "minItems": 1},
            },
            "required": ["ops"],
            "additionalProperties": False,
        },
        "handler": _graph_edit,
    },
    "graph_run": {
        "description": (
            "Queue the native canvas graph exactly like pressing ComfyUI's "
            "Run button (ComfyTV stage nodes are stripped/bridged the same "
            "way the Run button does), then wait up to wait_s (default 60, "
            "max 170) for it to finish by watching local history. Returns "
            "prompt_id plus status 'done' with outputs (/view URLs — "
            "view_image can look at them), 'error' with the failing node, "
            "or 'running' on timeout — re-call with the returned prompt_id "
            "to keep waiting. Requires an open ComfyTV page in Desktop or a browser to queue; "
            "waiting on a prompt_id is server-side."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string"},
                "wait_s": {"type": "number"},
                "prompt_id": {"type": "string"},
            },
            "additionalProperties": False,
        },
        "handler": _graph_run,
    },
    "canvas_command": {
        "description": (
            "Execute a whitelisted native canvas command in the open ComfyTV page: "
            "Comfy.Undo / Comfy.Redo (a whole graph_edit call is one undo "
            "step), Comfy.SaveWorkflow (persist the canvas to its file), "
            "Comfy.Canvas.FitView / Comfy.Canvas.ResetView, Comfy.Interrupt "
            "(stop the current run), Comfy.ClearPendingTasks, "
            "Comfy.RefreshNodeDefinitions (reload node classes after "
            "installing a pack — no server restart), "
            "Comfy.Graph.GroupSelectedNodes. Only these ids are allowed. "
            "Optional nodes (array of node ids) selects those nodes first — "
            "required for selection-dependent commands like "
            "GroupSelectedNodes, and focuses FitView on them. Requires an "
            "open ComfyTV page in Desktop or a browser."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string"},
                "command": {"type": "string",
                            "enum": list(_CANVAS_COMMANDS)},
                "nodes": {"type": "array",
                          "items": {"type": ["string", "integer"]}},
            },
            "required": ["command"],
            "additionalProperties": False,
        },
        "handler": _canvas_command,
    },
    "canvas_focus": {
        "description": (
            "Select a native graph node and glide the user's viewport to it "
            "— use after graph_edit to show the user what changed. node is "
            "a node id from graph_get. Requires an open ComfyTV page in Desktop or a browser."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string"},
                "node": {"type": "string"},
            },
            "required": ["node"],
            "additionalProperties": False,
        },
        "handler": _canvas_focus,
    },
    "asset_edit": {
        "description": (
            "Write to the asset library. action 'create' saves media as an "
            "asset: payload_url (e.g. an output's payload_url from the "
            "outputs tool), media_type image/video/audio/model, optional "
            "name and categories (array of category names — created on the "
            "fly — or ids). action 'update' renames an asset (name) and/or "
            "replaces its categories. action 'delete' removes the DB entry "
            "(the underlying file is never deleted). action 'create_category' "
            "adds an empty category. Typical flow: run_stage → wait_stage → "
            "asset_edit create with the output's payload_url so the result "
            "is reusable as @image_N references elsewhere."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {"type": "string",
                           "enum": ["create", "update", "delete",
                                    "create_category"]},
                "asset_id": {"type": "integer"},
                "name": {"type": "string"},
                "payload_url": {"type": "string"},
                "media_type": {"type": "string"},
                "categories": {"type": "array"},
            },
            "required": ["action"],
            "additionalProperties": False,
        },
        "handler": _asset_edit,
    },
    "entries": {
        "description": (
            "Read/write the project's entry library (reusable prompt "
            "snippets). Kinds: 'fragment' (plain text fragments) and "
            "'prompt' (full prompt templates; when inserted they expand, and "
            "should only @-mention media slots like @image_0 — not other "
            "entries). action 'list' (optional kind filter), 'upsert' (kind, "
            "label, content, optional metadata and id for updates — labels "
            "start with a letter/underscore, CJK fine), 'delete' (id). "
            "Entries are per-project (project_id, default 'default')."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {"type": "string",
                           "enum": ["list", "upsert", "delete"]},
                "project_id": {"type": "string"},
                "kind": {"type": "string"},
                "label": {"type": "string"},
                "content": {"type": "string"},
                "metadata": {"type": "object"},
                "id": {"type": "integer"},
            },
            "required": ["action"],
            "additionalProperties": False,
        },
        "handler": _entries,
    },
    "resources": {
        "description": (
            "List resource files available to workflows: LUTs (kind 'lut'), "
            "fonts ('font') and soundfonts ('soundfont'). Read-only — "
            "resources are files on disk that users add via the Resources "
            "panel. Useful to pick a LUT name for color workflows or a font "
            "for title/poster stages."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "kind": {"type": "string"},
            },
            "additionalProperties": False,
        },
        "handler": _resources,
    },
    "wait_stage": {
        "description": (
            "Block until a stage produces a new output or its run errors — the "
            "efficient way to wait after run_stage (no polling). Waits up to "
            "timeout_s (default 25, max 170) and returns {status: 'done', "
            "output} on success, {status: 'error', error} on failure, or "
            "{status: 'running', after_output_id} on timeout — in that case "
            "just call wait_stage again with the returned after_output_id to "
            "keep waiting (long renders can take many minutes; keep re-calling "
            "until done). If your MCP client enforces its own per-call tool "
            "timeout, pass a timeout_s safely below it (e.g. 20) and re-call "
            "instead of one long wait. node is a stage uid or graph_node_id."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {"type": "string"},
                "timeout_s": {"type": "number"},
                "after_output_id": {"type": "integer"},
                "project_id": {"type": "string"},
            },
            "required": ["node"],
            "additionalProperties": False,
        },
        "handler": _wait_stage,
    },
}
