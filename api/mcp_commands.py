import asyncio
import logging
import time
import uuid

from aiohttp import web
from server import PromptServer

from ._common import routes
from .canvas_state import STALE_AFTER_S, get_mirror_client_id, get_mirror_entry

_log = logging.getLogger(__name__)

COMMAND_EVENT = "comfytv-mcp-command"
DEFAULT_TIMEOUT_S = 15.0

_pending: dict[str, asyncio.Future] = {}


def _timeout_message(action: str, timeout: float, project_id: str | None) -> str:
    entry = get_mirror_entry(project_id)
    if entry is not None:
        age = time.time() - entry["received_at"]
        if age <= STALE_AFTER_S:
            return (
                f"a ComfyTV tab is mirroring the canvas (last update "
                f"{age:.0f}s ago) but did not pick up the {action!r} command "
                f"within {timeout:.0f}s — its websocket connection is likely "
                "broken; ask the user to reload the ComfyTV page"
            )
    return (
        f"no ComfyTV tab picked up the {action!r} command within "
        f"{timeout:.0f}s — is the ComfyTV page open in a browser?"
    )


async def submit_command(action: str, payload: dict,
                         timeout: float = DEFAULT_TIMEOUT_S) -> dict:
    project_id = payload.get("project_id")
    project_id = project_id if isinstance(project_id, str) else None

    entry = get_mirror_entry(project_id)
    if entry is not None and entry.get("ws_connected") is False:
        raise ValueError(
            "the ComfyTV tab mirroring this project reports its websocket is "
            "disconnected — commands cannot reach it; ask the user to reload "
            "the ComfyTV page"
        )

    command_id = uuid.uuid4().hex
    loop = asyncio.get_running_loop()
    future: asyncio.Future = loop.create_future()
    _pending[command_id] = future

    message = {"id": command_id, "action": action, **payload}
    target = get_mirror_client_id(project_id)
    if target:
        message["target_client_id"] = target

    try:
        PromptServer.instance.send_sync(COMMAND_EVENT, message)
        return await asyncio.wait_for(future, timeout)
    except asyncio.TimeoutError:
        raise ValueError(_timeout_message(action, timeout, project_id))
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
