from aiohttp import web

from .. import storage
from ._common import routes, broadcast_entry_event


@routes.get("/comfytv/projects/{pid}/entries")
async def list_entries(request: web.Request) -> web.Response:
    pid = request.match_info["pid"]
    return web.json_response({"entries": storage.list_entries(pid)})


@routes.post("/comfytv/projects/{pid}/entries")
async def upsert_entry(request: web.Request) -> web.Response:
    pid = request.match_info["pid"]
    try:
        body = await request.json()
    except Exception as e:
        return web.json_response({"error": f"invalid json: {e}"}, status=400)
    kind = (body.get("kind") or "").strip()
    label = (body.get("label") or "").strip()
    content = body.get("content") or ""
    metadata = body.get("metadata") or {}
    entry_id = body.get("id")
    if not label:
        return web.json_response({"error": "label is required"}, status=400)
    if kind not in storage.ENTRY_KINDS:
        return web.json_response(
            {"error": f"unknown kind {kind!r}; valid: {list(storage.ENTRY_KINDS)}"},
            status=400,
        )
    row = storage.upsert_entry(
        pid, kind=kind, label=label, content=content,
        metadata=metadata if isinstance(metadata, dict) else None,
        entry_id=int(entry_id) if entry_id is not None else None,
    )
    if row is None:
        return web.json_response(
            {"error": "invalid label — must start with a letter / underscore "
                      "(Chinese / CJK / accented letters are fine), then letters / digits / _ / -"},
            status=400)
    broadcast_entry_event("upsert", pid, {"entry": row})
    return web.json_response({"ok": True, "entry": row})


@routes.delete("/comfytv/projects/{pid}/entries/{eid}")
async def delete_entry(request: web.Request) -> web.Response:
    pid = request.match_info["pid"]
    try:
        eid = int(request.match_info["eid"])
    except ValueError:
        return web.json_response({"error": "invalid entry id"}, status=400)
    if not storage.delete_entry(pid, eid):
        return web.json_response({"error": "entry not found"}, status=404)
    broadcast_entry_event("delete", pid, {"id": eid})
    return web.json_response({"ok": True})
