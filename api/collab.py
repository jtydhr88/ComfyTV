import asyncio
import hashlib
import json
import logging
import os
import re
import uuid

from aiohttp import web

from ._common import routes
from .. import storage

PROTOCOL_VERSION = 1
SESSION_COOKIE = "comfytv_sid"
COOKIE_MAX_AGE_S = 365 * 24 * 3600
PRESENCE_KEYS = ("cursor", "selected", "viewport", "idle")
HELLO_TIMEOUT_S = 10.0
MAX_MESSAGE_BYTES = 4_000_000
SEND_QUEUE_SIZE = 64
EDIT_OPS_KEEP = 1000
FLUSH_DEBOUNCE_S = 2.0
_SID_PAT = re.compile(r"[0-9a-f]{8,64}")

_peers: dict[str, dict] = {}
_canvases: dict[str, list] = {}
_edits: dict[str, dict] = {}
_edit_loaded: set[str] = set()
_dirty_docs: set[str] = set()
_flush_task: asyncio.Task | None = None
_log = logging.getLogger(__name__)


def _peer_id(sid: str) -> str:
    return hashlib.sha256(sid.encode()).hexdigest()[:16]


def _clean_name(value) -> str:
    return str(value or "").strip()[:40] or "anon"


def _clean_pid(value) -> str:
    return str(value or "")[:128]


def _summary(peer: dict) -> dict:
    return {
        "conn_id": peer["conn_id"],
        "peer_id": _peer_id(peer["sid"]),
        "name": peer["name"],
        "color": peer["color"],
        "project_id": peer["project_id"],
        "presence": peer["presence"],
    }


def _enqueue(peer: dict, message: dict) -> None:
    try:
        peer["queue"].put_nowait(message)
    except asyncio.QueueFull:
        _log.debug("[ComfyTV/collab] queue full, dropping for %s",
                   peer["conn_id"])


async def _writer_loop(peer: dict) -> None:
    ws: web.WebSocketResponse = peer["ws"]
    try:
        while True:
            message = await peer["queue"].get()
            await ws.send_json(message)
    except Exception:
        pass


def _broadcast(message: dict, skip: str | None = None,
               project_id: str | None = None) -> None:
    for conn_id, peer in list(_peers.items()):
        if conn_id == skip or peer["ws"].closed:
            continue
        if project_id is not None and peer["project_id"] != project_id:
            continue
        _enqueue(peer, message)


def _mark_dirty(project_id: str) -> None:
    global _flush_task
    _dirty_docs.add(project_id)
    if _flush_task is None or _flush_task.done():
        _flush_task = asyncio.ensure_future(_flush_after_debounce())


async def _flush_after_debounce() -> None:
    await asyncio.sleep(FLUSH_DEBOUNCE_S)
    await flush_docs_now()


async def flush_docs_now() -> None:
    loop = asyncio.get_event_loop()
    for pid in list(_dirty_docs):
        _dirty_docs.discard(pid)
        edit = _edits.get(pid)
        if edit is None or "workflow" not in edit:
            continue
        state = {"workflow": edit["workflow"],
                 "blob_clock": edit["blob_clock"],
                 "clock": edit["clock"],
                 "ops": [[c, o] for c, o in edit["ops"]]}
        try:
            await loop.run_in_executor(None, storage.save_collab_doc,
                                       pid, state)
        except Exception:
            _log.exception("[ComfyTV/collab] doc flush failed for %s", pid)


async def _load_edit(project_id: str) -> dict | None:
    if project_id in _edits:
        return _edits[project_id]
    if not project_id or project_id in _edit_loaded:
        return None
    _edit_loaded.add(project_id)
    loop = asyncio.get_event_loop()
    try:
        state = await loop.run_in_executor(None, storage.load_collab_doc,
                                           project_id)
    except Exception:
        _log.exception("[ComfyTV/collab] doc load failed for %s", project_id)
        return None
    if not state or not isinstance(state.get("workflow"), dict):
        return None
    edit = {
        "workflow": state["workflow"],
        "blob_clock": int(state.get("blob_clock") or 0),
        "clock": int(state.get("clock") or 0),
        "ops": [(int(c), o) for c, o in state.get("ops") or []],
        "editors": {},
        "scribe": None,
    }
    _edits[project_id] = edit
    return edit


def _docs_summary() -> dict[str, int]:
    return {pid: e["clock"] for pid, e in _edits.items() if "workflow" in e}


def _update_scribe(project_id: str, edit: dict) -> None:
    alive = [c for c in edit["editors"] if c in _peers]
    new = alive[0] if alive else None
    old = edit.get("scribe")
    if new == old:
        return
    edit["scribe"] = new
    if old and old in _peers:
        _enqueue(_peers[old], {"type": "edit_scribe",
                               "project_id": project_id, "you": False})
    if new:
        _enqueue(_peers[new], {"type": "edit_scribe",
                               "project_id": project_id, "you": True})


