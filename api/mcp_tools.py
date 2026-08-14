import asyncio
import re
import time

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


async def _run_stage(args: dict) -> dict:
    node = args.get("node")
    if not node:
        raise ValueError("node is required (stage uid or graph node id)")
    payload = _command_payload(args, ("project_id",))
    payload["node"] = str(node)
    return await submit_command("run_stage", payload, timeout=60.0)


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


async def _pick_output(args: dict) -> dict:
    oid = args.get("output_id")
    idx = args.get("picked_index")
    if not isinstance(oid, int):
        raise ValueError("output_id (integer) is required")
    if not isinstance(idx, int) or idx < 0:
        raise ValueError("picked_index (non-negative integer) is required")
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

    after = args.get("after_output_id")
    if after is not None:
        baseline = int(after)
    else:
        row = storage.latest_output_by_uid(pid, uid)
        baseline = int(row["id"]) if row else 0

    t0 = time.monotonic()
    while True:
        row = storage.latest_output_by_uid(pid, uid)
        if row and int(row["id"]) > baseline:
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


_SCENE_CHANNELS = ("color", "depth", "normal", "openpose")


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
    payload.update(_command_payload(args, ("channel", "width", "height")))
    return await submit_command("scene_capture", payload, timeout=120.0)


async def _scene_record(args: dict) -> dict:
    _validate_channel(args)
    payload = _scene_target(args)
    payload.update(_command_payload(args, ("channel", "width", "height")))
    return await submit_command("scene_record", payload, timeout=300.0)


async def _previz_get(args: dict) -> dict:
    return await submit_command("previz_get", _scene_target(args))


async def _previz_edit(args: dict) -> dict:
    ops = args.get("ops")
    if not isinstance(ops, list) or not ops:
        raise ValueError("ops must be a non-empty array of operation objects")
    if not all(isinstance(op, dict) and op.get("op") for op in ops):
        raise ValueError("every op must be an object with an 'op' field")
    payload = _scene_target(args)
    payload["ops"] = ops
    return await submit_command("previz_edit", payload, timeout=30.0)


async def _previz_capture(args: dict) -> dict:
    payload = _scene_target(args)
    payload.update(_command_payload(args, ("width", "height")))
    return await submit_command("previz_capture", payload, timeout=120.0)


