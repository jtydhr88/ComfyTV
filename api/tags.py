from aiohttp import web

from .. import storage
from ._common import routes


@routes.put("/comfytv/tags/{kind}/{tid}")
async def set_tags(request: web.Request) -> web.Response:
    kind = request.match_info["kind"]
    if kind not in storage.TAG_TARGETS:
        return web.json_response({"error": f"unknown kind {kind!r}"}, status=404)
    try:
        tid = int(request.match_info["tid"])
    except ValueError:
        return web.json_response({"error": "invalid id"}, status=400)
    try:
        body = await request.json()
    except Exception as e:
        return web.json_response({"error": f"invalid json: {e}"}, status=400)
    category_ids = body.get("category_ids")
    if not isinstance(category_ids, list):
        return web.json_response({"error": "category_ids must be a list"}, status=400)
    ids = storage.set_target_categories(kind, tid, category_ids)
    if ids is None:
        return web.json_response({"error": "item or category not found"}, status=404)
    return web.json_response({"ok": True, "category_ids": ids})
