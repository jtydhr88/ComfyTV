import asyncio
import logging
import time

from aiohttp import web
from server import PromptServer

from ..bot.command_relay import CommandRelay
from ._common import routes
from .canvas_state import STALE_AFTER_S, get_mirror_client_id, get_mirror_entry

_log = logging.getLogger(__name__)

COMMAND_EVENT = "comfytv-mcp-command"
DEFAULT_TIMEOUT_S = 15.0

RELAY = CommandRelay(COMMAND_EVENT, lambda event, data, sid: PromptServer.instance.send_sync(event, data, sid))


def _timeout_message(action: str, timeout: float, project_id: str | None) -> str:
    entry = get_mirror_entry(project_id)
    if entry is not None:
        age = time.time() - entry["received_at"]
        if age <= STALE_AFTER_S:
            return (
                f"a ComfyTV page is mirroring the canvas (last update "
                f"{age:.0f}s ago) but did not pick up the {action!r} command "
                f"within {timeout:.0f}s — its websocket connection is likely "
                "broken; ask the user to reload the ComfyTV page. The command "
                "may still complete, so check get_canvas before retrying"
            )
    return (
        f"no ComfyTV page picked up the {action!r} command within "
        f"{timeout:.0f}s — is ComfyTV open in Desktop or a browser?"
    )


async def submit_command(action: str, payload: dict,
                         timeout: float = DEFAULT_TIMEOUT_S) -> dict:
    project_id = payload.get("project_id")
    project_id = project_id if isinstance(project_id, str) else None

    entry = get_mirror_entry(project_id)
    if entry is not None and entry.get("ws_connected") is False:
        raise ValueError(
            "the ComfyTV page mirroring this project reports its websocket is "
            "disconnected — commands cannot reach it; ask the user to reload "
            "the ComfyTV page"
        )

    message = {"action": action, **payload}
    target = get_mirror_client_id(project_id)
    if target:
        message["target_client_id"] = target
    try:
        return await RELAY.submit(message, sid=target, timeout=timeout)
    except asyncio.TimeoutError:
        raise ValueError(_timeout_message(action, timeout, project_id))


@routes.post("/comfytv/mcp_command_result")
async def post_command_result(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception as e:
        return web.json_response({"error": f"invalid json: {e}"}, status=400)
    if not isinstance(body, dict):
        return web.json_response({"error": "body must be a JSON object"}, status=400)
    out, status = RELAY.resolve(body, "command failed in the ComfyTV page")
    return web.json_response(out, status=status)
