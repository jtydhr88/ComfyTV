import json
import re

from aiohttp import web

from ..runners import workflow_db
from ._common import routes


@routes.get("/comfytv/workflows/state")
async def workflow_state(request: web.Request) -> web.Response:
    kind  = request.query.get("kind") or ""
    label = request.query.get("label") or ""
    if not kind or not label:
        return web.json_response({"error": "kind and label required"}, status=400)
    state = workflow_db.get_workflow_state(kind, label)
    if state is None:
        return web.json_response({"error": "workflow not found"}, status=404)
    return web.json_response(state)


@routes.get("/comfytv/workflows/file")
async def workflow_file(request: web.Request) -> web.Response:
    kind  = request.query.get("kind") or ""
    label = request.query.get("label") or ""
    if not kind or not label:
        return web.json_response({"error": "kind and label required"}, status=400)
    pair = workflow_db.read_workflow_file(kind, label)
    if pair is None:
        return web.json_response(
            {"error": "workflow file not found on disk"}, status=404,
        )
    content, mtime = pair
    return web.Response(
        text=content,
        content_type="application/json",
        headers={"X-Workflow-Mtime": str(mtime)},
    )


@routes.get("/comfytv/workflows/config")
async def workflow_get_config(request: web.Request) -> web.Response:
    kind  = request.query.get("kind")  or ""
    label = request.query.get("label") or ""
    if not kind or not label:
        return web.json_response({"error": "kind and label required"}, status=400)
    cfg = workflow_db.get_workflow_config(kind, label)
    if cfg is None:
        return web.json_response({"error": "workflow not found"}, status=404)
    return web.json_response(cfg)


@routes.get("/comfytv/workflows/preset")
async def workflow_export_preset(request: web.Request) -> web.Response:
    kind  = request.query.get("kind")  or ""
    label = request.query.get("label") or ""
    if not kind or not label:
        return web.json_response({"error": "kind and label required"}, status=400)
    preset = workflow_db.build_preset(kind, label)
    if preset is None:
        return web.json_response({"error": "workflow not found"}, status=404)
    slug = re.sub(r'[^a-z0-9]+', '-', label.lower()).strip('-') or "workflow"
    filename = f"{slug}_preset.json"
    body = json.dumps(preset, indent=2, ensure_ascii=False)
    return web.Response(
        text=body,
        content_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@routes.post("/comfytv/workflows/{wid}/reset_to_preset")
async def workflow_reset_to_preset(request: web.Request) -> web.Response:
    try:
        wid = int(request.match_info["wid"])
    except (KeyError, ValueError):
        return web.json_response({"error": "invalid workflow id"}, status=400)
    result = workflow_db.reset_workflow_to_preset(wid)
    if result is None:
        return web.json_response(
            {"error": "workflow not found, file missing, or no shipped preset"},
            status=404,
        )
    return web.json_response(result)


@routes.post("/comfytv/workflows/config/binding")
async def workflow_upsert_binding(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "json body required"}, status=400)
    try:
        ok = workflow_db.upsert_input_binding(
            workflow_id=int(body["workflow_id"]),
            node_id=str(body["node_id"]),
            input_name=str(body["input_name"]),
            from_=str(body.get("from") or ""),
            default=body.get("default"),
            prefix=body.get("prefix"),
            suffix=body.get("suffix"),
            required=bool(body.get("required") or False),
            error_msg=body.get("error_msg"),
            cast=body.get("cast"),
        )
    except (KeyError, ValueError, TypeError) as e:
        return web.json_response({"error": f"bad payload: {e}"}, status=400)
    if not ok:
        return web.json_response({"error": "workflow not found"}, status=404)
    return web.json_response({"ok": True})


@routes.delete("/comfytv/workflows/config/binding")
async def workflow_delete_binding(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "json body required"}, status=400)
    try:
        ok = workflow_db.delete_input_binding(
            workflow_id=int(body["workflow_id"]),
            node_id=str(body["node_id"]),
            input_name=str(body["input_name"]),
        )
    except (KeyError, ValueError, TypeError) as e:
        return web.json_response({"error": f"bad payload: {e}"}, status=400)
    return web.json_response({"ok": ok})


@routes.post("/comfytv/workflows/config/meta")
async def workflow_update_meta(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "json body required"}, status=400)
    try:
        wid = int(body["workflow_id"])
    except (KeyError, ValueError, TypeError) as e:
        return web.json_response({"error": f"bad payload: {e}"}, status=400)

    kwargs: dict = {}
    if "description" in body:        kwargs["description"]        = body["description"]
    if "result_type" in body:        kwargs["result_type"]        = body["result_type"]
    if "result_node" in body:        kwargs["result_node"]        = body["result_node"]
    if "sizing" in body:             kwargs["sizing"]             = body["sizing"]
    if "prune_when_missing" in body: kwargs["prune_when_missing"] = body["prune_when_missing"]

    ok = workflow_db.update_workflow_meta(wid, **kwargs)
    if not ok:
        return web.json_response({"error": "workflow not found"}, status=404)
    return web.json_response({"ok": True})


@routes.post("/comfytv/workflows/api_json")
async def workflow_set_api_json(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "json body required"}, status=400)

    kind  = str(body.get("kind") or "")
    label = str(body.get("label") or "")
    api_json = body.get("api_json")
    file_mtime = body.get("file_mtime")

    if not kind or not label:
        return web.json_response({"error": "kind and label required"}, status=400)
    if not isinstance(api_json, dict):
        return web.json_response({"error": "api_json must be an object"}, status=400)
    try:
        file_mtime = float(file_mtime)
    except (TypeError, ValueError):
        return web.json_response({"error": "file_mtime must be a number"}, status=400)

    ok = workflow_db.set_api_json(kind, label, api_json, file_mtime)
    if not ok:
        return web.json_response({"error": "workflow not found"}, status=404)
    return web.json_response({"ok": True})
