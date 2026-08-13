import time

from aiohttp import web

from ._common import routes

STALE_AFTER_S = 30.0

_mirrors: dict[str, dict] = {}


def store_canvas_state(project_id: str, stages: list[dict],
                       client_id: str | None = None) -> None:
    _mirrors[project_id] = {
        "project_id": project_id,
        "client_id": client_id,
        "stages": stages,
        "received_at": time.time(),
    }


def touch_canvas_state(project_id: str) -> bool:
    entry = _mirrors.get(project_id)
    if entry is None:
        return False
    entry["received_at"] = time.time()
    return True


def get_canvas_state(project_id: str | None = None) -> dict:
    if project_id is None:
        if len(_mirrors) == 1:
            project_id = next(iter(_mirrors))
        else:
            return {
                "available": False,
                "reason": "no canvas snapshot yet" if not _mirrors
                          else "multiple projects mirrored — pass project_id",
                "mirrored_project_ids": sorted(_mirrors),
            }
    entry = _mirrors.get(project_id)
    if entry is None:
        return {
            "available": False,
            "reason": f"no canvas snapshot for project {project_id!r} — "
                      "is the ComfyTV page open in a browser?",
            "mirrored_project_ids": sorted(_mirrors),
        }
    age = time.time() - entry["received_at"]
    return {
        "available": True,
        "project_id": project_id,
        "stale": age > STALE_AFTER_S,
        "age_seconds": round(age, 1),
        "stages": entry["stages"],
    }


def get_mirror_client_id(project_id: str | None = None) -> str | None:
    if project_id is None:
        if len(_mirrors) != 1:
            return None
        project_id = next(iter(_mirrors))
    entry = _mirrors.get(project_id)
    if entry is None:
        return None
    if time.time() - entry["received_at"] > STALE_AFTER_S:
        return None
    return entry.get("client_id") or None


def mirror_summary() -> list[dict]:
    now = time.time()
    return [
        {
            "project_id": pid,
            "stale": now - entry["received_at"] > STALE_AFTER_S,
            "age_seconds": round(now - entry["received_at"], 1),
            "stage_count": len(entry["stages"]),
        }
        for pid, entry in sorted(_mirrors.items())
    ]


def clear_canvas_state() -> None:
    _mirrors.clear()


@routes.post("/comfytv/canvas_state")
async def post_canvas_state(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception as e:
        return web.json_response({"error": f"invalid json: {e}"}, status=400)
    project_id = (body.get("project_id") or "").strip()
    if not project_id:
        return web.json_response({"error": "project_id required"}, status=400)

    if body.get("heartbeat") is True:
        if not touch_canvas_state(project_id):
            return web.json_response({"error": "no snapshot to refresh"}, status=404)
        return web.json_response({"ok": True})

    stages = body.get("stages")
    if not isinstance(stages, list):
        return web.json_response({"error": "stages must be a list"}, status=400)
    client_id = body.get("client_id")
    store_canvas_state(project_id, stages,
                       client_id=str(client_id) if client_id else None)
    return web.json_response({"ok": True})


@routes.get("/comfytv/canvas_state")
async def read_canvas_state(request: web.Request) -> web.Response:
    project_id = request.query.get("project_id") or None
    return web.json_response(get_canvas_state(project_id))
