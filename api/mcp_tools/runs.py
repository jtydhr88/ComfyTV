import asyncio
import re
import time
from ... import storage
from ..canvas_state import get_canvas_state

from . import _shared
from ._shared import _command_payload
from .bot_tools import _maybe_ask_run_approval


_RUN_STARTED: dict[str, float] = {}

_RUN_STARTED_MAX = 500

async def _run_stage(args: dict) -> dict:
    node = args.get("node")
    if not node:
        raise ValueError("node is required (stage uid or graph node id)")
    declined = await _maybe_ask_run_approval(f"Run stage {node}?")
    if declined is not None:
        return declined
    payload = _command_payload(args, ("project_id",))
    payload["node"] = str(node)
    started_at = time.time()
    result = await _shared.submit_command("run_stage", payload, timeout=60.0)
    if isinstance(result, dict) and result.get("started"):
        uid = str(result.get("uid") or "")
        if uid:
            _RUN_STARTED[uid] = started_at
            while len(_RUN_STARTED) > _RUN_STARTED_MAX:
                _RUN_STARTED.pop(next(iter(_RUN_STARTED)))
    return result

_WAIT_POLL_S = 1.0

_WAIT_DEFAULT_S = 25.0

_WAIT_MAX_S = 170.0

def _mirror_stage(project_id, node_ref: str):
    snap = get_canvas_state(project_id)
    if not snap.get("available"):
        raise ValueError(str(snap.get("reason") or "canvas mirror unavailable"))
    for s in snap.get("stages", []):
        uid = str(s.get("uid") or "")
        if str(s.get("graph_node_id")) == node_ref or uid == node_ref \
                or (len(node_ref) >= 8 and uid.startswith(node_ref)):
            return snap["project_id"], s
    raise ValueError(f"stage {node_ref!r} not found on the mirrored canvas")

def _error_is_current(run: dict, initial_run: dict,
                      run_started: float | None) -> bool:
    if run != initial_run:
        return True
    changed = run.get("changed_at")
    return (run_started is not None
            and isinstance(changed, (int, float))
            and changed >= run_started)

def _output_created_ts(row) -> float | None:
    from datetime import datetime, timezone
    raw = (row or {}).get("created_at")
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(str(raw))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.timestamp()

async def _wait_stage(args: dict) -> dict:
    node = args.get("node")
    if not node:
        raise ValueError("node is required (stage uid or graph node id)")
    try:
        timeout_s = float(args.get("timeout_s", _WAIT_DEFAULT_S))
    except (TypeError, ValueError):
        raise ValueError("timeout_s must be a number")
    timeout_s = max(2.0, min(timeout_s, _WAIT_MAX_S))

    pid, stage = _mirror_stage(args.get("project_id"), str(node))
    uid = str(stage.get("uid") or "")
    initial_run = dict(stage.get("last_run") or {})
    run_started = _RUN_STARTED.get(uid)

    after = args.get("after_output_id")
    if after is not None:
        baseline = int(after)
    else:
        row = await asyncio.to_thread(storage.latest_output_by_uid, pid, uid)
        baseline = int(row["id"]) if row else 0

    def _is_fresh(row) -> bool:
        if not row:
            return False
        if int(row["id"]) > baseline:
            return True
        if run_started is None:
            return False
        created = _output_created_ts(row)
        return created is not None and created >= run_started

    t0 = time.monotonic()
    while True:
        row = await asyncio.to_thread(storage.latest_output_by_uid, pid, uid)
        if _is_fresh(row):
            return {
                "status": "done",
                "output": row,
                "waited_s": round(time.monotonic() - t0, 1),
            }
        try:
            _, fresh = _mirror_stage(pid, uid)
        except ValueError:
            fresh = None
        if fresh is not None:
            run = dict(fresh.get("last_run") or {})
            if run.get("status") == "error" \
                    and _error_is_current(run, initial_run, run_started):
                return {
                    "status": "error",
                    "error": run.get("error") or "stage run failed",
                    "waited_s": round(time.monotonic() - t0, 1),
                }
        if time.monotonic() - t0 >= timeout_s:
            return {
                "status": "running",
                "after_output_id": baseline,
                "waited_s": round(time.monotonic() - t0, 1),
                "hint": "still running — call wait_stage again with the same "
                        "node and after_output_id to keep waiting",
            }
        await asyncio.sleep(_WAIT_POLL_S)


TOOLS: dict[str, dict] = {
    "run_stage": {
        "description": (
            "Queue a run of a stage on the live canvas, exactly like clicking its "
            "Run button (upstream snapshots, @mentions and asset refs all apply). "
            "Returns as soon as the run is queued — then call wait_stage on the "
            "same node to block until it finishes instead of polling. node is a "
            "stage uid or graph_node_id. Requires an open ComfyTV page in Desktop or a browser."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {"type": "string"},
                "project_id": {"type": "string"},
            },
            "required": ["node"],
            "additionalProperties": False,
        },
        "handler": _run_stage,
    },
    "wait_stage": {
        "description": (
            "Block until a stage produces a new output or its run errors — the "
            "efficient way to wait after run_stage (no polling). Waits up to "
            "timeout_s (default 25, max 170) and returns {status: 'done', "
            "output} on success, {status: 'error', error} on failure, or "
            "{status: 'running', after_output_id} on timeout — in that case "
            "just call wait_stage again with the returned after_output_id to "
            "keep waiting (long renders can take many minutes; keep re-calling "
            "until done). If your MCP client enforces its own per-call tool "
            "timeout, pass a timeout_s safely below it (e.g. 20) and re-call "
            "instead of one long wait. node is a stage uid or graph_node_id."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {"type": "string"},
                "timeout_s": {"type": "number"},
                "after_output_id": {"type": "integer"},
                "project_id": {"type": "string"},
            },
            "required": ["node"],
            "additionalProperties": False,
        },
        "handler": _wait_stage,
    },
}
