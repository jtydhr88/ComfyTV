import asyncio
import inspect
import json
import logging
import uuid

import aiohttp
from aiohttp import web

from server import PromptServer

from .. import storage
from ..runners.remote_comfy import CURRENT_JOB, JobCancelled, RemoteJobHandle
from ._common import routes


_log = logging.getLogger(__name__)

_TEST_TIMEOUT_S = 5
_STATUS_TIMEOUT_S = 4

ACTIVE_JOBS: dict[str, RemoteJobHandle] = {}


@routes.get("/comfytv/servers")
async def list_servers(request: web.Request) -> web.Response:
    return web.json_response({"servers": storage.list_servers()})


@routes.post("/comfytv/servers")
async def create_server(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "invalid JSON body"}, status=400)
    label = str(body.get("label") or "").strip()
    host = str(body.get("host") or "").strip()
    try:
        port = int(body.get("port") or 8188)
    except (TypeError, ValueError):
        return web.json_response({"error": "port must be an integer"}, status=400)
    if not label or not host:
        return web.json_response({"error": "label and host are required"}, status=400)
    row = storage.create_server(label=label, host=host, port=port)
    if row is None:
        return web.json_response({"error": "label already in use"}, status=409)
    return web.json_response({"server": row})


@routes.patch("/comfytv/servers/{sid}")
async def update_server(request: web.Request) -> web.Response:
    try:
        sid = int(request.match_info["sid"])
    except ValueError:
        return web.json_response({"error": "invalid server id"}, status=400)
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "invalid JSON body"}, status=400)
    port = body.get("port")
    if port is not None:
        try:
            port = int(port)
        except (TypeError, ValueError):
            return web.json_response({"error": "port must be an integer"}, status=400)
    row = storage.update_server(
        sid,
        label=body.get("label"),
        host=body.get("host"),
        port=port,
        enabled=body.get("enabled"),
    )
    if row is None:
        return web.json_response(
            {"error": "server not found or label already in use"}, status=404
        )
    return web.json_response({"server": row})


@routes.delete("/comfytv/servers/{sid}")
async def delete_server(request: web.Request) -> web.Response:
    try:
        sid = int(request.match_info["sid"])
    except ValueError:
        return web.json_response({"error": "invalid server id"}, status=400)
    ok = storage.delete_server(sid)
    if not ok:
        return web.json_response({"error": "server not found"}, status=404)
    return web.json_response({"ok": True})


@routes.post("/comfytv/servers/test")
async def test_server(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "invalid JSON body"}, status=400)
    host = str(body.get("host") or "").strip()
    try:
        port = int(body.get("port") or 8188)
    except (TypeError, ValueError):
        return web.json_response({"error": "port must be an integer"}, status=400)
    if not host:
        return web.json_response({"error": "host is required"}, status=400)

    url = f"http://{host}:{port}/system_stats"
    try:
        timeout = aiohttp.ClientTimeout(total=_TEST_TIMEOUT_S)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url) as resp:
                if resp.status != 200:
                    return web.json_response({
                        "ok": False,
                        "error": f"HTTP {resp.status} from /system_stats",
                    })
                stats = await resp.json()
    except (aiohttp.ClientError, asyncio.TimeoutError, ValueError) as e:
        return web.json_response({"ok": False, "error": str(e) or type(e).__name__})

    system = stats.get("system") or {}
    devices = stats.get("devices") or []
    return web.json_response({
        "ok": True,
        "version": system.get("comfyui_version") or "",
        "os": system.get("os") or "",
        "devices": [d.get("name", "") for d in devices if isinstance(d, dict)],
    })


async def _fetch_server_queue(session: aiohttp.ClientSession, server: dict) -> dict:
    sid = server["id"]
    url = f"http://{server['host']}:{server['port']}/queue"
    try:
        async with session.get(url) as resp:
            if resp.status != 200:
                return {"id": sid, "online": False, "running": 0,
                        "pending": 0, "error": f"HTTP {resp.status}"}
            data = await resp.json()
    except (aiohttp.ClientError, asyncio.TimeoutError, ValueError) as e:
        return {"id": sid, "online": False, "running": 0,
                "pending": 0, "error": str(e) or type(e).__name__}
    running = data.get("queue_running")
    pending = data.get("queue_pending")
    return {
        "id": sid,
        "online": True,
        "running": len(running) if isinstance(running, list) else 0,
        "pending": len(pending) if isinstance(pending, list) else 0,
    }


