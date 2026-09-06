from ... import storage
from .._common import broadcast_asset_event
from .._common import broadcast_entry_event
from ..assets import _with_file_missing, fill_media_meta


async def _outputs(args: dict) -> dict:
    pid = args.get("project_id")
    if not pid:
        raise ValueError("project_id is required")
    if args.get("latest_only"):
        stage_uid = args.get("stage_uid")
        stage_node_id = args.get("stage_node_id")
        if stage_uid:
            row = storage.latest_output_by_uid(pid, stage_uid)
        elif stage_node_id:
            row = storage.latest_output(pid, stage_node_id)
        else:
            raise ValueError("latest_only requires stage_uid or stage_node_id")
        return {"output": row}
    limit = max(1, min(int(args.get("limit", 20)), 100))
    rows = storage.list_outputs(
        pid, stage_node_id=args.get("stage_node_id"), limit=limit,
    )
    return {"outputs": rows}

async def _assets(args: dict) -> dict:
    category = str(args.get("category", "all"))
    limit = max(1, min(int(args.get("limit", 50)), 200))
    offset = max(0, int(args.get("offset", 0)))
    if category == "all":
        rows = storage.list_assets(limit=limit, offset=offset)
    elif category == "none":
        rows = storage.list_assets(uncategorized=True, limit=limit, offset=offset)
    else:
        try:
            cid = int(category)
        except ValueError:
            raise ValueError("category must be 'all', 'none' or a category id")
        _require_category(cid)
        rows = storage.list_assets(category_id=cid, limit=limit, offset=offset)
    out = []
    for r in rows:
        r = _with_file_missing(r)
        meta = r.pop("metadata", None)
        r["has_metadata"] = bool(meta)
        out.append(r)
    return {
        "assets": out,
        "categories": storage.list_asset_categories(),
    }

def _require_category(cid: int) -> dict:
    cats = storage.list_asset_categories()
    for c in cats:
        if int(c["id"]) == cid:
            return c
    raise ValueError(
        f"category {cid} not found; existing: "
        + ", ".join(f"{c['id']}={c['name']!r}" for c in cats) if cats
        else f"category {cid} not found; there are no categories yet")

def _resolve_category(args: dict) -> dict:
    cid = args.get("category_id")
    if cid is not None:
        try:
            n = None if isinstance(cid, bool) else float(cid)
        except (TypeError, ValueError):
            n = None
        if n is None or n != int(n):
            raise ValueError(f"category_id must be an integer (got {cid!r})")
        return _require_category(int(n))
    name = str(args.get("name") or "").strip()
    if not name:
        raise ValueError("category_id or name is required")
    for c in storage.list_asset_categories():
        if c["name"] == name:
            return c
    raise ValueError(f"category {name!r} not found")

async def _asset_edit(args: dict) -> dict:
    action = str(args.get("action") or "")
    if action == "create_category":
        name = str(args.get("name") or "").strip()
        if not name:
            raise ValueError("name is required")
        row = storage.create_asset_category(name)
        if row is None:
            raise ValueError(f"category {name!r} already exists")
        return {"category": row}
    if action == "rename_category":
        cat = _resolve_category(args)
        new_name = str(args.get("new_name") or "").strip()
        if not new_name:
            raise ValueError("new_name is required")
        row = storage.rename_asset_category(int(cat["id"]), new_name)
        if row is None:
            raise ValueError(f"category name {new_name!r} is already taken")
        broadcast_asset_event("category-rename", {"category": row})
        return {"category": row}
    if action == "delete_category":
        cat = _resolve_category(args)
        storage.delete_asset_category(int(cat["id"]))
        broadcast_asset_event("category-delete", {"id": cat["id"]})
        return {"ok": True, "deleted": cat}
    if action == "create":
        payload_url = str(args.get("payload_url") or "").strip()
        if not payload_url:
            raise ValueError("payload_url is required (e.g. an output's "
                             "payload_url from the outputs tool)")
        media_type = str(args.get("media_type") or "image")
        if media_type not in storage.ASSET_MEDIA_TYPES:
            raise ValueError(
                f"unknown media_type {media_type!r}; "
                f"valid: {list(storage.ASSET_MEDIA_TYPES)}")
        row = storage.create_asset(
            name=str(args.get("name") or ""),
            payload_url=payload_url,
            media_type=media_type,
            category_ids=_category_ids(args.get("categories")),
            source="mcp",
            **fill_media_meta(payload_url),
        )
        if row is None:
            raise ValueError("invalid asset (bad category or payload)")
        row = _with_file_missing(row)
        broadcast_asset_event("create", {"asset": row})
        return {"asset": row}
    if action == "update":
        aid = args.get("asset_id")
        if not isinstance(aid, int):
            raise ValueError("asset_id (integer) is required")
        cats = args.get("categories")
        row = storage.update_asset(
            aid,
            name=str(args["name"]) if args.get("name") is not None else None,
            category_ids=_category_ids(cats) if cats is not None else None,
        )
        if row is None:
            raise ValueError(f"asset {aid} not found (or bad category)")
        row = _with_file_missing(row)
        broadcast_asset_event("update", {"asset": row})
        return {"asset": row}
    if action == "delete":
        aid = args.get("asset_id")
        if not isinstance(aid, int):
            raise ValueError("asset_id (integer) is required")
        if not storage.delete_asset(aid):
            raise ValueError(f"asset {aid} not found")
        broadcast_asset_event("delete", {"id": aid})
        return {"ok": True}
    raise ValueError(f"unknown action {action!r} — valid: create, update, "
                     "delete, create_category, rename_category, delete_category")

