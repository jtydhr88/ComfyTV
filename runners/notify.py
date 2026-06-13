import logging

_log = logging.getLogger(__name__)


def notify_toast(severity: str, summary: str, detail: str = "", life_ms: int = 8000) -> None:
    try:
        from server import PromptServer
        PromptServer.instance.send_sync("comfytv-toast", {
            "severity": severity,
            "summary":  summary,
            "detail":   detail,
            "life":     life_ms,
        })
    except Exception as e:
        _log.debug("[ComfyTV] toast emit failed: %s", e)