def _send_cached_canvas(peer: dict) -> None:
    pid = peer["project_id"]
    stages = _canvases.get(pid)
    if stages is not None and pid in _edits:
        _enqueue(peer, {"type": "peer-canvas", "project_id": pid,
                        "stages": stages})


def peers_summary() -> list[dict]:
    return [_summary(p) for p in _peers.values()]


def clear_peers() -> None:
    _peers.clear()
    _canvases.clear()
    _edits.clear()
    _edit_loaded.clear()
    _dirty_docs.clear()


def _testing() -> bool:
    return os.environ.get("COMFYTV_TESTING") == "1"


def _collab_enabled() -> bool:
    try:
        return bool(storage.get_setting("enable-collab"))
    except Exception:
        _log.exception("[ComfyTV/collab] enable-collab lookup failed")
        return False


def _disabled_response() -> web.Response:
    return web.json_response(
        {"error": "collaboration is disabled — enable the experimental "
                  "enable-collab setting in the ComfyTV sidebar"},
        status=403)


@routes.get("/comfytv/collab/session")
async def collab_session(request: web.Request) -> web.Response:
    if not _collab_enabled():
        return _disabled_response()
    sid = request.cookies.get(SESSION_COOKIE) or ""
    if not _SID_PAT.fullmatch(sid):
        sid = uuid.uuid4().hex
    resp = web.json_response({"sid": sid})
    resp.set_cookie(SESSION_COOKIE, sid, max_age=COOKIE_MAX_AGE_S,
                    httponly=True, samesite="Lax", path="/")
    return resp


@routes.get("/comfytv/collab/peers")
async def collab_peers(_request: web.Request) -> web.Response:
    if not _collab_enabled():
        return _disabled_response()
    return web.json_response({"peers": peers_summary(),
                              "docs": _docs_summary()})


def _handle_hello(conn_id: str, sid: str, ws: web.WebSocketResponse,
                  data: dict) -> dict | None:
    if data.get("protocol") != PROTOCOL_VERSION:
        return None
    peer = {
        "conn_id": conn_id,
        "sid": sid,
        "name": _clean_name(data.get("name")),
        "color": str(data.get("color") or "")[:24],
        "project_id": _clean_pid(data.get("project_id")),
        "presence": {},
        "ws": ws,
        "queue": asyncio.Queue(maxsize=SEND_QUEUE_SIZE),
    }
    peer["writer"] = asyncio.ensure_future(_writer_loop(peer))
    _peers[conn_id] = peer
    _enqueue(peer, {
        "type": "welcome", "conn_id": conn_id, "peer_id": _peer_id(sid),
        "protocol": PROTOCOL_VERSION,
        "peers": [_summary(p) for p in _peers.values()
                  if p["conn_id"] != conn_id],
        "docs": _docs_summary(),
    })
    _broadcast({"type": "peer-join", "peer": _summary(peer)}, skip=conn_id)
    _send_cached_canvas(peer)
    return peer


async def _handle_edit_message(peer: dict, conn_id: str, mtype: str,
                               data: dict) -> None:
    pid = _clean_pid(data.get("project_id"))
    if not pid:
        return
    if mtype == "edit_put":
        workflow = data.get("workflow")
        if not isinstance(workflow, dict):
            return
        edit = await _load_edit(pid)
        created = edit is None or "workflow" not in edit
        if not created and conn_id not in edit["editors"]:
            return  # replacing an existing doc requires membership
        if edit is None:
            edit = _edits.setdefault(pid, {"clock": 0, "ops": [],
                                           "editors": {}, "scribe": None})
        # never truncate ops the sender had not applied when it serialized
        base = data.get("base_clock")
        if not isinstance(base, int) or created:
            base = edit["clock"]
        base = max(0, min(base, edit["clock"]))
        edit["workflow"] = workflow
        edit["blob_clock"] = base
        edit["ops"] = [(c, o) for c, o in edit["ops"] if c > base]
        edit["editors"][conn_id] = None
        _mark_dirty(pid)
        if created:
            _broadcast({"type": "edit_state", "project_id": pid,
                        "clock": edit["clock"]})
        _update_scribe(pid, edit)
    elif mtype == "join_edit":
        edit = await _load_edit(pid)
        if edit is None or "workflow" not in edit:
            _enqueue(peer, {"type": "edit_doc", "project_id": pid,
                            "workflow": None})
            return
        edit["editors"][conn_id] = None
        _enqueue(peer, {
            "type": "edit_doc", "project_id": pid,
            "workflow": edit["workflow"], "clock": edit["clock"],
            "ops": [o for c, o in edit["ops"] if c > edit["blob_clock"]],
        })
        _update_scribe(pid, edit)
    elif mtype == "edit_ops":
        edit = _edits.get(pid)
        ops = data.get("ops")
        if (edit is None or conn_id not in edit["editors"]
                or not isinstance(ops, list) or not ops):
            return
        edit["clock"] += 1
        edit["ops"].append((edit["clock"], ops))
        if len(edit["ops"]) > EDIT_OPS_KEEP:
            edit["ops"] = edit["ops"][-EDIT_OPS_KEEP:]
        _mark_dirty(pid)
        message = {"type": "edit_ops", "project_id": pid,
                   "clock": edit["clock"], "conn_id": conn_id, "ops": ops}
        for editor_conn in list(edit["editors"]):
            editor = _peers.get(editor_conn)
            if editor is None:
                edit["editors"].pop(editor_conn, None)
                continue
            _enqueue(editor, message)