def _category_ids(raw) -> list[int]:
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ValueError("categories must be an array of names or ids")
    existing = {c["name"]: c["id"] for c in storage.list_asset_categories()}
    ids: list[int] = []
    for item in raw:
        if isinstance(item, int):
            ids.append(item)
            continue
        name = str(item).strip()
        if not name:
            continue
        cid = existing.get(name)
        if cid is None:
            row = storage.create_asset_category(name)
            cid = row["id"] if row else None
        if cid is not None:
            ids.append(cid)
            existing[name] = cid
    return ids

async def _entries(args: dict) -> dict:
    action = str(args.get("action") or "list")
    pid = str(args.get("project_id") or "default")
    if not storage.project_exists(pid):
        raise ValueError(f"project {pid!r} not found")
    if action == "list":
        rows = storage.list_entries(pid)
        kind = args.get("kind")
        if kind:
            rows = [r for r in rows if r["kind"] == kind]
        return {"entries": rows}
    if action == "upsert":
        kind = str(args.get("kind") or "")
        label = str(args.get("label") or "").strip()
        if kind not in storage.ENTRY_KINDS:
            raise ValueError(
                f"unknown kind {kind!r}; valid: {list(storage.ENTRY_KINDS)}")
        if not label:
            raise ValueError("label is required")
        entry_id = args.get("id")
        row = storage.upsert_entry(
            pid, kind=kind, label=label,
            content=str(args.get("content") or ""),
            metadata=args.get("metadata")
            if isinstance(args.get("metadata"), dict) else None,
            entry_id=int(entry_id) if entry_id is not None else None,
        )
        if row is None:
            raise ValueError(
                "invalid label — must start with a letter/underscore (CJK ok), "
                "then letters/digits/_/-")
        broadcast_entry_event("upsert", pid, {"entry": row})
        return {"entry": row}
    if action == "delete":
        eid = args.get("id")
        if not isinstance(eid, int):
            raise ValueError("id (integer) is required")
        if not storage.delete_entry(pid, eid):
            raise ValueError(f"entry {eid} not found")
        broadcast_entry_event("delete", pid, {"id": eid})
        return {"ok": True}
    raise ValueError(f"unknown action {action!r} — valid: list, upsert, delete")

async def _pick_output(args: dict) -> dict:
    oid = args.get("output_id")
    idx = args.get("picked_index")
    if not isinstance(oid, int):
        raise ValueError("output_id (integer) is required")
    if not isinstance(idx, int) or idx < 1:
        raise ValueError("picked_index (1-based integer, >= 1) is required")
    row = storage.update_output_picked_index(oid, idx)
    if row is None:
        raise ValueError(f"output {oid} not found")
    return {"output": row}


