from aiohttp import web

from .. import storage
from ._common import routes, broadcast_stage_param_event


@routes.get("/comfytv/stage_params")
async def list_stage_params(request: web.Request) -> web.Response:
    kind = request.query.get("kind") or None
    return web.json_response({"params": storage.list_stage_params(kind)})


@routes.post("/comfytv/stage_params")
async def create_stage_param(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception as e:
        return web.json_response({"error": f"invalid json: {e}"}, status=400)

    kind = (body.get("kind") or "").strip()
    label = (body.get("label") or "").strip()
    type_ = (body.get("type") or "").strip()
    if not kind:
        return web.json_response({"error": "kind is required"}, status=400)
    if not label:
        return web.json_response({"error": "label is required"}, status=400)
    if type_ not in storage.STAGE_PARAM_TYPES:
        return web.json_response(
            {"error": f"unknown type {type_!r}; valid: {list(storage.STAGE_PARAM_TYPES)}"},
            status=400,
        )
    config = body.get("config")
    row = storage.create_stage_param(
        kind=kind,
        label=label,
        type=type_,
        default=body.get("default"),
        config=config if isinstance(config, dict) else None,
    )
    if row is None:
        return web.json_response({"error": "could not create stage param"}, status=400)
    broadcast_stage_param_event("create", {"param": row})
    return web.json_response({"ok": True, "param": row})


@routes.patch("/comfytv/stage_params/{pid}")
async def update_stage_param(request: web.Request) -> web.Response:
    try:
        pid = int(request.match_info["pid"])
    except ValueError:
        return web.json_response({"error": "invalid param id"}, status=400)
    try:
        body = await request.json()
    except Exception as e:
        return web.json_response({"error": f"invalid json: {e}"}, status=400)

    type_ = body.get("type")
    if type_ is not None and type_ not in storage.STAGE_PARAM_TYPES:
        return web.json_response({"error": f"unknown type {type_!r}"}, status=400)

    kwargs: dict = {}
    if body.get("label") is not None:
        kwargs["label"] = str(body["label"])
    if type_ is not None:
        kwargs["type"] = type_
    if "default" in body:
        kwargs["default"] = body["default"]
    if "config" in body:
        cfg = body.get("config")
        kwargs["config"] = cfg if isinstance(cfg, dict) else None
    if body.get("order") is not None:
        kwargs["order"] = int(body["order"])

    row = storage.update_stage_param(pid, **kwargs)
    if row is None:
        return web.json_response({"error": "param not found or read-only"}, status=404)
    broadcast_stage_param_event("update", {"param": row})
    return web.json_response({"ok": True, "param": row})


@routes.delete("/comfytv/stage_params/{pid}")
async def delete_stage_param(request: web.Request) -> web.Response:
    try:
        pid = int(request.match_info["pid"])
    except ValueError:
        return web.json_response({"error": "invalid param id"}, status=400)
    if not storage.delete_stage_param(pid):
        return web.json_response({"error": "param not found or read-only"}, status=404)
    broadcast_stage_param_event("delete", {"id": pid})
    return web.json_response({"ok": True})