async def _handle_message(peer: dict | None, conn_id: str, sid: str,
                          ws: web.WebSocketResponse, data: dict) -> dict | None:
    mtype = data.get("type")
    if mtype == "hello":
        if peer is not None:
            return peer
        await _load_edit(_clean_pid(data.get("project_id")))
        new_peer = _handle_hello(conn_id, sid, ws, data)
        if new_peer is None:
            await ws.send_json({"type": "incompatible",
                                "server_protocol": PROTOCOL_VERSION})
            await ws.close()
        return new_peer
    if peer is None:
        return None
    if mtype in ("edit_put", "join_edit", "edit_ops"):
        await _handle_edit_message(peer, conn_id, mtype, data)
    elif mtype == "exec":
        pid = _clean_pid(data.get("project_id"))
        edit = _edits.get(pid)
        if edit is not None and conn_id in edit["editors"]:
            message = {"type": "peer-exec", "project_id": pid,
                       "conn_id": conn_id,
                       **{k: data[k] for k in ("event", "node", "value",
                                               "max", "output") if k in data}}
            for editor_conn in list(edit["editors"]):
                if editor_conn == conn_id:
                    continue
                editor = _peers.get(editor_conn)
                if editor is not None:
                    _enqueue(editor, message)
    elif mtype == "canvas":
        pid = _clean_pid(data.get("project_id"))
        edit = _edits.get(pid)
        stages = data.get("stages")
        if (edit is not None and edit.get("scribe") == conn_id
                and isinstance(stages, list)):
            _canvases[pid] = stages
            _broadcast({"type": "peer-canvas", "project_id": pid,
                        "conn_id": conn_id, "stages": stages},
                       skip=conn_id, project_id=pid)
    elif mtype == "presence":
        if "project_id" in data:
            prev_pid = peer["project_id"]
            peer["project_id"] = _clean_pid(data.get("project_id"))
            if peer["project_id"] != prev_pid:
                _send_cached_canvas(peer)
                switched = await _load_edit(peer["project_id"])
                if switched is not None and "workflow" in switched:
                    _enqueue(peer, {"type": "edit_state",
                                    "project_id": peer["project_id"],
                                    "clock": switched["clock"]})
        peer["presence"] = {k: data[k] for k in PRESENCE_KEYS if k in data}
        _broadcast({
            "type": "peer-presence", "conn_id": conn_id,
            "project_id": peer["project_id"], **peer["presence"],
        }, skip=conn_id)
    elif mtype == "update":
        if "name" in data:
            peer["name"] = _clean_name(data.get("name"))
        if "color" in data:
            peer["color"] = str(data.get("color") or "")[:24]
        _broadcast({"type": "peer-update", "peer": _summary(peer)},
                   skip=conn_id)
    return peer


async def _hello_watchdog(ws: web.WebSocketResponse, joined) -> None:
    await asyncio.sleep(HELLO_TIMEOUT_S)
    if not joined() and not ws.closed:
        await ws.close()


@routes.get("/comfytv/collab")
async def collab_ws(request: web.Request):
    if not _collab_enabled():
        return _disabled_response()
    ws = web.WebSocketResponse(heartbeat=30)
    await ws.prepare(request)
    sid = request.cookies.get(SESSION_COOKIE) or ""
    if not _SID_PAT.fullmatch(sid):
        sid = ""
    if not sid and _testing():
        sid = str(request.query.get("sid") or "")[:64]
    if not sid:
        sid = uuid.uuid4().hex
    conn_id = uuid.uuid4().hex[:12]
    peer: dict | None = None
    watchdog = asyncio.ensure_future(_hello_watchdog(ws, lambda: peer is not None))
    try:
        async for msg in ws:
            if msg.type != web.WSMsgType.TEXT:
                continue
            if len(msg.data) > MAX_MESSAGE_BYTES:
                continue
            try:
                data = json.loads(msg.data)
            except Exception:
                continue
            if not isinstance(data, dict):
                continue
            peer = await _handle_message(peer, conn_id, sid, ws, data)
    finally:
        watchdog.cancel()
        removed = _peers.pop(conn_id, None)
        if removed is not None:
            removed["writer"].cancel()
            for pid, edit in _edits.items():
                edit["editors"].pop(conn_id, None)
                _update_scribe(pid, edit)
            _broadcast({"type": "peer-leave", "conn_id": conn_id})
    return ws
