import asyncio
import re
import time
from urllib.parse import urlencode
from ..canvas_state import get_canvas_state

from . import _shared
from ._shared import _command_payload
from .bot_tools import _maybe_ask_run_approval


async def _get_canvas(args: dict) -> dict:
    return get_canvas_state(args.get("project_id") or None)

_GRAPH_OPS = ("add_node", "remove_node", "set_widget", "set_title",
              "connect", "disconnect", "set_mode", "clone", "set_color",
              "set_review", "create_group", "collapse", "pin",
              "convert_to_subgraph", "unpack_subgraph")

_CANVAS_COMMANDS = (
    "Comfy.Undo",
    "Comfy.Redo",
    "Comfy.SaveWorkflow",
    "Comfy.Canvas.FitView",
    "Comfy.Canvas.ResetView",
    "Comfy.Interrupt",
    "Comfy.ClearPendingTasks",
    "Comfy.RefreshNodeDefinitions",
    "Comfy.Graph.GroupSelectedNodes",
)

async def _canvas_command(args: dict) -> dict:
    command = str(args.get("command") or "")
    if command not in _CANVAS_COMMANDS:
        raise ValueError(
            f"command {command!r} is not allowed — allowed: "
            f"{', '.join(_CANVAS_COMMANDS)}")
    nodes = args.get("nodes")
    if nodes is not None and (
            not isinstance(nodes, list)
            or not all(isinstance(n, (str, int)) for n in nodes)):
        raise ValueError("nodes must be an array of node ids")
    payload = _command_payload(args, ("project_id", "nodes"))
    payload["command"] = command
    return await _shared.submit_command("canvas_command", payload)

async def _canvas_focus(args: dict) -> dict:
    node = str(args.get("node") or "")
    if not node:
        raise ValueError("node is required (a graph node id from graph_get)")
    payload = _command_payload(args, ("project_id",))
    payload["node"] = node
    return await _shared.submit_command("canvas_focus", payload)

async def _graph_get(args: dict) -> dict:
    return await _shared.submit_command(
        "graph_get", _command_payload(args, ("project_id",)))

async def _graph_edit(args: dict) -> dict:
    ops = args.get("ops")
    if not isinstance(ops, list) or not ops:
        raise ValueError("ops must be a non-empty array of {op, ...} objects")
    for i, op in enumerate(ops):
        if not isinstance(op, dict) or str(op.get("op") or "") not in _GRAPH_OPS:
            raise ValueError(
                f"ops[{i}] must be an object with op one of: "
                f"{', '.join(_GRAPH_OPS)}")
    payload = _command_payload(args, ("project_id",))
    payload["ops"] = ops
    return await _shared.submit_command("graph_edit", payload)

def _history_outputs(entry: dict) -> list[str]:
    urls: list[str] = []
    for node_out in (entry.get("outputs") or {}).values():
        if not isinstance(node_out, dict):
            continue
        for files in node_out.values():
            if not isinstance(files, list):
                continue
            for f in files:
                if not isinstance(f, dict) or not f.get("filename"):
                    continue
                urls.append("/view?" + urlencode({
                    "filename": f["filename"],
                    "subfolder": f.get("subfolder") or "",
                    "type": f.get("type") or "output",
                }))
    return urls

def _history_error_message(status: dict) -> str:
    for msg in status.get("messages") or []:
        if (isinstance(msg, (list, tuple)) and len(msg) == 2
                and msg[0] == "execution_error"):
            data = msg[1] or {}
            return (f"{data.get('node_type')} (node {data.get('node_id')}): "
                    f"{data.get('exception_message')}")
    return "execution failed"

