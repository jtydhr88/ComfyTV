import asyncio
import json
import logging
import time
from pathlib import Path
from typing import Any, Optional

import aiohttp

from . import eagle_lib

logger = logging.getLogger(__name__)

DEFAULT_API_URL = "http://127.0.0.1:41595"
PROBE_TIMEOUT_S = 3.0
REQUEST_TIMEOUT_S = 20.0
PROBE_CACHE_TTL_S = 3.0
QUERY_PAGE_LIMIT = 1000
QUERY_SCAN_CAP = 20000

_probe_cache: dict[str, Any] = {"at": 0.0, "status": None}
_folder_cache: dict[tuple[str, str], str] = {}
_flush_lock = asyncio.Lock()


class EagleUnavailable(RuntimeError):
    def __init__(self, status: dict):
        super().__init__(f"Eagle unavailable (mode={status.get('mode')})")
        self.status = status


def _setting(key: str, default: str = "") -> str:
    from .. import storage
    try:
        value = storage.get_setting(key)
    except Exception:
        return default
    return str(value) if value else default


def api_base() -> str:
    return (_setting("eagle-api-url") or DEFAULT_API_URL).rstrip("/")


def pinned_library() -> str:
    return _setting("eagle-library-path").strip().rstrip("\\/")


def _norm_path(p: str) -> str:
    return str(p).replace("\\", "/").rstrip("/").lower()


async def _request(method: str, path: str, *,
                   params: Optional[dict] = None,
                   json_body: Optional[dict] = None,
                   timeout: float = REQUEST_TIMEOUT_S) -> Any:
    url = f"{api_base()}{path}"
    client_timeout = aiohttp.ClientTimeout(total=timeout)
    async with aiohttp.ClientSession(timeout=client_timeout) as session:
        async with session.request(method, url, params=params, json=json_body) as resp:
            if resp.status != 200:
                raise RuntimeError(f"Eagle API {path} -> HTTP {resp.status}")
            data = await resp.json(content_type=None)
    if not isinstance(data, dict) or data.get("status") != "success":
        raise RuntimeError(f"Eagle API {path} -> {data!r}")
    return data.get("data")


async def probe(*, fresh: bool = False) -> dict:
    now = time.monotonic()
    if not fresh and _probe_cache["status"] is not None \
            and now - _probe_cache["at"] < PROBE_CACHE_TTL_S:
        return _probe_cache["status"]

    pinned = await asyncio.to_thread(pinned_library)
    status: dict[str, Any] = {
        "online": False,
        "version": None,
        "api_version": None,
        "ai_ready": False,
        "current_library": None,
        "pinned_library": pinned,
        "library_match": False,
        "mode": "offline",
    }
    current = None
    try:
        app = await _request("GET", "/api/v2/app/info", timeout=PROBE_TIMEOUT_S)
        lib = await _request("GET", "/api/v2/library/info", timeout=PROBE_TIMEOUT_S)
        status["online"] = True
        status["api_version"] = "v2"
        status["version"] = str(app.get("version") or "")
        current = lib.get("path") or None
        status["current_library"] = current
    except Exception:
        try:
            app = await _request("GET", "/api/application/info", timeout=PROBE_TIMEOUT_S)
            lib = await _request("GET", "/api/library/info", timeout=PROBE_TIMEOUT_S)
            status["online"] = True
            status["api_version"] = "v1"
            status["version"] = str(app.get("version") or "")
            current = ((lib.get("library") or {}).get("path")) or None
            status["current_library"] = current
        except Exception as e:
            logger.debug("[ComfyTV/eagle] probe failed: %s", e)

    if status["api_version"] == "v2":
        try:
            status["ai_ready"] = bool(await _request(
                "GET", "/api/v2/aiSearch/isReady", timeout=PROBE_TIMEOUT_S))
        except Exception:
            status["ai_ready"] = False

    if status["online"] and (not pinned or (
            current and _norm_path(current) == _norm_path(pinned))):
        status["library_match"] = True
        status["mode"] = "api"
    elif pinned and await asyncio.to_thread(lambda: Path(pinned).is_dir()):
        status["mode"] = "disk"

    _probe_cache["at"] = now
    _probe_cache["status"] = status
    return status


