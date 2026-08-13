import asyncio
import logging
import uuid

from aiohttp import web
from server import PromptServer

from ._common import routes
from .canvas_state import get_mirror_client_id

_log = logging.getLogger(__name__)

COMMAND_EVENT = "comfytv-mcp-command"
DEFAULT_TIMEOUT_S = 15.0

_pending: dict[str, asyncio.Future] = {}


async def submit_command(action: str, payload: dict,
                         timeout: float = DEFAULT_TIMEOUT_S) -> dict:
    command_id = uuid.uuid4().hex
    loop = asyncio.get_running_loop()
    future: asyncio.Future = loop.create_future()
    _pending[command_id] = future

    message = {"id": command_id, "action": action, **payload}
    project_id = payload.get("project_id")
    target = get_mirror_client_id(project_id if isinstance(project_id, str) else None)
    if target:
        message["target_client_id"] = target

    try:
        PromptServer.instance.send_sync(COMMAND_EVENT, message)
        return await asyncio.wait_for(future, timeout)
    except asyncio.TimeoutError:
        raise ValueError(
            f"no ComfyTV tab picked up the {action!r} command within "
            f"{timeout:.0f}s — is the ComfyTV page open in a browser?"
        )
    finally:
        _pending.pop(command_id, None)


def pending_count() -> int:
    return len(_pending)


def clear_pending() -> None:
    for future in _pending.values():
        if not future.done():
            future.cancel()
    _pending.clear()


@routes.post("/comfytv/mcp_command_result")
async def post_command_result(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception as e:
        return web.json_response({"error": f"invalid json: {e}"}, status=400)
    command_id = body.get("command_id")
    if not command_id:
        return web.json_response({"error": "command_id required"}, status=400)
    future = _pending.get(command_id)
    if future is None or future.done():
        return web.json_response({"ok": False, "reason": "unknown or expired command"})
    if body.get("ok"):
        result = body.get("result")
        future.set_result(result if isinstance(result, dict) else {})
    else:
        error = body.get("error")
        future.set_exception(ValueError(
            str(error) if error else "command failed in the ComfyTV tab"
        ))
    return web.json_response({"ok": True})
