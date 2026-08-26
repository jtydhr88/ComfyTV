import asyncio
import mimetypes
import re
import shutil
import urllib.parse
from pathlib import Path

from aiohttp import web

from .. import storage
from ..runners import eagle, eagle_lib
from ._common import _log, routes, broadcast_asset_event

EAGLE_SUBFOLDER = "comfytv/eagle"
FILE_CACHE_HEADERS = {"Cache-Control": "public, max-age=3600"}

_background_tasks: set = set()


def _enabled() -> bool:
    try:
        return bool(storage.get_setting("enable-eagle"))
    except Exception:
        return False


def _disabled_response() -> web.Response:
    return web.json_response({"error": "eagle integration is disabled"}, status=403)


def _autoflush() -> None:
    task = asyncio.get_running_loop().create_task(eagle.flush_pending())
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


@routes.get("/comfytv/eagle/status")
async def eagle_status(request: web.Request) -> web.Response:
    if not _enabled():
        return web.json_response({"enabled": False, "mode": "disabled",
                                  "pending": 0})
    status = await eagle.probe(fresh=request.query.get("fresh") == "1")
    pending = await asyncio.to_thread(storage.eagle_pending_count)
    if status["mode"] == "api" and pending > 0:
        _autoflush()
    return web.json_response({"enabled": True, **status, "pending": pending})


@routes.get("/comfytv/eagle/items")
async def eagle_items(request: web.Request) -> web.Response:
    if not _enabled():
        return _disabled_response()
    try:
        limit = max(1, min(int(request.query.get("limit", "100")), 500))
        offset = max(0, int(request.query.get("offset", "0")))
    except ValueError:
        return web.json_response({"error": "invalid limit/offset"}, status=400)
    media_type = request.query.get("media_type", "")
    if media_type and media_type not in eagle_lib.MEDIA_EXTS:
        return web.json_response({"error": f"unknown media_type {media_type!r}"},
                                 status=400)
    keyword = request.query.get("keyword", "")
    folder = request.query.get("folder", "")
    status = await eagle.probe()

    if request.query.get("search") == "ai":
        try:
            items = await eagle.ai_search(status, text=keyword, limit=limit)
        except eagle.EagleUnavailable:
            return web.json_response(
                {"error": "AI search needs Eagle's AI Search plugin running"},
                status=409)
        except Exception as e:
            _log.exception("[ComfyTV/eagle] ai search failed")
            return web.json_response({"error": str(e)}, status=502)
        exts = eagle_lib.MEDIA_EXTS.get(media_type)
        items = [i for i in items
                 if (not folder or folder in i["folders"])
                 and (exts is None or i["ext"] in exts)]
        return web.json_response({"items": items, "mode": status["mode"],
                                  "total": len(items)})

    try:
        result = await eagle.list_items(
            status, keyword=keyword, folder=folder,
            media_type=media_type, limit=limit, offset=offset,
        )
    except Exception as e:
        _log.exception("[ComfyTV/eagle] list items failed")
        return web.json_response({"error": str(e)}, status=502)
    return web.json_response({"items": result["items"], "mode": status["mode"],
                              "total": result["total"]})


@routes.get("/comfytv/eagle/similar")
async def eagle_similar(request: web.Request) -> web.Response:
    if not _enabled():
        return _disabled_response()
    item_id = str(request.query.get("id") or "")
    if not eagle_lib.valid_item_id(item_id):
        return web.json_response({"error": "invalid item id"}, status=400)
    try:
        limit = max(1, min(int(request.query.get("limit", "100")), 500))
    except ValueError:
        return web.json_response({"error": "invalid limit"}, status=400)
    status = await eagle.probe()
    try:
        items = await eagle.ai_search(status, item_id=item_id, limit=limit)
    except eagle.EagleUnavailable:
        return web.json_response(
            {"error": "AI search needs Eagle's AI Search plugin running"},
            status=409)
    except Exception as e:
        _log.exception("[ComfyTV/eagle] similar search failed")
        return web.json_response({"error": str(e)}, status=502)
    return web.json_response({"items": items, "mode": status["mode"],
                              "total": len(items)})


@routes.get("/comfytv/eagle/folders")
async def eagle_folders(request: web.Request) -> web.Response:
    if not _enabled():
        return _disabled_response()
    status = await eagle.probe()
    try:
        folders = await eagle.list_folders(status)
    except Exception as e:
        _log.exception("[ComfyTV/eagle] list folders failed")
        return web.json_response({"error": str(e)}, status=502)
    return web.json_response({"folders": folders, "mode": status["mode"]})


async def _item_file(request: web.Request, thumb: bool):
    if not _enabled():
        return _disabled_response()
    item_id = str(request.query.get("id") or "")
    if not eagle_lib.valid_item_id(item_id):
        return web.json_response({"error": "invalid item id"}, status=400)
    status = await eagle.probe()
    resolver = eagle_lib.item_thumb_file if thumb else eagle_lib.item_main_file

    def _resolve():
        lib = eagle.library_for_reads(status)
        if lib is None:
            return None
        return resolver(lib, item_id) or "missing"

    path = await asyncio.to_thread(_resolve)
    if path is None:
        return web.json_response({"error": "no eagle library reachable"}, status=409)
    if path == "missing":
        return web.Response(status=404)
    if thumb:
        # Items without an Eagle thumbnail resolve to the original file —
        # cap it instead of pushing full-res bytes into the grid.
        try:
            max_edge = int(request.query.get("max", "512"))
        except ValueError:
            max_edge = 512
        from ..runners.thumbs import thumb_for_path
        try:
            path = await asyncio.to_thread(thumb_for_path, path, max_edge)
        except Exception:
            pass
    headers = dict(FILE_CACHE_HEADERS)
    ctype = mimetypes.guess_type(path.name)[0]
    if ctype:
        headers["Content-Type"] = ctype
    return web.FileResponse(path, headers=headers)