TOOLS: dict[str, dict] = {
    "outputs": {
        "description": (
            "Execution outputs for a project (newest first), optionally filtered by "
            "stage_node_id. Each row carries params_json (the exact parameters of "
            "that run), duration_ms, and a payload_url relative to the ComfyUI "
            "server (e.g. /view?...). latest_only=true with stage_uid or "
            "stage_node_id returns just that stage's most recent output."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string"},
                "stage_node_id": {"type": "string"},
                "stage_uid": {"type": "string"},
                "limit": {"type": "integer", "minimum": 1, "maximum": 100},
                "latest_only": {"type": "boolean"},
            },
            "required": ["project_id"],
            "additionalProperties": False,
        },
        "handler": _outputs,
    },
    "assets": {
        "description": (
            "List asset-library entries (images/video/audio/models) and categories. "
            "category: 'all', 'none' (uncategorized) or a category id. "
            "file_missing=true marks orphaned rows whose file is gone from disk — "
            "worth flagging to the user."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "category": {"type": "string"},
                "limit": {"type": "integer", "minimum": 1, "maximum": 200},
                "offset": {"type": "integer", "minimum": 0},
            },
            "additionalProperties": False,
        },
        "handler": _assets,
    },
    "asset_edit": {
        "description": (
            "Write to the asset library. action 'create' saves media as an "
            "asset: payload_url (e.g. an output's payload_url from the "
            "outputs tool), media_type image/video/audio/model, optional "
            "name and categories (array of category names — created on the "
            "fly — or ids). action 'update' renames an asset (name) and/or "
            "replaces its categories. action 'delete' removes the DB entry "
            "(the underlying file is never deleted). action 'create_category' "
            "adds an empty category; 'rename_category' (category_id or name, "
            "plus new_name) and 'delete_category' (category_id or name — "
            "assets in it are kept, just uncategorised) manage existing ones. "
            "create probes the file server-side, so mime_type/width/height/"
            "size_bytes are filled in. Typical flow: run_stage → wait_stage → "
            "asset_edit create with the output's payload_url so the result "
            "is reusable as @image_N references elsewhere."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {"type": "string",
                           "enum": ["create", "update", "delete",
                                    "create_category", "rename_category",
                                    "delete_category"]},
                "asset_id": {"type": "integer"},
                "category_id": {"type": "integer"},
                "name": {"type": "string"},
                "new_name": {"type": "string"},
                "payload_url": {"type": "string"},
                "media_type": {"type": "string"},
                "categories": {"type": "array"},
            },
            "required": ["action"],
            "additionalProperties": False,
        },
        "handler": _asset_edit,
    },
    "entries": {
        "description": (
            "Read/write the project's entry library (reusable prompt "
            "snippets). Kinds: 'fragment' (plain text fragments) and "
            "'prompt' (full prompt templates; when inserted they expand, and "
            "should only @-mention media slots like @image_0 — not other "
            "entries). action 'list' (optional kind filter), 'upsert' (kind, "
            "label, content, optional metadata; an existing (kind, label) "
            "is updated in place and keeps its id, pass id to rename one — "
            "labels start with a letter/underscore, CJK fine), 'delete' (id). "
            "Entries are per-project (project_id, default 'default')."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {"type": "string",
                           "enum": ["list", "upsert", "delete"]},
                "project_id": {"type": "string"},
                "kind": {"type": "string"},
                "label": {"type": "string"},
                "content": {"type": "string"},
                "metadata": {"type": "object"},
                "id": {"type": "integer"},
            },
            "required": ["action"],
            "additionalProperties": False,
        },
        "handler": _entries,
    },
    "pick_output": {
        "description": (
            "Record which candidate of a stored multi-image output is the "
            "chosen one (sets picked_index on an output row from the outputs "
            "tool; 1-BASED index into its payload images, matching the "
            "cards' selected_index). NOTE: for a stage that is live on the "
            "canvas, prefer set_stage widgets {\"selected_index\": N} — "
            "that drives the card itself (picker pools and image-batch "
            "generators) and updates downstream immediately; pick_output "
            "alone does not refresh an open card. Inspect candidates first "
            "via view_image on the output's payload_json image URLs."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "output_id": {"type": "integer"},
                "picked_index": {"type": "integer"},
            },
            "required": ["output_id", "picked_index"],
            "additionalProperties": False,
        },
        "handler": _pick_output,
    },
}
