import json
import logging
import time
import uuid

from aiohttp import web
from server import PromptServer

from ._common import routes
from .capabilities import VERSION
from .mcp_tools import TOOLS

_log = logging.getLogger(__name__)

_BROADCAST_THROTTLE_S = 60.0

_last_activity: float | None = None
_last_broadcast = 0.0


def _mark_activity() -> None:
    global _last_activity, _last_broadcast
    now = time.time()
    _last_activity = now
    if now - _last_broadcast < _BROADCAST_THROTTLE_S:
        return
    _last_broadcast = now
    try:
        PromptServer.instance.send_sync("comfytv-mcp-activity", {})
    except Exception:
        _log.exception("[ComfyTV/mcp] activity broadcast failed")


def _reset_activity() -> None:
    global _last_activity, _last_broadcast
    _last_activity = None
    _last_broadcast = 0.0

SUPPORTED_PROTOCOL_VERSIONS = ("2024-11-05", "2025-03-26", "2025-06-18")
DEFAULT_PROTOCOL_VERSION = "2025-06-18"

INSTRUCTIONS = (
    "Window into ComfyTV, the canvas-app layer running inside this ComfyUI. "
    "Call server_info first. Read tools report state (projects, canvas, "
    "workflows, outputs, assets, jobs, errors). Write tools (add_stage, "
    "set_stage, connect_stages, run_stage) drive the user's live canvas and "
    "are executed BY the open ComfyTV page (Comfy Desktop or a browser) — "
    "without a page they fail with a timeout. The canvas "
    "snapshot is mirrored from that page too, and mirroring only activates "
    "once an MCP client connects — right after connecting, retry get_canvas "
    "after ~10 seconds before concluding no page is open. Typical loop: "
    "get_canvas -> add_stage/set_stage/connect_stages -> run_stage -> poll "
    "get_canvas ('running' -> 'ok'/'error') and outputs. For machine-level "
    "operations (installing nodes, downloading models, running raw ComfyUI "
    "workflows) pair this server with the official comfy-mcp server."
)


def _result(msg_id, result: dict) -> dict:
    return {"jsonrpc": "2.0", "id": msg_id, "result": result}


def _error(msg_id, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": msg_id, "error": {"code": code, "message": message}}


def _initialize(params: dict) -> dict:
    requested = params.get("protocolVersion")
    version = requested if requested in SUPPORTED_PROTOCOL_VERSIONS \
        else DEFAULT_PROTOCOL_VERSION
    return {
        "protocolVersion": version,
        "capabilities": {"tools": {}},
        "serverInfo": {
            "name": "comfytv-mcp",
            "title": "ComfyTV",
            "version": VERSION,
        },
        "instructions": INSTRUCTIONS,
    }


def _tools_list() -> dict:
    return {
        "tools": [
            {
                "name": name,
                "description": spec["description"],
                "inputSchema": spec["inputSchema"],
            }
            for name, spec in TOOLS.items()
        ]
    }


def _payload_to_content(payload) -> list[dict]:
    images = None
    if isinstance(payload, dict):
        images = payload.pop("_images", None)
    blocks = [{
        "type": "text",
        "text": json.dumps(payload, ensure_ascii=False, default=str),
    }]
    for img in images or []:
        blocks.append({
            "type": "image",
            "data": img["data"],
            "mimeType": img.get("mime", "image/jpeg"),
        })
    return blocks


async def _tools_call(params: dict) -> dict | None:
    name = params.get("name")
    spec = TOOLS.get(name)
    if spec is None:
        return None
    arguments = params.get("arguments") or {}
    if not isinstance(arguments, dict):
        arguments = {}
    try:
        payload = await spec["handler"](arguments)
        return {"content": _payload_to_content(payload), "isError": False}
    except (ValueError, TypeError, KeyError) as e:
        return {"content": [{"type": "text", "text": f"{type(e).__name__}: {e}"}],
                "isError": True}
    except Exception as e:
        _log.exception("[ComfyTV/mcp] tool %s failed", name)
        return {"content": [{"type": "text", "text": f"{type(e).__name__}: {e}"}],
                "isError": True}


async def _dispatch(msg: dict) -> dict | None:
    method = msg.get("method")
    msg_id = msg.get("id")
    params = msg.get("params") or {}

    if "id" not in msg:
        return None

    if method == "initialize":
        return _result(msg_id, _initialize(params))
    if method == "ping":
        return _result(msg_id, {})
    if method == "tools/list":
        return _result(msg_id, _tools_list())
    if method == "tools/call":
        outcome = await _tools_call(params)
        if outcome is None:
            return _error(msg_id, -32602, f"unknown tool {params.get('name')!r}")
        return _result(msg_id, outcome)
    if method == "resources/list":
        return _result(msg_id, {"resources": []})
    if method == "resources/templates/list":
        return _result(msg_id, {"resourceTemplates": []})
    if method == "prompts/list":
        return _result(msg_id, {"prompts": []})
    return _error(msg_id, -32601, f"method not found: {method}")


@routes.get("/comfytv/mcp_activity")
async def mcp_activity(_request: web.Request) -> web.Response:
    return web.json_response({
        "active": _last_activity is not None,
        "last_seen": _last_activity,
    })


def _mcp_enabled() -> bool:
    from .. import storage
    try:
        return bool(storage.get_setting("enable-mcp"))
    except Exception:
        _log.exception("[ComfyTV/mcp] enable-mcp lookup failed")
        return False


@routes.post("/comfytv/mcp")
async def mcp_post(request: web.Request) -> web.Response:
    if not _mcp_enabled():
        return web.json_response(
            _error(None, -32000,
                   "ComfyTV MCP is disabled — enable it in the ComfyTV "
                   "sidebar under Settings"),
            status=403,
        )
    _mark_activity()
    try:
        msg = await request.json()
    except Exception:
        return web.json_response(_error(None, -32700, "parse error"), status=400)
    if isinstance(msg, list):
        return web.json_response(
            _error(None, -32600, "batch requests are not supported"), status=400,
        )
    if not isinstance(msg, dict) or msg.get("jsonrpc") != "2.0":
        return web.json_response(
            _error(None, -32600, "invalid JSON-RPC 2.0 message"), status=400,
        )
    response = await _dispatch(msg)
    if response is None:
        return web.Response(status=202)
    http_response = web.json_response(response)
    if msg.get("method") == "initialize" and "result" in response:
        http_response.headers["Mcp-Session-Id"] = uuid.uuid4().hex
    return http_response


@routes.get("/comfytv/mcp")
async def mcp_get(_request: web.Request) -> web.Response:
    return web.json_response(
        {"error": "SSE streams are not supported; POST JSON-RPC messages instead"},
        status=405,
    )


@routes.delete("/comfytv/mcp")
async def mcp_delete(_request: web.Request) -> web.Response:
    return web.Response(status=200)
