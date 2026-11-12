import asyncio
import ipaddress

from aiohttp import web

from .. import backup, storage
from ..settings import coerce
from ._common import routes

LOCAL_ONLY = ("enable-mcp", "enable-bot", "bot-enable-comfy-mcp", "bot-comfy-mcp-command", "bot-hermes-ssh-host")


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
    if values.get("enable-mcp") is False:
        values = {**values, "enable-bot": False}
    if values.get("enable-bot") is True:
        mcp_on = values.get("enable-mcp")
        if mcp_on is None:
            try:
                mcp_on = storage.get_setting("enable-mcp")
            except KeyError:
                mcp_on = False
        if not mcp_on:
            return web.json_response(
                {"error": "enable-bot requires enable-mcp"}, status=400)
    if not ipaddress.ip_address(request.remote).is_loopback:
        blocked = [k for k in LOCAL_ONLY if k in values and coerce(k, values[k]) != storage.get_setting(k)]
        if blocked:
            return web.json_response(
                {"error": f"{', '.join(blocked)} can only be changed from the machine running ComfyUI"}, status=403)
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