def library_for_reads(status: dict) -> Optional[Path]:
    pinned = status.get("pinned_library")
    if pinned and Path(pinned).is_dir():
        return Path(pinned)
    current = status.get("current_library")
    if status.get("mode") == "api" and current and Path(current).is_dir():
        return Path(current)
    return None


async def _fetch_all_v2(path: str, body_base: dict) -> list[dict]:
    rows: list[dict] = []
    total = None
    while True:
        body = {**body_base, "limit": QUERY_PAGE_LIMIT, "offset": len(rows)}
        raw = await _request("POST", path, json_body=body)
        page = raw.get("data") if isinstance(raw, dict) else raw
        page = page if isinstance(page, list) else []
        rows.extend(page)
        if total is None and isinstance(raw, dict) \
                and isinstance(raw.get("total"), int):
            total = raw["total"]
        if not page:
            break
        if total is not None and len(rows) >= total:
            break
        if len(rows) >= QUERY_SCAN_CAP:
            logger.warning(
                "[ComfyTV/eagle] filter scan capped at %d of %s items",
                QUERY_SCAN_CAP, total)
            break
    return rows


async def list_items(status: dict, *, keyword: str = "", folder: str = "",
                     media_type: str = "", limit: int = 100,
                     offset: int = 0) -> dict:
    if status["mode"] == "api" and status.get("api_version") == "v2":
        # Quirks (Eagle build 20260401): item/query ignores folders/ext
        # entirely; item/get's ext only accepts a single string; item/get's
        # fields param 500s. Filtered listings therefore page the full set
        # and filter locally.
        if keyword.strip() or media_type:
            if keyword.strip():
                body_base: dict[str, Any] = {"query": keyword.strip()}
                path = "/api/v2/item/query"
            else:
                body_base = {}
                if folder:
                    body_base["folders"] = [folder]
                path = "/api/v2/item/get"
            rows = await _fetch_all_v2(path, body_base)
            items = [eagle_lib.normalize_item(r) for r in rows]
            items = eagle_lib.filter_items(
                [i for i in items if i is not None],
                folder=folder if path.endswith("query") else "",
                media_type=media_type)
            return {"items": items[offset:offset + limit],
                    "total": len(items)}

        body = {"limit": limit, "offset": max(0, offset)}
        if folder:
            body["folders"] = [folder]
        raw = await _request("POST", "/api/v2/item/get", json_body=body)
        rows = raw.get("data") if isinstance(raw, dict) else raw
        items = [eagle_lib.normalize_item(r) for r in (rows or [])]
        total = raw.get("total") if isinstance(raw, dict) else None
        return {"items": [i for i in items if i is not None],
                "total": total if isinstance(total, int) else None}

    if status["mode"] == "api":
        params: dict[str, Any] = {
            "limit": limit,
            # V1's offset is a page index, not an item count.
            "offset": max(0, offset) // max(1, limit),
        }
        if keyword.strip():
            params["keyword"] = keyword.strip()
        if folder:
            params["folders"] = folder
        if media_type:
            params["ext"] = ",".join(sorted(eagle_lib.MEDIA_EXTS[media_type]))
        raw = await _request("GET", "/api/item/list", params=params)
        items = [eagle_lib.normalize_item(r) for r in (raw or [])]
        return {"items": [i for i in items if i is not None], "total": None}

    lib = await asyncio.to_thread(library_for_reads, status)
    if lib is None:
        return {"items": [], "total": 0}
    items = await asyncio.to_thread(eagle_lib.read_items, lib)
    items = eagle_lib.filter_items(
        items, keyword=keyword, folder=folder, media_type=media_type)
    return {"items": items[offset:offset + limit], "total": len(items)}