async def _graph_run(args: dict) -> dict:
    prompt_id = str(args.get("prompt_id") or "")
    base: dict = {}
    if not prompt_id:
        declined = await _maybe_ask_run_approval("Run the current graph?")
        if declined is not None:
            return declined
        base = await _shared.submit_command(
            "graph_run", _command_payload(args, ("project_id",)), timeout=60.0)
        prompt_id = str(base.get("prompt_id") or "")
        if not prompt_id:
            return base

    wait_s = args.get("wait_s")
    wait_s = 60.0 if wait_s is None else max(0.0, float(wait_s))
    wait_s = min(wait_s, 170.0)

    from server import PromptServer
    queue = getattr(PromptServer.instance, "prompt_queue", None)
    if queue is None:
        return {**base, "prompt_id": prompt_id, "status": "queued",
                "note": "history unavailable in this server"}

    deadline = time.monotonic() + wait_s
    while True:
        hist = queue.get_history(prompt_id=prompt_id) or {}
        entry = hist.get(prompt_id)
        if entry:
            status = entry.get("status") or {}
            out = {**base, "prompt_id": prompt_id,
                   "outputs": _history_outputs(entry)}
            if status.get("status_str") == "error":
                out["status"] = "error"
                out["error"] = _history_error_message(status)
            else:
                out["status"] = "done"
            return out
        if time.monotonic() >= deadline:
            return {**base, "prompt_id": prompt_id, "status": "running",
                    "hint": "re-call graph_run with this prompt_id to keep "
                            "waiting"}
        await asyncio.sleep(1.0)

async def _arrange_canvas(args: dict) -> dict:
    payload = _command_payload(args, ("project_id",))
    margin = args.get("margin")
    if margin is not None:
        try:
            payload["margin"] = float(margin)
        except (TypeError, ValueError):
            raise ValueError("margin must be a number")
    layout = args.get("layout")
    if layout is not None:
        if layout not in ("horizontal", "vertical"):
            raise ValueError("layout must be 'horizontal' or 'vertical'")
        payload["layout"] = layout
    return await _shared.submit_command("arrange_canvas", payload, timeout=30.0)


