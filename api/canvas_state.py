import time

from aiohttp import web

from ._common import routes

STALE_AFTER_S = 30.0

_mirrors: dict[str, dict] = {}


def store_canvas_state(project_id: str, stages: list[dict],
                       client_id: str | None = None,
                       ws_connected: bool | None = None,
                       page_active: bool | None = None) -> str:
    current = _mirrors.get(project_id)
    if (page_active is False and current is not None
            and current.get("client_id") and client_id
            and current.get("client_id") != client_id
            and time.time() - current["received_at"] <= STALE_AFTER_S):
        return "owned_by_other"
    _mirrors[project_id] = {
        "project_id": project_id,
        "client_id": client_id,
        "ws_connected": ws_connected,
        "page_active": page_active,
        "stages": stages,
        "received_at": time.time(),
    }
    return "ok"


def touch_canvas_state(project_id: str, client_id: str | None = None,
                       ws_connected: bool | None = None,
                       page_active: bool | None = None) -> str:
    entry = _mirrors.get(project_id)
    if entry is None:
        return "missing"
    owner = entry.get("client_id")
    if owner and client_id and owner != client_id:
        if (entry.get("page_active") is False
                or time.time() - entry["received_at"] > STALE_AFTER_S):
            return "stale_owner"
        return "owned_by_other"
    entry["received_at"] = time.time()
    if ws_connected is not None:
        entry["ws_connected"] = ws_connected
    if page_active is not None:
        entry["page_active"] = page_active
    return "ok"


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
                      "is the ComfyTV page open in Desktop or a browser?",
            "mirrored_project_ids": sorted(_mirrors),
        }
    age = time.time() - entry["received_at"]
    out = {
        "available": True,
        "project_id": project_id,
        "stale": age > STALE_AFTER_S,
        "age_seconds": round(age, 1),
        "stages": entry["stages"],
    }
    if entry.get("ws_connected") is not None:
        out["tab_ws_connected"] = entry["ws_connected"]
    if entry.get("page_active") is not None:
        out["tab_page_active"] = entry["page_active"]
    return out


def get_mirror_entry(project_id: str | None = None) -> dict | None:
    if project_id is None:
        if len(_mirrors) != 1:
            return None
        project_id = next(iter(_mirrors))
    return _mirrors.get(project_id)


def get_mirror_client_id(project_id: str | None = None) -> str | None:
    entry = get_mirror_entry(project_id)
    if entry is None:
        return None
    if time.time() - entry["received_at"] > STALE_AFTER_S:
        return None
    return entry.get("client_id") or None


def mirror_summary() -> list[dict]:
    now = time.time()
    out = []
    for pid, entry in sorted(_mirrors.items()):
        row = {
            "project_id": pid,
            "stale": now - entry["received_at"] > STALE_AFTER_S,
            "age_seconds": round(now - entry["received_at"], 1),
            "stage_count": len(entry["stages"]),
        }
        if entry.get("ws_connected") is not None:
            row["tab_ws_connected"] = entry["ws_connected"]
        if entry.get("page_active") is not None:
            row["tab_page_active"] = entry["page_active"]
        out.append(row)
    return out


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
    client_id = body.get("client_id")
    ws_connected = body.get("ws_connected")
    if not isinstance(ws_connected, bool):
        ws_connected = None
    page_active = body.get("page_active")
    if not isinstance(page_active, bool):
        page_active = None

    if body.get("heartbeat") is True:
        outcome = touch_canvas_state(
            project_id, client_id=str(client_id) if client_id else None,
            ws_connected=ws_connected, page_active=page_active)
        if outcome == "ok":
            return web.json_response({"ok": True})
        if outcome == "owned_by_other":
            return web.json_response(
                {"error": "another tab owns this project's mirror"}, status=409)
        return web.json_response({"error": "no snapshot to refresh"}, status=404)

    stages = body.get("stages")
    if not isinstance(stages, list):
        return web.json_response({"error": "stages must be a list"}, status=400)
    outcome = store_canvas_state(
        project_id, stages,
        client_id=str(client_id) if client_id else None,
        ws_connected=ws_connected, page_active=page_active)
    if outcome == "owned_by_other":
        return web.json_response(
            {"error": "another active tab owns this project's mirror"},
            status=409)
    return web.json_response({"ok": True})


@routes.get("/comfytv/canvas_state")
async def read_canvas_state(request: web.Request) -> web.Response:
    project_id = request.query.get("project_id") or None
    return web.json_response(get_canvas_state(project_id))