async def _previz_record(args: dict) -> dict:
    payload = _scene_target(args)
    payload.update(_command_payload(args, ("width", "height")))
    return await submit_command("previz_record", payload, timeout=300.0)


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
            "must be opened in the ComfyTV browser UI once before it can run "
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
            "workflows, connections, last-run status), mirrored from an open browser "
            "tab. Mirroring activates lazily on first MCP contact — right after "
            "connecting, retry once after ~10 seconds. available=false after that "
            "means no tab is open or it never reported; stale=true means the tab "
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
            "ComfyTV browser tab — the tab executes the command). node_class is a "
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
            "to nothing and the result carries a warning). node is a stage uid "
            "or graph_node_id from get_canvas. Requires an open ComfyTV tab."
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
            "removed. Requires an open ComfyTV tab."
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
            "cylinder|plane, color?, name?}, add_model {asset_id|url}, "
            "add_character {model (from resources)}, add_light {type: "
            "directional|point|spot, color?, intensity?, position?, target?}, "
            "add_camera {fov?, output?}, set_transform {id, position?, "
            "rotation_deg?|quaternion?|look_at?, scale?}, set_color, "
            "patch_light, set_animation {id, clip (an available_clips name "
            "from scene_get — required for a character/model to actually "
            "move), speed?, loop?}, rename, "
            "set_hidden, remove, set_environment {show_grid?, background?, "
            "show_room?}, set_output {fps?, frame_count?, camera_id?}, "
            "bind_camera_preset {id, preset_id (from resources — this is how "
            "you get dolly/orbit/push camera moves), speed?}, "
            "set_camera_tuning {id, reverse?, path_scale?, yaw_degrees?, ...}, "
            "set_camera_fov. All add_* ops accept position/rotation_deg/"
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
            "URLs. channel: color (default), depth, normal or openpose. Use "
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
            "and return its URL — the reference-video output. Duration comes "
            "from bound camera motion presets / character animations, or an "
            "explicit set_output frame_count; fps from set_output. Requires "
            "something recordable (bind_camera_preset, an animated character, "
            "or frame_count > 0). channel works like scene_capture (e.g. "
            "depth/openpose sequences for ControlNet-style guidance). The "
            "webm can feed VideoStage workflows (e.g. MiniMax H3 R2V) as a "
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
                "project_id": {"type": "string"},
            },
            "required": ["node"],
            "additionalProperties": False,
        },
        "handler": _scene_record,
    },
    "previz_get": {
        "description": (
            "Read a 3D Director (Previz) stage: the project (actors with "
            "kinds/poses/paths, shots with camera dolly tracks and timing, "
            "sun/ground/aspect), plus resources (actor kinds, poses, "
            "time_links, timing_modes, ground styles, aspects, joint keys, "
            "stage_limit) and busy state. The project includes per-actor "
            "world bounding boxes (actor_bounds) and overlap_warnings — use "
            "them to reason about spatial placement and fix clipping. NOTE: "
            "a fresh PrevizStage ships with demo actors (A, B, Prop) and 3 "
            "demo shots — remove what you don't need before building. "
            "Previz is a multi-SHOT blocking tool: actors move along paths "
            "synced to shot cameras — use it to author blocking+camera "
            "reference videos. ALWAYS call before previz_edit. node is the "
            "PrevizStage uid or graph_node_id."
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
        "handler": _previz_get,
    },
    "previz_edit": {
        "description": (
            "Edit a 3D Director (Previz) stage with sequential structured "
            "ops. Actors: add_actor {kind (char|horse|car|dog|tree|house|"
            "rock|bush|road|wall|pillar|prop|mount), pos [x,z], rot_y?, "
            "scale?, pose?, time_link?, mount?} -> returns its label; "
            "update_actor/remove_actor {label}; set_actor_track {label, "
            "points [[x,z],...], straight?} lays an explicit movement path "
            "(actor walks/drives along it over the scene); set_actor_joint "
            "{label, key, value} poses char joints; clear_actor_track, "
            "set_actor_straight, set_actor_path_time. Shots: add_shot "
            "{name?, dur?, fov?} -> index; update_shot {index, dur?, fov?, "
            "lock (actor label to aim at, or ''), timing_mode?, "
            "sync_actor?, yaw?, pitch?}; set_shot_track {index, points "
            "[[x,y,z],...], straight?} lays the camera dolly path (y = "
            "camera height 0.2-30); set_cam_point_y, set_cam_key {shot, "
            "index, yaw?, pitch?, fov?}, set_cam_time, set_shot_straight, "
            "select_shot, remove_shot. Environment: set_sun {pos [x,y,z]?, "
            "intensity?, temp?, ambient?}, set_ground {style, color?}, "
            "set_aspect, set_collision, set_labels. Positions are meters, "
            "stage is ±29.5. Ops apply sequentially (an error stops the "
            "batch; earlier ops stay). The result includes warnings when "
            "actor bounding boxes overlap significantly — resolve them by "
            "moving actors before capturing. Verify with previz_capture "
            "after editing. Set shot lock to an actor label to keep the "
            "camera aimed at it while it moves."
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
        "handler": _previz_edit,
    },
    "previz_capture": {
        "description": (
            "Render the Previz stage to still image(s): the current time "
            "plus, with multiple shots, the first frame of every shot — "
            "returned as URLs. Use after every previz_edit to visually "
            "verify blocking and framing before recording."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {"type": "string"},
                "width": {"type": "integer", "minimum": 64, "maximum": 4096},
                "height": {"type": "integer", "minimum": 64, "maximum": 4096},
                "project_id": {"type": "string"},
            },
            "required": ["node"],
            "additionalProperties": False,
        },
        "handler": _previz_capture,
    },
    "previz_record": {
        "description": (
            "Record the whole Previz timeline (all shots back-to-back, "
            "actors moving along their paths, cameras riding their dolly "
            "tracks) into a webm and return its URL — a blocking+camera "
            "reference video for driving video models (e.g. MiniMax H3 R2V "
            "via a video asset ref). Duration = sum of shot durations."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {"type": "string"},
                "width": {"type": "integer", "minimum": 64, "maximum": 4096},
                "height": {"type": "integer", "minimum": 64, "maximum": 4096},
                "project_id": {"type": "string"},
            },
            "required": ["node"],
            "additionalProperties": False,
        },
        "handler": _previz_record,
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
            "free type-compatible input. Requires an open ComfyTV tab."
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
            "stage uid or graph_node_id. Requires an open ComfyTV tab."
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
    "pick_output": {
        "description": (
            "Choose which candidate of a multi-image output downstream "
            "stages consume (sets picked_index on an output row from the "
            "outputs tool; 0-based index into its payload images). Use "
            "after inspecting candidates with media_frame or the output's "
            "payload_json image URLs."
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
    "cancel_stage": {
        "description": (
            "Stop a stage's in-flight run (local runs interrupt the ComfyUI "
            "queue; remote runs cancel the remote job) — use when a render "
            "is clearly wrong or stuck instead of waiting it out. node is a "
            "stage uid or graph node id; errors if the stage is not "
            "running. Requires an open ComfyTV tab."
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
            "graph node id. Requires an open ComfyTV tab."
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
            "come from list_workflows. Server-side — no open tab needed."
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
            "Server-side — no open tab needed."
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