async def ai_search(status: dict, *, text: str = "",
                    item_id: str = "", limit: int = 100) -> list[dict]:
    if status["mode"] != "api" or status.get("api_version") != "v2" \
            or not status.get("ai_ready"):
        raise EagleUnavailable(status)
    if item_id:
        raw = await _request("POST", "/api/v2/aiSearch/searchByItemId",
                             json_body={"itemId": item_id, "limit": limit})
    else:
        raw = await _request("POST", "/api/v2/aiSearch/searchByText",
                             json_body={"text": text, "limit": limit})
    entries = raw.get("data") if isinstance(raw, dict) else raw
    out: list[dict] = []
    for entry in entries or []:
        payload = entry.get("item") if isinstance(entry, dict) and "item" in entry else entry
        item = eagle_lib.normalize_item(payload)
        if item is None:
            continue
        if isinstance(entry, dict) and isinstance(entry.get("score"), (int, float)):
            item["score"] = entry["score"]
        out.append(item)
    return out


def _flatten_api_folders(nodes, parent, depth, out) -> None:
    if not isinstance(nodes, list):
        return
    for node in nodes:
        if not isinstance(node, dict) or not node.get("id"):
            continue
        out.append({
            "id": str(node["id"]),
            "name": str(node.get("name") or ""),
            "parent": parent,
            "depth": depth,
        })
        _flatten_api_folders(node.get("children"), str(node["id"]), depth + 1, out)


async def list_folders(status: dict) -> list[dict]:
    if status["mode"] == "api":
        raw = await _request("GET", "/api/folder/list")
        out: list[dict] = []
        _flatten_api_folders(raw, None, 0, out)
        return out
    lib = await asyncio.to_thread(library_for_reads, status)
    if lib is None:
        return []
    return await asyncio.to_thread(eagle_lib.read_folders, lib)


async def find_or_create_folder(name: str) -> Optional[str]:
    name = (name or "").strip()
    if not name:
        return None
    cache_key = (api_base(), name)
    cached = _folder_cache.get(cache_key)
    if cached:
        return cached
    raw = await _request("GET", "/api/folder/list")
    flat: list[dict] = []
    _flatten_api_folders(raw, None, 0, flat)
    for f in flat:
        if f["name"] == name:
            _folder_cache[cache_key] = f["id"]
            return f["id"]
    created = await _request("POST", "/api/folder/create",
                             json_body={"folderName": name})
    folder_id = str((created or {}).get("id") or "")
    if folder_id:
        _folder_cache[cache_key] = folder_id
    return folder_id or None


ANNOTATION_MAX_CHARS = 4000


def format_annotation(*, stage_class: str = "", project_name: str = "",
                      params: Any = None, created_at: str = "") -> str:
    lines = []
    header = " · ".join(x for x in ("ComfyTV", stage_class, created_at) if x)
    if header:
        lines.append(header)
    if project_name:
        lines.append(f"project: {project_name}")
    if isinstance(params, dict):
        for key, value in params.items():
            if value is None or value == "":
                continue
            if isinstance(value, (dict, list)):
                value = json.dumps(value, ensure_ascii=False, default=str)
            lines.append(f"{key}: {value}")
    text = "\n".join(lines)
    return text[:ANNOTATION_MAX_CHARS]


def annotation_for_url(payload_url: str) -> str:
    from .. import storage
    try:
        row = storage.find_output_by_payload_url(payload_url)
    except Exception:
        return ""
    if not row:
        return ""
    project = None
    try:
        project = storage.get_project(row.get("project_id") or "")
    except Exception:
        pass
    return format_annotation(
        stage_class=row.get("stage_class") or "",
        project_name=(project or {}).get("name") or "",
        params=row.get("params_json"),
        created_at=(row.get("created_at") or "")[:19],
    )


async def send_now(file_path: Path, *, name: str = "",
                   tags: Optional[list[str]] = None,
                   annotation: Optional[str] = None,
                   folder: Optional[str] = None) -> None:
    status = await probe(fresh=True)
    if status["mode"] != "api":
        raise EagleUnavailable(status)
    body: dict[str, Any] = {
        "path": str(file_path),
        "name": name or file_path.stem,
    }
    if tags:
        body["tags"] = [str(t) for t in tags]
    if annotation:
        body["annotation"] = str(annotation)
    folder_id = await find_or_create_folder(folder or _setting("eagle-send-folder"))
    if folder_id:
        body["folderId"] = folder_id
    await _request("POST", "/api/item/addFromPath", json_body=body)


