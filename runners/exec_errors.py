import functools
import inspect
import time
import traceback
from collections import deque

_MAX_ERRORS = 50
_TRACEBACK_TAIL_CHARS = 2000

_errors: deque[dict] = deque(maxlen=_MAX_ERRORS)


def record_exec_error(*, kind: str, label: str, error: BaseException,
                      project_id: str | None = None) -> None:
    if getattr(error, "_comfytv_exec_recorded", False):
        return
    try:
        error._comfytv_exec_recorded = True
    except AttributeError:
        pass
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


def install_exec_error_recorder(cls, kind: str) -> None:
    if getattr(cls, "_comfytv_exec_recorder", False):
        return
    inner = cls.execute.__func__

    def _record(cls_, error, kwargs):
        project_id = kwargs.get("project_id")
        record_exec_error(
            kind=kind, label=cls_.__name__, error=error,
            project_id=project_id if isinstance(project_id, str) and project_id
            else None,
        )

    if inspect.iscoroutinefunction(inner):
        @functools.wraps(inner)
        async def wrapped(cls_, *args, **kwargs):
            try:
                return await inner(cls_, *args, **kwargs)
            except Exception as e:
                _record(cls_, e, kwargs)
                raise
    else:
        @functools.wraps(inner)
        def wrapped(cls_, *args, **kwargs):
            try:
                return inner(cls_, *args, **kwargs)
            except Exception as e:
                _record(cls_, e, kwargs)
                raise

    cls.execute = classmethod(wrapped)
    cls._comfytv_exec_recorder = True


def list_exec_errors(limit: int = 10) -> list[dict]:
    limit = max(1, min(int(limit), _MAX_ERRORS))
    return list(_errors)[-limit:][::-1]


def clear_exec_errors() -> None:
    _errors.clear()
