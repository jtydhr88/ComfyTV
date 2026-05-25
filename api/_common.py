import logging

from server import PromptServer


routes = PromptServer.instance.routes
_log = logging.getLogger(__name__)


def broadcast_entry_event(event: str, project_id: str, payload: dict) -> None:
    try:
        PromptServer.instance.send_sync(
            "comfytv-entries",
            {"event": event, "project_id": project_id, **payload},
        )
    except Exception:
        _log.exception("[ComfyTV/entries] broadcast failed")
