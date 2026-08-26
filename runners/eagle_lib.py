import json
import re
from pathlib import Path
from typing import Optional

ITEM_ID_RE = re.compile(r"^[A-Za-z0-9]+$")

MEDIA_EXTS = {
    "image": {"png", "jpg", "jpeg", "webp", "gif", "bmp"},
    "video": {"mp4", "mov", "mkv", "webm", "m4v", "avi"},
    "audio": {"mp3", "wav", "flac", "ogg", "m4a", "aac", "opus"},
}

_cache: dict[str, dict] = {}


def valid_item_id(item_id: str) -> bool:
    return bool(item_id) and ITEM_ID_RE.match(item_id) is not None


def media_type_of_ext(ext: str) -> Optional[str]:
    ext = (ext or "").lower().lstrip(".")
    for media_type, exts in MEDIA_EXTS.items():
        if ext in exts:
            return media_type
    return None


def normalize_item(raw: dict) -> Optional[dict]:
    if not isinstance(raw, dict) or raw.get("isDeleted"):
        return None
    item_id = str(raw.get("id") or "")
    if not valid_item_id(item_id):
        return None
    tags = raw.get("tags")
    folders = raw.get("folders")

    def _num(v):
        return v if isinstance(v, (int, float)) else None

    return {
        "id": item_id,
        "name": str(raw.get("name") or ""),
        "ext": str(raw.get("ext") or "").lower(),
        "width": _num(raw.get("width")),
        "height": _num(raw.get("height")),
        "size": _num(raw.get("size")),
        "tags": [str(t) for t in tags] if isinstance(tags, list) else [],
        "folders": [str(f) for f in folders] if isinstance(folders, list) else [],
        "annotation": str(raw.get("annotation") or ""),
        "star": int(raw.get("star") or 0),
        "mtime": _num(raw.get("modificationTime")) or 0,
    }


def _signature(lib: Path) -> tuple:
    sig = []
    for name in ("mtime.json", "metadata.json"):
        p = lib / name
        try:
            st = p.stat()
            sig.append((name, st.st_mtime_ns, st.st_size))
        except OSError:
            sig.append((name, 0, 0))
    return tuple(sig)


def read_item(lib: Path, item_id: str) -> Optional[dict]:
    if not valid_item_id(item_id):
        return None
    meta = lib / "images" / f"{item_id}.info" / "metadata.json"
    try:
        raw = json.loads(meta.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return normalize_item(raw)


def read_items(lib: Path) -> list[dict]:
    key = str(lib)
    sig = _signature(lib)
    cached = _cache.get(key)
    if cached is not None and cached["sig"] == sig:
        return cached["items"]

    items: list[dict] = []
    images = lib / "images"
    if images.is_dir():
        for info_dir in images.iterdir():
            if not info_dir.name.endswith(".info"):
                continue
            meta = info_dir / "metadata.json"
            try:
                raw = json.loads(meta.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            item = normalize_item(raw)
            if item is not None:
                items.append(item)
    items.sort(key=lambda i: i.get("mtime") or 0, reverse=True)
    _cache[key] = {"sig": sig, "items": items}
    return items


def _flatten_folders(nodes, parent: Optional[str], depth: int, out: list[dict]) -> None:
    if not isinstance(nodes, list):
        return
    for node in nodes:
        if not isinstance(node, dict):
            continue
        fid = str(node.get("id") or "")
        if not fid:
            continue
        out.append({
            "id": fid,
            "name": str(node.get("name") or ""),
            "parent": parent,
            "depth": depth,
        })
        _flatten_folders(node.get("children"), fid, depth + 1, out)


def read_folders(lib: Path) -> list[dict]:
    try:
        raw = json.loads((lib / "metadata.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    out: list[dict] = []
    _flatten_folders(raw.get("folders"), None, 0, out)
    return out


def item_dir(lib: Path, item_id: str) -> Optional[Path]:
    if not valid_item_id(item_id):
        return None
    d = lib / "images" / f"{item_id}.info"
    return d if d.is_dir() else None


def item_main_file(lib: Path, item_id: str) -> Optional[Path]:
    d = item_dir(lib, item_id)
    if d is None:
        return None
    fallback = None
    for p in d.iterdir():
        if not p.is_file() or p.name == "metadata.json":
            continue
        if "_thumbnail" in p.stem:
            fallback = fallback or p
            continue
        return p
    return fallback


def item_thumb_file(lib: Path, item_id: str) -> Optional[Path]:
    d = item_dir(lib, item_id)
    if d is None:
        return None
    for p in d.iterdir():
        if p.is_file() and "_thumbnail" in p.stem:
            return p
    return item_main_file(lib, item_id)


def filter_items(
    items: list[dict],
    *,
    keyword: str = "",
    folder: str = "",
    media_type: str = "",
) -> list[dict]:
    keyword = (keyword or "").strip().lower()
    exts = MEDIA_EXTS.get(media_type) if media_type else None
    out = []
    for item in items:
        if folder and folder not in item["folders"]:
            continue
        if exts is not None and item["ext"] not in exts:
            continue
        if keyword and keyword not in item["name"].lower() \
                and not any(keyword in str(t).lower() for t in item["tags"]):
            continue
        out.append(item)
    return out


__all__ = [
    "MEDIA_EXTS", "valid_item_id", "media_type_of_ext", "normalize_item",
    "read_item", "read_items", "read_folders",
    "item_dir", "item_main_file", "item_thumb_file", "filter_items",
]
