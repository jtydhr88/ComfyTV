import asyncio
import time
from ... import storage
from ...runners import WORKFLOW_KINDS
from ...runners import workflow_db
from ...runners.exec_errors import list_exec_errors
from ..canvas_state import mirror_summary
from ..capabilities import VERSION
from ..stages import stages_payload
from ..stages import workflow_info_payload

from ._shared import _no_args_schema


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

async def _servers(_args: dict) -> dict:
    from ..servers import _active_jobs_by_server, _fetch_server_queue
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

_RESOURCE_KINDS = ("lut", "font", "soundfont")

async def _resources(args: dict) -> dict:
    kind = args.get("kind")
    if kind is not None and kind not in _RESOURCE_KINDS:
        raise ValueError(
            f"unknown kind {kind!r}; valid: {', '.join(_RESOURCE_KINDS)}")
    return {"resources": storage.list_resources(kind),
            "kinds": list(_RESOURCE_KINDS)}


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
            "has_api=false means the workflow has no pre-converted API JSON yet "
            "(it is converted server-side automatically on first run); "
            "file_exists/gui_valid flag broken files."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"kind": {"type": "string"}},
            "additionalProperties": False,
        },
        "handler": _list_workflows,
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
}
