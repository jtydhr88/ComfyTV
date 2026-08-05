import asyncio

from aiohttp import web

from .. import backup, storage
from ._common import routes


@routes.get("/comfytv/settings")
async def list_settings(request: web.Request) -> web.Response:
    return web.json_response({"settings": storage.list_settings()})


@routes.put("/comfytv/settings")
async def update_settings(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception as e:
        return web.json_response({"error": f"invalid json: {e}"}, status=400)
    values = body.get("values")
    if not isinstance(values, dict) or not values:
        return web.json_response({"error": "values must be a non-empty object"}, status=400)
    try:
        rows = storage.set_settings(values)
    except KeyError as e:
        return web.json_response({"error": f"unknown setting(s): {e}"}, status=400)
    return web.json_response({"ok": True, "settings": rows})


@routes.post("/comfytv/settings/backup")
async def run_backup_now(request: web.Request) -> web.Response:
    result = await asyncio.to_thread(backup.run_backup)
    status = 200 if result.get("ok") else 500
    return web.json_response(result, status=status)
