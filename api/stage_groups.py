import base64
import binascii
import urllib.parse
import uuid
from pathlib import Path

import folder_paths
from aiohttp import web

from .. import storage
from ._common import routes

THUMB_SUBFOLDER = "comfytv/system/stage_groups"
PNG_DATA_URL = "data:image/png;base64,"


def _save_thumbnail(name: str, data_url) -> int | None:
    if not isinstance(data_url, str) or not data_url.startswith(PNG_DATA_URL):
        return None
    try:
        raw = base64.b64decode(data_url[len(PNG_DATA_URL):], validate=True)
    except binascii.Error:
        return None
    folder = Path(folder_paths.get_input_directory()) / THUMB_SUBFOLDER
    folder.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.png"
    (folder / filename).write_bytes(raw)
    url = "/view?" + urllib.parse.urlencode({"filename": filename, "subfolder": THUMB_SUBFOLDER, "type": "input"})
    asset = storage.create_asset(
        name=name, payload_url=url, media_type="image", mime_type="image/png",
        size_bytes=len(raw), source="stage_group", is_hidden=True,
    )
    return asset["id"]


def _group_id(request: web.Request) -> int | None:
    try:
        return int(request.match_info["gid"])
    except ValueError:
        return None


@routes.get("/comfytv/stage_groups")
async def list_stage_groups(request: web.Request) -> web.Response:
    return web.json_response({"groups": storage.list_stage_groups()})


@routes.post("/comfytv/stage_groups")
async def create_stage_group(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception as e:
        return web.json_response({"error": f"invalid json: {e}"}, status=400)
    name = (body.get("name") or "").strip()
    data = body.get("data")
    if not name:
        return web.json_response({"error": "name is required"}, status=400)
    if not isinstance(data, dict) or not isinstance(data.get("nodes"), list) or not data["nodes"]:
        return web.json_response({"error": "data must hold at least one node"}, status=400)
    thumb_id = _save_thumbnail(name, body.get("thumbnail"))
    return web.json_response({"ok": True, "group": storage.save_stage_group(name, data, thumb_id)})


@routes.patch("/comfytv/stage_groups/{gid}")
async def rename_stage_group(request: web.Request) -> web.Response:
    gid = _group_id(request)
    try:
        body = await request.json()
    except Exception as e:
        return web.json_response({"error": f"invalid json: {e}"}, status=400)
    name = body.get("name")
    if not isinstance(name, str) or not name.strip():
        return web.json_response({"error": "name is required"}, status=400)
    row = storage.rename_stage_group(gid, name.strip()) if gid is not None else None
    if row is None:
        return web.json_response({"error": "group not found or name taken"}, status=404)
    return web.json_response({"ok": True, "group": row})


@routes.delete("/comfytv/stage_groups/{gid}")
async def delete_stage_group(request: web.Request) -> web.Response:
    gid = _group_id(request)
    if gid is None or not storage.delete_stage_group(gid):
        return web.json_response({"error": "group not found"}, status=404)
    return web.json_response({"ok": True})