def _active_jobs_by_server() -> dict[int, int]:
    tally: dict[int, int] = {}
    try:
        for status in ("queued", "running"):
            for job in storage.list_remote_jobs(status=status):
                sid = job.get("server_id")
                if sid is not None and job["id"] in ACTIVE_JOBS:
                    tally[int(sid)] = tally.get(int(sid), 0) + 1
    except Exception:
        _log.exception("[ComfyTV/servers] active-job tally failed")
    return tally


@routes.get("/comfytv/servers/status")
async def servers_status(request: web.Request) -> web.Response:
    servers = [s for s in storage.list_servers() if s.get("enabled", True)]
    active = _active_jobs_by_server()

    statuses: list[dict] = []
    if servers:
        timeout = aiohttp.ClientTimeout(total=_STATUS_TIMEOUT_S)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            results = await asyncio.gather(
                *(_fetch_server_queue(session, s) for s in servers)
            )
        for st in results:
            st["jobs"] = active.get(st["id"], 0)
            statuses.append(st)
    return web.json_response({"statuses": statuses})


_STAGE_CLASSES: dict[str, type] | None = None


async def _stage_class_map() -> dict[str, type]:
    global _STAGE_CLASSES
    if _STAGE_CLASSES is None:
        from ..nodes.stages import ComfyTVExtension
        mapping: dict[str, type] = {}
        for cls in await ComfyTVExtension().get_node_list():
            try:
                mapping[cls.GET_SCHEMA().node_id] = cls
            except Exception as e:
                _log.warning("[ComfyTV/servers] schema read failed for %s: %s",
                             getattr(cls, "__name__", cls), e)
        _STAGE_CLASSES = mapping
    return _STAGE_CLASSES


def _autogrow_names(inp) -> list[str] | None:
    template = getattr(inp, "template", None)
    names = getattr(template, "names", None)
    if isinstance(names, (list, tuple)) and names:
        return [str(n) for n in names]
    return None


def build_execute_kwargs(stage_cls, prompt_inputs: dict) -> dict:
    schema = stage_cls.define_schema()
    kwargs: dict = {}
    known: set[str] = set()
    for inp in getattr(schema, "inputs", None) or []:
        inp_id = getattr(inp, "id", None)
        if not inp_id:
            continue
        known.add(inp_id)
        names = _autogrow_names(inp)
        if names is not None:
            group: dict = {}
            for name in names:
                known.add(name)
                if name in prompt_inputs and prompt_inputs[name] is not None:
                    group[name] = prompt_inputs[name]
            kwargs[inp_id] = group
        elif inp_id in prompt_inputs:
            kwargs[inp_id] = prompt_inputs[inp_id]

    dropped = set(prompt_inputs) - known
    if dropped:
        _log.warning("[ComfyTV/servers] dropping unknown inputs for %s: %s",
                     stage_cls.__name__, sorted(dropped))
    return kwargs


def _inject_server(kwargs: dict, server_id: int) -> None:
    raw = kwargs.get("custom_params") or "{}"
    try:
        data = json.loads(raw) if isinstance(raw, str) else dict(raw or {})
    except (ValueError, TypeError):
        data = {}
    if not isinstance(data, dict):
        data = {}
    items = [it for it in (data.get("items") or [])
             if isinstance(it, dict) and it.get("key") != "__server"]
    items.append({"key": "__server", "value": int(server_id)})
    data["items"] = items
    kwargs["custom_params"] = json.dumps(data)


def _broadcast_job(job_id: str, node_id: str, project_id: str, status: str,
                   *, ui: dict | None = None, error: str = "") -> None:
    try:
        PromptServer.instance.send_sync("comfytv-remote-job", {
            "job_id": job_id,
            "node_id": str(node_id),
            "project_id": project_id,
            "status": status,
            "ui": ui or {},
            "error": error,
        })
    except Exception:
        _log.exception("[ComfyTV/servers] job broadcast failed")


async def _run_job(job_id: str, handle: RemoteJobHandle, stage_cls, kwargs: dict,
                   node_id: str, project_id: str) -> None:
    from comfy_api.latest._io import Hidden, HiddenHolder

    token = CURRENT_JOB.set(handle)
    storage.update_remote_job(job_id, status="running")
    try:
        clone = stage_cls.PREPARE_CLASS_CLONE(None)
        clone.hidden = HiddenHolder.from_dict({Hidden.unique_id: str(node_id)})
        output = await clone.EXECUTE_NORMALIZED_ASYNC(**kwargs)
        ui = dict(getattr(output, "ui", None) or {})
        output_id = None
        oid = ui.get("output_id")
        if isinstance(oid, list) and oid:
            output_id = oid[0]
        storage.update_remote_job(
            job_id, status="done",
            remote_prompt_id=handle.remote_prompt_id,
            output_id=output_id,
        )
        _broadcast_job(job_id, node_id, project_id, "done", ui=ui)
    except JobCancelled as e:
        storage.update_remote_job(
            job_id, status="cancelled",
            remote_prompt_id=handle.remote_prompt_id,
            error_text=str(e),
        )
        _broadcast_job(job_id, node_id, project_id, "cancelled", error=str(e))
    except Exception as e:
        _log.exception("[ComfyTV/servers] remote job %s failed", job_id)
        storage.update_remote_job(
            job_id, status="error",
            remote_prompt_id=handle.remote_prompt_id,
            error_text=str(e),
        )
        _broadcast_job(job_id, node_id, project_id, "error", error=str(e))
    finally:
        CURRENT_JOB.reset(token)
        ACTIVE_JOBS.pop(job_id, None)