@routes.get("/comfytv/eagle/thumb")
async def eagle_thumb(request: web.Request):
    return await _item_file(request, thumb=True)


@routes.get("/comfytv/eagle/file")
async def eagle_file(request: web.Request):
    return await _item_file(request, thumb=False)


def _safe_name(name: str) -> str:
    return re.sub(r'[<>:"/\\|?*\s]+', "_", name).strip("._")[:80]


def _eagle_view_url(filename: str) -> str:
    qs = urllib.parse.urlencode({
        "filename": filename, "subfolder": EAGLE_SUBFOLDER, "type": "input",
    })
    return f"/view?{qs}"


@routes.post("/comfytv/eagle/import")
async def eagle_import(request: web.Request) -> web.Response:
    if not _enabled():
        return _disabled_response()
    try:
        body = await request.json()
    except Exception as e:
        return web.json_response({"error": f"invalid json: {e}"}, status=400)
    item_id = str(body.get("id") or "")
    if not eagle_lib.valid_item_id(item_id):
        return web.json_response({"error": "invalid item id"}, status=400)

    status = await eagle.probe()
    lib = await asyncio.to_thread(eagle.library_for_reads, status)
    if lib is None:
        return web.json_response({"error": "no eagle library reachable"}, status=409)

    item = await asyncio.to_thread(eagle_lib.read_item, lib, item_id)
    src = await asyncio.to_thread(eagle_lib.item_main_file, lib, item_id)
    if item is None or src is None:
        return web.json_response({"error": "item not found"}, status=404)
    media_type = eagle_lib.media_type_of_ext(src.suffix)
    if media_type is None:
        return web.json_response(
            {"error": f"unsupported file type {src.suffix!r}"}, status=415)

    import folder_paths
    dest_dir = Path(folder_paths.get_input_directory()) / EAGLE_SUBFOLDER
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"{item_id}-{_safe_name(item['name']) or 'item'}{src.suffix.lower()}"
    payload_url = _eagle_view_url(dest.name)

    existing = storage.find_asset_by_payload_url(payload_url)
    if existing is not None:
        return web.json_response({"ok": True, "existed": True,
                                  "asset": existing,
                                  "payload_url": payload_url})

    await asyncio.to_thread(shutil.copy2, src, dest)
    row = storage.create_asset(
        name=item["name"],
        payload_url=payload_url,
        media_type=media_type,
        width=item.get("width"),
        height=item.get("height"),
        size_bytes=item.get("size"),
        source="eagle",
        metadata={"eagle_id": item_id, "eagle_tags": item["tags"]},
    )
    if row is None:
        return web.json_response({"error": "asset creation failed"}, status=500)
    broadcast_asset_event("create", {"asset": row})
    return web.json_response({"ok": True, "asset": row})


@routes.post("/comfytv/eagle/send")
async def eagle_send(request: web.Request) -> web.Response:
    if not _enabled():
        return _disabled_response()
    try:
        body = await request.json()
    except Exception as e:
        return web.json_response({"error": f"invalid json: {e}"}, status=400)
    payload_url = str(body.get("payload_url") or "").strip()
    if not payload_url:
        return web.json_response({"error": "payload_url is required"}, status=400)
    tags = body.get("tags")
    annotation = body.get("annotation")
    if not annotation:
        annotation = await asyncio.to_thread(
            eagle.annotation_for_url, payload_url) or None
    try:
        result = await eagle.send_or_queue(
            payload_url,
            name=str(body.get("name") or ""),
            tags=[str(t) for t in tags] if isinstance(tags, list) else ["comfytv"],
            annotation=annotation,
            folder=str(body.get("folder") or "") or None,
        )
    except FileNotFoundError:
        return web.json_response({"error": "file not found for payload_url"},
                                 status=404)
    except Exception as e:
        _log.exception("[ComfyTV/eagle] send failed")
        return web.json_response({"error": str(e)}, status=502)
    return web.json_response({"ok": True, **result,
                              "pending_count": storage.eagle_pending_count()})


@routes.post("/comfytv/eagle/flush")
async def eagle_flush(request: web.Request) -> web.Response:
    if not _enabled():
        return _disabled_response()
    result = await eagle.flush_pending()
    return web.json_response({"ok": True, **result})


@routes.get("/comfytv/eagle/pending")
async def eagle_pending(request: web.Request) -> web.Response:
    if not _enabled():
        return _disabled_response()
    return web.json_response({"pending": storage.list_eagle_pending()})


@routes.delete("/comfytv/eagle/pending/{pid}")
async def eagle_pending_delete(request: web.Request) -> web.Response:
    if not _enabled():
        return _disabled_response()
    try:
        pid = int(request.match_info["pid"])
    except ValueError:
        return web.json_response({"error": "invalid id"}, status=400)
    if not storage.delete_eagle_pending(pid):
        return web.json_response({"error": "not found"}, status=404)
    return web.json_response({"ok": True})
