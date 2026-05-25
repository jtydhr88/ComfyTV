import logging
import time


def _emit_progress(cls, value: int, total: int, text: str = "") -> None:
    try:
        from comfy.utils import ProgressBar
        pbar = ProgressBar(total)
        pbar.update_absolute(value, total)
        if text:
            from server import PromptServer
            node_id = getattr(cls.hidden, "unique_id", None) if hasattr(cls, "hidden") else None
            if node_id is not None:
                PromptServer.instance.send_progress_text(text, node_id)
    except Exception as e:
        logging.warning("[ComfyTV] progress emit failed: %s", e)


def _fake_run_ticks(cls, steps: int = 4, delay_s: float = 0.12) -> None:
    import comfy.model_management
    for i in range(steps):
        comfy.model_management.throw_exception_if_processing_interrupted()
        _emit_progress(cls, i, steps, text=f"step {i + 1}/{steps}")
        time.sleep(delay_s)
