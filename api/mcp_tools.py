from .. import storage
from ..runners import WORKFLOW_KINDS, workflow_db
from ..runners.exec_errors import list_exec_errors
from .assets import _with_file_missing
from .canvas_state import get_canvas_state, mirror_summary
from .capabilities import VERSION
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
        "readonly": True,
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
}