@routes.post("/comfytv/remote_run")
async def remote_run(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "invalid JSON body"}, status=400)

    try:
        server_id = int(body.get("server_id"))
    except (TypeError, ValueError):
        return web.json_response({"error": "server_id is required"}, status=400)
    server = storage.get_server(server_id)
    if server is None:
        return web.json_response({"error": "server not found"}, status=404)
    if not server.get("enabled", True):
        return web.json_response({"error": "server is disabled"}, status=400)

    prompt = body.get("prompt") or {}
    target = str(body.get("target_node_id") or "")
    project_id = str(body.get("project_id") or "")
    stage_uid = body.get("stage_uid")
    entry = prompt.get(target)
    if not isinstance(entry, dict):
        return web.json_response(
            {"error": f"target node {target!r} not in prompt"}, status=400)

    class_type = str(entry.get("class_type") or "")
    stage_cls = (await _stage_class_map()).get(class_type)
    if stage_cls is None:
        return web.json_response(
            {"error": f"{class_type!r} is not a remotable ComfyTV stage"},
            status=400)
    if not inspect.iscoroutinefunction(stage_cls.execute):
        return web.json_response(
            {"error": f"{class_type!r} can't run out of queue (sync execute)"},
            status=400)

    inputs = dict(entry.get("inputs") or {})
    dangling = sorted(
        k for k, v in inputs.items()
        if isinstance(v, list) and len(v) == 2
    )
    if dangling:
        return web.json_response({
            "error": "upstream_not_ready",
            "inputs": dangling,
        }, status=409)

    kwargs = build_execute_kwargs(stage_cls, inputs)
    _inject_server(kwargs, server_id)

    job_id = uuid.uuid4().hex
    handle = RemoteJobHandle(job_id, target)
    storage.create_remote_job(
        job_id=job_id,
        server_id=server_id,
        server_label=server["label"],
        project_id=project_id,
        stage_node_id=target,
        stage_uid=str(stage_uid) if stage_uid else None,
    )
    ACTIVE_JOBS[job_id] = handle
    asyncio.create_task(
        _run_job(job_id, handle, stage_cls, kwargs, target, project_id),
        name=f"comfytv-remote-{job_id[:8]}",
    )
    _log.info("[ComfyTV/servers] remote job %s: %s node %s -> %s",
              job_id[:8], class_type, target, server["label"])
    return web.json_response({"job_id": job_id})


@routes.get("/comfytv/remote_jobs")
async def list_remote_jobs(request: web.Request) -> web.Response:
    status = request.query.get("status")
    jobs = storage.list_remote_jobs(status=status or None)
    if status in ("queued", "running"):
        jobs = [j for j in jobs if j["id"] in ACTIVE_JOBS]
    return web.json_response({"jobs": jobs})


@routes.post("/comfytv/remote_jobs/{jid}/cancel")
async def cancel_remote_job(request: web.Request) -> web.Response:
    jid = request.match_info["jid"]
    handle = ACTIVE_JOBS.get(jid)
    if handle is None:
        job = storage.get_remote_job(jid)
        if job is None:
            return web.json_response({"error": "job not found"}, status=404)
        if job["status"] in ("queued", "running"):
            storage.update_remote_job(jid, status="cancelled",
                                      error_text="orphaned by restart")
        return web.json_response({"ok": True, "job": storage.get_remote_job(jid)})
    handle.cancel_event.set()
    return web.json_response({"ok": True})


def _reap_stale_jobs() -> None:
    try:
        for status in ("queued", "running"):
            for job in storage.list_remote_jobs(status=status):
                storage.update_remote_job(
                    job["id"], status="error",
                    error_text="interrupted by ComfyUI restart",
                )
    except Exception:
        _log.exception("[ComfyTV/servers] stale job reap failed")


_reap_stale_jobs()
