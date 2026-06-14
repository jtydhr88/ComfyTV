from aiohttp import web

from .. import storage
from ._common import routes


@routes.get("/comfytv/projects/{pid}/outputs")
async def list_outputs(request: web.Request) -> web.Response:
    pid = request.match_info["pid"]
    stage_node_id = request.query.get("stage_node_id")
    try:
        limit = int(request.query.get("limit", "50"))
    except ValueError:
        limit = 50
    rows = storage.list_outputs(pid, stage_node_id=stage_node_id, limit=limit)
    return web.json_response({"outputs": rows})


@routes.get("/comfytv/projects/{pid}/outputs/latest")
async def get_latest_output(request: web.Request) -> web.Response:
    pid = request.match_info["pid"]
    stage_uid = request.query.get("stage_uid")
    if stage_uid:
        row = storage.latest_output_by_uid(pid, stage_uid)
        return web.json_response({"output": row})
    stage_node_id = request.query.get("stage_node_id")
    if not stage_node_id:
        return web.json_response({"error": "stage_uid or stage_node_id is required"}, status=400)
    row = storage.latest_output(pid, stage_node_id)
    return web.json_response({"output": row})


@routes.post("/comfytv/projects/{pid}/outputs/adopt")
async def adopt_outputs(request: web.Request) -> web.Response:
    pid = request.match_info["pid"]
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "invalid JSON body"}, status=400)
    stage_node_id = body.get("stage_node_id")
    stage_class = body.get("stage_class")
    stage_uid = body.get("stage_uid")
    if not (stage_node_id and stage_class and stage_uid):
        return web.json_response(
            {"error": "stage_node_id, stage_class and stage_uid are required"}, status=400
        )
    row = storage.adopt_outputs(pid, str(stage_node_id), str(stage_class), str(stage_uid))
    return web.json_response({"output": row})


@routes.post("/comfytv/outputs/{oid}/stage_uid")
async def patch_output_stage_uid(request: web.Request) -> web.Response:
    try:
        oid = int(request.match_info["oid"])
    except ValueError:
        return web.json_response({"error": "invalid output id"}, status=400)
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "invalid JSON body"}, status=400)
    stage_uid = body.get("stage_uid")
    if not stage_uid:
        return web.json_response({"error": "stage_uid is required"}, status=400)
    row = storage.set_output_stage_uid(oid, str(stage_uid))
    if row is None:
        return web.json_response({"error": "output not found"}, status=404)
    return web.json_response({"output": row})


@routes.post("/comfytv/outputs/{oid}/picked_index")
async def patch_output_picked_index(request: web.Request) -> web.Response:
    try:
        oid = int(request.match_info["oid"])
    except ValueError:
        return web.json_response({"error": "invalid output id"}, status=400)
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "invalid JSON body"}, status=400)
    picked = body.get("picked_index")
    if picked is None:
        return web.json_response({"error": "picked_index is required"}, status=400)
    try:
        picked = int(picked)
    except (TypeError, ValueError):
        return web.json_response({"error": "picked_index must be an integer"}, status=400)
    row = storage.update_output_picked_index(oid, picked)
    if row is None:
        return web.json_response({"error": "output not found"}, status=404)
    return web.json_response({"output": row})
