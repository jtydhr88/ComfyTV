import contextvars
from typing import Optional

_LAST_INVOKE_DURATION_MS: contextvars.ContextVar[Optional[int]] = contextvars.ContextVar(
    "comfytv_last_invoke_duration_ms", default=None
)


def reset_invoke_duration() -> None:
    _LAST_INVOKE_DURATION_MS.set(None)


def set_invoke_duration(ms: int) -> None:
    _LAST_INVOKE_DURATION_MS.set(int(ms))


def consume_invoke_duration() -> Optional[int]:
    value = _LAST_INVOKE_DURATION_MS.get()
    _LAST_INVOKE_DURATION_MS.set(None)
    return value
