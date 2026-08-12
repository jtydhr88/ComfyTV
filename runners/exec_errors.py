import time
import traceback
from collections import deque

_MAX_ERRORS = 50
_TRACEBACK_TAIL_CHARS = 2000

_errors: deque[dict] = deque(maxlen=_MAX_ERRORS)


def record_exec_error(*, kind: str, label: str, error: BaseException,
                      project_id: str | None = None) -> None:
    tb = traceback.format_exc()
    if len(tb) > _TRACEBACK_TAIL_CHARS:
        tb = tb[-_TRACEBACK_TAIL_CHARS:]
    _errors.append({
        "ts": time.time(),
        "kind": kind,
        "label": label,
        "project_id": project_id,
        "error_type": type(error).__name__,
        "error_text": str(error),
        "traceback_tail": tb,
    })


def list_exec_errors(limit: int = 10) -> list[dict]:
    limit = max(1, min(int(limit), _MAX_ERRORS))
    return list(_errors)[-limit:][::-1]


def clear_exec_errors() -> None:
    _errors.clear()
