from aiohttp import web

from .. import storage
from ._common import routes, broadcast_asset_event


def _int_list(value) -> tuple[bool, list[int] | None]:
    if value is None:
        return True, None
    if not isinstance(value, list):
        return False, None
    out: list[int] = []
    for item in value:
        try:
            out.append(int(item))
        except (TypeError, ValueError):
            return False, None
    return True, out


@routes.get("/comfytv/asset_categories")
async def list_asset_categories(request: web.Request) -> web.Response:
    return web.json_response({"categories": storage.list_asset_categories()})


@routes.post("/comfytv/asset_categories")
async def create_asset_category(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception as e:
        return web.json_response({"error": f"invalid json: {e}"}, status=400)
    name = (body.get("name") or "").strip()
    if not name:
        return web.json_response({"error": "name is required"}, status=400)
    row = storage.create_asset_category(name)
    if row is None:
        return web.json_response({"error": f"category {name!r} already exists"}, status=409)
    broadcast_asset_event("category-create", {"category": row})
    return web.json_response({"ok": True, "category": row})


@routes.patch("/comfytv/asset_categories/{cid}")
async def rename_asset_category(request: web.Request) -> web.Response:
    try:
        cid = int(request.match_info["cid"])
    except ValueError:
        return web.json_response({"error": "invalid category id"}, status=400)
    try:
        body = await request.json()
    except Exception as e:
        return web.json_response({"error": f"invalid json: {e}"}, status=400)
    name = (body.get("name") or "").strip()
    if not name:
        return web.json_response({"error": "name is required"}, status=400)
    row = storage.rename_asset_category(cid, name)
    if row is None:
        return web.json_response({"error": "category not found or name taken"}, status=404)
    broadcast_asset_event("category-rename", {"category": row})
    return web.json_response({"ok": True, "category": row})


@routes.delete("/comfytv/asset_categories/{cid}")
async def delete_asset_category(request: web.Request) -> web.Response:
    try:
        cid = int(request.match_info["cid"])
    except ValueError:
        return web.json_response({"error": "invalid category id"}, status=400)
    if not storage.delete_asset_category(cid):
        return web.json_response({"error": "category not found"}, status=404)
    broadcast_asset_event("category-delete", {"id": cid})
    return web.json_response({"ok": True})


@routes.get("/comfytv/assets")
async def list_assets(request: web.Request) -> web.Response:
    category = request.query.get("category", "all")
    try:
        limit = max(1, min(int(request.query.get("limit", "200")), 500))
        offset = max(0, int(request.query.get("offset", "0")))
    except ValueError:
        return web.json_response({"error": "invalid limit/offset"}, status=400)

    if category == "all":
        rows = storage.list_assets(limit=limit, offset=offset)
    elif category == "none":
        rows = storage.list_assets(uncategorized=True, limit=limit, offset=offset)
    else:
        try:
            cid = int(category)
        except ValueError:
            return web.json_response({"error": "category must be 'all', 'none' or an id"}, status=400)
        rows = storage.list_assets(category_id=cid, limit=limit, offset=offset)
    return web.json_response({"assets": rows})


@routes.post("/comfytv/assets")
async def create_asset(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception as e:
        return web.json_response({"error": f"invalid json: {e}"}, status=400)
    payload_url = (body.get("payload_url") or "").strip()
    if not payload_url:
        return web.json_response({"error": "payload_url is required"}, status=400)
    media_type = (body.get("media_type") or "image").strip()
    if media_type not in storage.ASSET_MEDIA_TYPES:
        return web.json_response(
            {"error": f"unknown media_type {media_type!r}; valid: {list(storage.ASSET_MEDIA_TYPES)}"},
            status=400,
        )
    ok, category_ids = _int_list(body.get("category_ids"))
    if not ok:
        return web.json_response({"error": "invalid category_ids"}, status=400)
    metadata = body.get("metadata")
    row = storage.create_asset(
        name=body.get("name") or "",
        payload_url=payload_url,
        media_type=media_type,
        category_ids=category_ids,
        mime_type=body.get("mime_type"),
        width=body.get("width"),
        height=body.get("height"),
        size_bytes=body.get("size_bytes"),
        source=body.get("source"),
        metadata=metadata if isinstance(metadata, dict) else None,
    )
    if row is None:
        return web.json_response({"error": "invalid asset (bad category or payload)"}, status=400)
    broadcast_asset_event("create", {"asset": row})
    return web.json_response({"ok": True, "asset": row})


@routes.patch("/comfytv/assets/{aid}")
async def update_asset(request: web.Request) -> web.Response:
    try:
        aid = int(request.match_info["aid"])
    except ValueError:
        return web.json_response({"error": "invalid asset id"}, status=400)
    try:
        body = await request.json()
    except Exception as e:
        return web.json_response({"error": f"invalid json: {e}"}, status=400)

    name = body.get("name")
    category_ids = None
    if "category_ids" in body:
        ok, category_ids = _int_list(body.get("category_ids"))
        if not ok or category_ids is None:
            return web.json_response({"error": "invalid category_ids"}, status=400)

    row = storage.update_asset(
        aid,
        name=str(name) if name is not None else None,
        category_ids=category_ids,
    )
    if row is None:
        return web.json_response({"error": "asset or category not found"}, status=404)
    broadcast_asset_event("update", {"asset": row})
    return web.json_response({"ok": True, "asset": row})


@routes.post("/comfytv/assets/{aid}/categories/{cid}")
async def add_asset_category(request: web.Request) -> web.Response:
    try:
        aid = int(request.match_info["aid"])
        cid = int(request.match_info["cid"])
    except ValueError:
        return web.json_response({"error": "invalid asset or category id"}, status=400)
    row = storage.add_asset_category(aid, cid)
    if row is None:
        return web.json_response({"error": "asset or category not found"}, status=404)
    broadcast_asset_event("update", {"asset": row})
    return web.json_response({"ok": True, "asset": row})


@routes.delete("/comfytv/assets/{aid}/categories/{cid}")
async def remove_asset_category(request: web.Request) -> web.Response:
    try:
        aid = int(request.match_info["aid"])
        cid = int(request.match_info["cid"])
    except ValueError:
        return web.json_response({"error": "invalid asset or category id"}, status=400)
    row = storage.remove_asset_category(aid, cid)
    if row is None:
        return web.json_response({"error": "asset not found"}, status=404)
    broadcast_asset_event("update", {"asset": row})
    return web.json_response({"ok": True, "asset": row})


@routes.delete("/comfytv/assets/{aid}")
async def delete_asset(request: web.Request) -> web.Response:
    try:
        aid = int(request.match_info["aid"])
    except ValueError:
        return web.json_response({"error": "invalid asset id"}, status=400)
    if not storage.delete_asset(aid):
        return web.json_response({"error": "asset not found"}, status=404)
    broadcast_asset_event("delete", {"id": aid})
    return web.json_response({"ok": True})