TOOLS: dict[str, dict] = {
    "get_canvas": {
        "description": (
            "Snapshot of the user's live ComfyTV canvas (stages, prompts, selected "
            "workflows, connections, last-run status), mirrored from an open ComfyTV "
            "page (Desktop or browser). Mirroring activates lazily on first MCP contact — right after "
            "connecting, retry once after ~10 seconds. available=false after that "
            "means no page is open or it never reported; stale=true means the page "
            "stopped updating (likely closed). Never guess canvas contents when "
            "unavailable — say so instead."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"project_id": {"type": "string"}},
            "additionalProperties": False,
        },
        "handler": _get_canvas,
    },
    "canvas_command": {
        "description": (
            "Execute a whitelisted native canvas command in the open ComfyTV page: "
            "Comfy.Undo / Comfy.Redo (a whole graph_edit call is one undo "
            "step), Comfy.SaveWorkflow (persist the canvas to its file), "
            "Comfy.Canvas.FitView / Comfy.Canvas.ResetView, Comfy.Interrupt "
            "(stop the current run), Comfy.ClearPendingTasks, "
            "Comfy.RefreshNodeDefinitions (reload node classes after "
            "installing a pack — no server restart), "
            "Comfy.Graph.GroupSelectedNodes. Only these ids are allowed. "
            "Optional nodes (array of node ids) selects those nodes first — "
            "required for selection-dependent commands like "
            "GroupSelectedNodes, and focuses FitView on them. Requires an "
            "open ComfyTV page in Desktop or a browser."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string"},
                "command": {"type": "string",
                            "enum": list(_CANVAS_COMMANDS)},
                "nodes": {"type": "array",
                          "items": {"type": ["string", "integer"]}},
            },
            "required": ["command"],
            "additionalProperties": False,
        },
        "handler": _canvas_command,
    },
    "canvas_focus": {
        "description": (
            "Select a native graph node and glide the user's viewport to it "
            "— use after graph_edit to show the user what changed. node is "
            "a node id from graph_get. Requires an open ComfyTV page in Desktop or a browser."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string"},
                "node": {"type": "string"},
            },
            "required": ["node"],
            "additionalProperties": False,
        },
        "handler": _canvas_focus,
    },
    "arrange_canvas": {
        "description": (
            "Tidy the whole canvas using litegraph's native arrange: nodes "
            "are laid out in dependency order, column by column, sized to "
            "their cards. Use after building a pipeline so nodes don't "
            "overlap. CAUTION: repositions EVERY node on the canvas and "
            "discards the user's manual layout — ask before arranging a "
            "canvas the user laid out by hand. margin is the spacing in "
            "pixels (default 100, 20-400); layout 'horizontal' (default) "
            "or 'vertical'. Requires an open ComfyTV page in Desktop or a browser."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "margin": {"type": "number"},
                "layout": {"type": "string",
                           "enum": ["horizontal", "vertical"]},
                "project_id": {"type": "string"},
            },
            "additionalProperties": False,
        },
        "handler": _arrange_canvas,
    },
    "graph_get": {
        "description": (
            "Snapshot the NATIVE ComfyUI graph on the user's open canvas "
            "(the root graph — every node, not just ComfyTV stages): "
            "node_id, class type, title, widget values and connections "
            "(ComfyTV stage nodes carry is_stage=true — drive those with "
            "set_stage/run_stage instead). Use before graph_edit to see "
            "what is on the canvas. Requires an open ComfyTV page in Desktop "
            "or a browser (the page executes the command)."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"project_id": {"type": "string"}},
            "additionalProperties": False,
        },
        "handler": _graph_get,
    },
    "graph_edit": {
        "description": (
            "Edit the NATIVE ComfyUI graph on the open canvas — changes are "
            "immediately visible to the user. ops array, applied in order "
            "(stops at the first failing op; earlier ops stay applied): "
            "{op:'add_node', type, pos?, title?, widgets?} creates a node "
            "(type is a node class name — node_info can search them; "
            "returns the new node_id); {op:'set_widget', node, name, value} "
            "writes a widget; {op:'set_title', node, title}; {op:'connect', "
            "from_node, from_slot?, to_node, to_slot?} wires an output to "
            "an input (slots by name or index; to_slot omitted = first free "
            "type-compatible input); {op:'disconnect', node, input}; "
            "{op:'remove_node', node}; {op:'set_mode', node, mode: "
            "always/mute/bypass} (bypass to A/B a node's effect); "
            "{op:'clone', node, pos?}; {op:'set_color', node, color?, "
            "bgcolor?}; {op:'create_group', title, nodes: [ids], color?}; "
            "{op:'collapse', node, collapsed?}; {op:'pin', node, pinned?}; "
            "{op:'convert_to_subgraph', nodes: [ids]} packs the nodes into "
            "a subgraph (returns the new subgraph node's id); "
            "{op:'unpack_subgraph', node} explodes a subgraph node "
            "(graph_get flags them is_subgraph=true) back inline. "
            "The whole call is one undo step (Comfy.Undo reverts it). "
            "Requires an open ComfyTV page in Desktop or a browser."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string"},
                "ops": {"type": "array", "items": {"type": "object"},
                        "minItems": 1},
            },
            "required": ["ops"],
            "additionalProperties": False,
        },
        "handler": _graph_edit,
    },
    "graph_run": {
        "description": (
            "Queue the native canvas graph exactly like pressing ComfyUI's "
            "Run button (ComfyTV stage nodes are stripped/bridged the same "
            "way the Run button does), then wait up to wait_s (default 60, "
            "max 170) for it to finish by watching local history. Returns "
            "prompt_id plus status 'done' with outputs (/view URLs — "
            "view_image can look at them), 'error' with the failing node, "
            "or 'running' on timeout — re-call with the returned prompt_id "
            "to keep waiting. Requires an open ComfyTV page in Desktop or a browser to queue; "
            "waiting on a prompt_id is server-side."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string"},
                "wait_s": {"type": "number"},
                "prompt_id": {"type": "string"},
            },
            "additionalProperties": False,
        },
        "handler": _graph_run,
    },
}
