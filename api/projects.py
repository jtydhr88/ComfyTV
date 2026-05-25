from aiohttp import web

from .. import storage
from ._common import routes


@routes.get("/comfytv/projects")
async def list_projects(_request: web.Request) -> web.Response:
    storage.ensure_default_project()
    return web.json_response({"projects": storage.list_projects()})


@routes.post("/comfytv/projects")
async def create_project(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception:
        body = {}
    name = (body.get("name") or "").strip() or "Untitled"
    proj = storage.create_project(name)
    return web.json_response({"ok": True, "project": proj})


@routes.get("/comfytv/projects/{pid}")
async def get_project(request: web.Request) -> web.Response:
    pid = request.match_info["pid"]
    proj = storage.get_project(pid)
    if proj is None:
        return web.json_response({"error": "project not found"}, status=404)
    return web.json_response({"project": proj})


@routes.patch("/comfytv/projects/{pid}")
async def patch_project(request: web.Request) -> web.Response:
    pid = request.match_info["pid"]
    try:
        body = await request.json()
    except Exception as e:
        return web.json_response({"error": f"invalid json: {e}"}, status=400)
    if "name" in body:
        proj = storage.rename_project(pid, body["name"])
        if proj is None:
            return web.json_response({"error": "project not found"}, status=404)
        return web.json_response({"ok": True, "project": proj})
    return web.json_response({"error": "no patchable fields"}, status=400)


@routes.delete("/comfytv/projects/{pid}")
async def delete_project(request: web.Request) -> web.Response:
    pid = request.match_info["pid"]
    if not storage.delete_project(pid):
        return web.json_response({"error": "project not found or undeletable"}, status=400)
    return web.json_response({"ok": True})