async def send_or_queue(payload_url: str, *, name: str = "",
                        tags: Optional[list[str]] = None,
                        annotation: Optional[str] = None,
                        folder: Optional[str] = None) -> dict:
    from .. import storage
    from .media import view_url_to_path

    path = await asyncio.to_thread(view_url_to_path, payload_url)
    if path is None:
        raise FileNotFoundError(payload_url)
    try:
        await send_now(path, name=name, tags=tags, annotation=annotation,
                       folder=folder)
        return {"sent": True}
    except EagleUnavailable as e:
        row = await asyncio.to_thread(
            storage.enqueue_eagle_send,
            payload_url=payload_url, name=name, tags=tags,
            annotation=annotation, folder=folder)
        return {"sent": False, "queued": True, "pending": row,
                "mode": e.status.get("mode")}


async def flush_pending() -> dict:
    from .. import storage
    from .media import view_url_to_path

    async with _flush_lock:
        rows = await asyncio.to_thread(storage.list_eagle_pending)
        sent = failed = 0
        for row in rows:
            try:
                path = await asyncio.to_thread(view_url_to_path, row["payload_url"])
                if path is None:
                    raise FileNotFoundError(row["payload_url"])
                await send_now(path, name=row["name"], tags=row["tags"],
                               annotation=row.get("annotation"),
                               folder=row.get("folder"))
                await asyncio.to_thread(storage.resolve_eagle_pending, row["id"])
                sent += 1
            except EagleUnavailable:
                break
            except Exception as e:
                await asyncio.to_thread(
                    storage.resolve_eagle_pending, row["id"], error=str(e))
                failed += 1
        remaining = await asyncio.to_thread(storage.eagle_pending_count)
        return {"sent": sent, "failed": failed, "remaining": remaining}


AUTO_SEND_OUTPUT_TYPES = {"image", "video", "audio", "images"}


def _archive_urls(output_type: str, payload_url: str, payload_json: Any) -> list[str]:
    if isinstance(payload_url, str) and payload_url.startswith("/view?"):
        return [payload_url]
    if output_type == "images" and isinstance(payload_json, dict):
        urls = []
        for img in payload_json.get("images") or []:
            url = img.get("image_url") if isinstance(img, dict) else None
            if isinstance(url, str) and url.startswith("/view?"):
                urls.append(url)
        return urls
    return []


def auto_send_output(*, payload_url: str, output_type: str,
                     project_id: str, stage_class: str,
                     params: Any = None, payload_json: Any = None) -> bool:
    # Runs on the prompt-worker thread: only a sync DB enqueue here, the
    # Eagle round-trip happens on the server loop.
    from .. import storage

    try:
        if not storage.get_setting("eagle-auto-send") \
                or not storage.get_setting("enable-eagle"):
            return False
    except Exception:
        return False
    if output_type not in AUTO_SEND_OUTPUT_TYPES:
        return False
    urls = _archive_urls(output_type, payload_url, payload_json)
    if not urls:
        return False

    project_name = ""
    try:
        project_name = (storage.get_project(project_id or "") or {}).get("name") or ""
    except Exception:
        pass
    annotation = format_annotation(
        stage_class=stage_class, project_name=project_name, params=params)
    tags = ["comfytv"] + ([project_name] if project_name else [])
    for i, url in enumerate(urls):
        name = stage_class or ""
        if len(urls) > 1:
            name = f"{name} #{i + 1}".strip()
        storage.enqueue_eagle_send(
            payload_url=url,
            name=name,
            tags=tags,
            annotation=annotation or None,
            folder=project_name or None,
        )
    kick_flush_threadsafe()
    return True


def kick_flush_threadsafe() -> None:
    try:
        from server import PromptServer
        loop = PromptServer.instance.loop
        asyncio.run_coroutine_threadsafe(flush_pending(), loop)
    except Exception:
        logger.debug("[ComfyTV/eagle] flush kick skipped (no server loop)")


__all__ = [
    "EagleUnavailable", "probe", "library_for_reads", "list_items",
    "ai_search", "list_folders", "find_or_create_folder", "send_now",
    "send_or_queue", "flush_pending", "api_base", "pinned_library",
    "format_annotation", "annotation_for_url", "auto_send_output",
    "kick_flush_threadsafe",
]
