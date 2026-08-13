from .. import storage
from ..nodes.stages import STAGE_META
from ..runners import WORKFLOW_KINDS, workflow_db
from ..runners.exec_errors import list_exec_errors
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
            "in the same call. Returns the new node's graph_node_id and uid. "
            "Placement is automatic unless pos [x, y] is given."
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
            "@audio_N in the prompt; pass [] to clear). node is a stage uid "
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
            "Returns as soon as the run is queued — poll get_canvas (status "
            "'running') and outputs/exec_errors for completion. node is a stage "
            "uid or graph_node_id. Requires an open ComfyTV tab."
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
}
