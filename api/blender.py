from aiohttp import web

from ..runners import blender
from ._common import routes


@routes.get("/comfytv/blender/status")
async def blender_status(request: web.Request) -> web.Response:
    status = await blender.probe(fresh=request.query.get("fresh") == "1")
    return web.json_response(status)


@routes.get("/comfytv/blender/cameras")
async def blender_cameras(request: web.Request) -> web.Response:
    try:
        return web.json_response(await blender.list_cameras())
    except blender.BlenderUnavailable:
        return web.json_response({"error": "blender offline"}, status=503)


@routes.post("/comfytv/blender/scene/add")
async def blender_scene_add(request: web.Request) -> web.Response:
    body = await request.json()
    payload_url = str(body.get("payload_url") or "")
    if not payload_url:
        return web.json_response({"error": "payload_url required"}, status=400)
    try:
        return web.json_response(await blender.add_to_scene(payload_url))
    except blender.BlenderUnavailable:
        return web.json_response({"error": "blender offline"}, status=503)
