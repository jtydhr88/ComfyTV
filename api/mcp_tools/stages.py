import time
from ... import storage
from ...nodes.stages import STAGE_META
from ...runners import workflow_db

from . import _shared
from ._shared import _command_payload


def _normalize_stage_class(value: str) -> str:
    name = value.removeprefix("ComfyTV.")
    if name not in STAGE_META:
        raise ValueError(
            f"unknown stage class {value!r} — see stage_catalog for valid node_id values"
        )
    return f"ComfyTV.{name}"

def _validate_workflow_label(stage_class: str, label: str) -> None:
    kind = STAGE_META.get(stage_class.removeprefix("ComfyTV."), {}).get("workflow_kind")
    if not kind:
        raise ValueError(
            f"{stage_class} has no workflow selector — drop the 'workflow' argument"
        )
    labels = [w["label"] for w in workflow_db.list_workflows_overview(kind)]
    if label not in labels:
        raise ValueError(
            f"workflow {label!r} not found for kind {kind!r} — "
            f"valid labels: {', '.join(labels) or '(none)'}"
        )

def _validate_widgets(args: dict) -> None:
    widgets = args.get("widgets")
    if widgets is not None and not isinstance(widgets, dict):
        raise ValueError("widgets must be an object mapping widget name -> value")

async def _add_stage(args: dict) -> dict:
    stage_class = _normalize_stage_class(str(args.get("node_class") or ""))
    if args.get("workflow"):
        _validate_workflow_label(stage_class, str(args["workflow"]))
    _validate_widgets(args)
    _validate_asset_refs(args)
    payload = _command_payload(
        args, ("title", "prompt", "workflow", "widgets", "asset_refs", "pos",
               "project_id"))
    payload["node_class"] = stage_class
    return await _shared.submit_command("add_stage", payload)

def _validate_server(args: dict) -> None:
    server = args.get("server")
    if server is None or str(server).lower() in ("", "local"):
        return
    try:
        sid = int(server)
    except (TypeError, ValueError):
        raise ValueError("server must be a server id from the servers tool, or 'local'")
    row = storage.get_server(sid)
    if row is None:
        raise ValueError(f"server {sid} not found — see the servers tool")
    if not row.get("enabled", True):
        raise ValueError(f"server {sid} ({row['label']}) is disabled")

def _validate_asset_refs(args: dict) -> None:
    refs = args.get("asset_refs")
    if refs is None:
        return
    if not isinstance(refs, list):
        raise ValueError(
            "asset_refs must be an array of {asset_id, slot?, type?} objects")
    for r in refs:
        if not isinstance(r, dict) or "asset_id" not in r:
            raise ValueError("each asset_refs entry needs an asset_id")
        try:
            aid = int(r["asset_id"])
        except (TypeError, ValueError):
            raise ValueError(f"invalid asset_id {r.get('asset_id')!r}")
        asset = storage.get_asset(aid)
        if asset is None:
            raise ValueError(f"asset {aid} not found — see the assets tool")
        rtype = r.get("type")
        if rtype is not None and rtype not in ("image", "video", "audio"):
            raise ValueError(f"asset_refs type must be image/video/audio, got {rtype!r}")

async def _set_stage(args: dict) -> dict:
    node = args.get("node")
    if not node:
        raise ValueError("node is required (stage uid or graph node id)")
    if not any(args.get(k) is not None
               for k in ("prompt", "workflow", "title", "widgets", "server",
                         "asset_refs")):
        raise ValueError(
            "nothing to set — pass prompt, workflow, title, widgets, server "
            "and/or asset_refs")
    _validate_widgets(args)
    _validate_server(args)
    _validate_asset_refs(args)
    payload = _command_payload(
        args, ("prompt", "workflow", "title", "widgets", "server",
               "asset_refs", "project_id"))
    payload["node"] = str(node)
    return await _shared.submit_command("set_stage", payload)

async def _connect_stages(args: dict) -> dict:
    from_node = args.get("from_node")
    to_node = args.get("to_node")
    if not from_node or not to_node:
        raise ValueError("from_node and to_node are required")
    payload = _command_payload(args, ("from_slot", "to_slot", "project_id"))
    payload["from_node"] = str(from_node)
    payload["to_node"] = str(to_node)
    return await _shared.submit_command("connect_stages", payload)

async def _stage_params_tool(args: dict) -> dict:
    action = str(args.get("action") or "list")
    if action == "list":
        return {"params": storage.list_stage_params(args.get("kind"))}
    if action == "create":
        kind = str(args.get("kind") or "").strip()
        label = str(args.get("label") or "").strip()
        type_ = str(args.get("type") or "").strip()
        if not kind:
            raise ValueError("kind is required (a stage kind like 'video')")
        if not label:
            raise ValueError("label is required")
        if type_ not in storage.STAGE_PARAM_TYPES:
            raise ValueError(
                f"unknown type {type_!r}; valid: {list(storage.STAGE_PARAM_TYPES)}")
        config = args.get("config")
        row = storage.create_stage_param(
            kind=kind, label=label, type=type_,
            default=args.get("default"),
            config=config if isinstance(config, dict) else None,
        )
        if row is None:
            raise ValueError("could not create stage param")
        from .._common import broadcast_stage_param_event
        broadcast_stage_param_event("create", {"param": row})
        return {"param": row}
    if action == "update":
        pid = args.get("id")
        if not isinstance(pid, int):
            raise ValueError("id (integer) is required")
        type_ = args.get("type")
        if type_ is not None and type_ not in storage.STAGE_PARAM_TYPES:
            raise ValueError(f"unknown type {type_!r}")
        kwargs: dict = {}
        if args.get("label") is not None:
            kwargs["label"] = str(args["label"])
        if type_ is not None:
            kwargs["type"] = type_
        if "default" in args:
            kwargs["default"] = args["default"]
        if "config" in args:
            cfg = args.get("config")
            kwargs["config"] = cfg if isinstance(cfg, dict) else None
        row = storage.update_stage_param(pid, **kwargs)
        if row is None:
            raise ValueError(f"param {pid} not found or read-only (system param)")
        from .._common import broadcast_stage_param_event
        broadcast_stage_param_event("update", {"param": row})
        return {"param": row}
    if action == "delete":
        pid = args.get("id")
        if not isinstance(pid, int):
            raise ValueError("id (integer) is required")
        if not storage.delete_stage_param(pid):
            raise ValueError(f"param {pid} not found or read-only (system param)")
        from .._common import broadcast_stage_param_event
        broadcast_stage_param_event("delete", {"id": pid})
        return {"ok": True}
    raise ValueError(
        f"unknown action {action!r} — valid: list, create, update, delete")

async def _cancel_stage(args: dict) -> dict:
    node = args.get("node")
    if not node:
        raise ValueError("node is required (stage uid or graph node id)")
    payload = _command_payload(args, ("project_id",))
    payload["node"] = str(node)
    return await _shared.submit_command("cancel_stage", payload, timeout=30.0)

async def _get_stage(args: dict) -> dict:
    node = args.get("node")
    if not node:
        raise ValueError("node is required (stage uid or graph node id)")
    payload = _command_payload(args, ("project_id",))
    payload["node"] = str(node)
    return await _shared.submit_command("get_stage", payload)

async def _remove_stage(args: dict) -> dict:
    node = args.get("node")
    if not node:
        raise ValueError("node is required (stage uid or graph node id)")
    payload = _command_payload(args, ("project_id",))
    payload["node"] = str(node)
    return await _shared.submit_command("remove_stage", payload)


TOOLS: dict[str, dict] = {
    "add_stage": {
        "description": (
            "Add a ComfyTV stage node to the user's live canvas (requires an open "
            "ComfyTV page in Desktop or a browser — the page executes the command). "
            "node_class is a "
            "stage_catalog node_id (e.g. 'ComfyTV.ImageStage'). Optionally set "
            "title, prompt, workflow (a list_workflows label for the stage's "
            "kind), widgets (an object setting any stage widget by name, e.g. "
            "{\"duration\": 5, \"end_zoom\": 1.3}) and asset_refs (asset-library "
            "references: [{asset_id, slot?, type?}] with ids from the assets "
            "tool; they are sent as the stage's reference media at run time "
            "and addressable as @image_N / @video_N / @audio_N in the prompt) "
            "in the same call. Mention ordinals are ZERO-BASED per media type: "
            "the first sendable image is @image_0 (wired stage inputs and "
            "asset_refs occupy slots in order; a token past the sendable range "
            "expands to nothing and the result carries a warning). Returns the "
            "new node's graph_node_id and uid. Placement is automatic unless "
            "pos [x, y] is given."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "node_class": {"type": "string"},
                "title": {"type": "string"},
                "prompt": {"type": "string"},
                "workflow": {"type": "string"},
                "widgets": {"type": "object"},
                "asset_refs": {"type": "array", "items": {"type": "object"}},
                "pos": {"type": "array", "items": {"type": "number"},
                        "minItems": 2, "maxItems": 2},
                "project_id": {"type": "string"},
            },
            "required": ["node_class"],
            "additionalProperties": False,
        },
        "handler": _add_stage,
    },
    "set_stage": {
        "description": (
            "Update an existing stage on the live canvas: prompt (main_prompt), "
            "workflow (a list_workflows label), title, widgets (an object "
            "setting any stage widget by name; on an unknown name the error "
            "lists the stage's widget names), server (a server id from the "
            "servers tool to route this stage's runs to that machine, or "
            "'local') and/or asset_refs (asset-library references replacing "
            "the stage's current set: [{asset_id, slot?, type?}] with ids "
            "from the assets tool, addressable as @image_N / @video_N / "
            "@audio_N in the prompt; pass [] to clear). Mention ordinals are "
            "ZERO-BASED per media type (first image = @image_0; wired inputs "
            "and asset_refs occupy slots in order; out-of-range tokens expand "
            "to nothing and the result carries a warning). Asset loader "
            "stages (AssetImageLoaderStage / AssetVideoLoaderStage / "
            "AssetAudioLoaderStage / AssetTextLoaderStage / "
            "AssetModelLoaderStage) are selection "
            "nodes, not runnable: set widgets {\"asset_id\": <id>} and the "
            "loader selects that library asset and emits its output "
            "immediately — do NOT run_stage them, just run the downstream "
            "stage. Multi-candidate stages (Image/Audio/Video Picker pools "
            "and image-batch generators like ImageStage) select the same "
            "way: widgets {\"selected_index\": N} (1-BASED) picks that "
            "candidate on the live card and updates the downstream output. "
            "node is a stage uid or graph_node_id from get_canvas. "
            "Requires an open ComfyTV page in Desktop or a browser."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {"type": "string"},
                "prompt": {"type": "string"},
                "workflow": {"type": "string"},
                "title": {"type": "string"},
                "widgets": {"type": "object"},
                "server": {"type": "string"},
                "asset_refs": {"type": "array", "items": {"type": "object"}},
                "project_id": {"type": "string"},
            },
            "required": ["node"],
            "additionalProperties": False,
        },
        "handler": _set_stage,
    },
    "connect_stages": {
        "description": (
            "Wire one stage's output into another stage's input on the live "
            "canvas. from_node/to_node are stage uids or graph_node_ids. "
            "from_slot is the source output index (default 0). to_slot is the "
            "target input name (e.g. 'images.0'); omit it to auto-pick the first "
            "free type-compatible input. Requires an open ComfyTV page in Desktop or a browser."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "from_node": {"type": "string"},
                "to_node": {"type": "string"},
                "from_slot": {"type": "integer", "minimum": 0},
                "to_slot": {"type": "string"},
                "project_id": {"type": "string"},
            },
            "required": ["from_node", "to_node"],
            "additionalProperties": False,
        },
        "handler": _connect_stages,
    },
    "remove_stage": {
        "description": (
            "Remove a ComfyTV stage node from the live canvas (its stored "
            "outputs stay in the project history). node is a stage uid or "
            "graph_node_id from get_canvas. Only ComfyTV stages can be "
            "removed. Requires an open ComfyTV page in Desktop or a browser."
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
        "handler": _remove_stage,
    },
    "cancel_stage": {
        "description": (
            "Stop a stage's in-flight run (local runs interrupt the ComfyUI "
            "queue; remote runs cancel the remote job) — use when a render "
            "is clearly wrong or stuck instead of waiting it out. node is a "
            "stage uid or graph node id; errors if the stage is not "
            "running. Requires an open ComfyTV page in Desktop or a browser."
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
        "handler": _cancel_stage,
    },
    "get_stage": {
        "description": (
            "Read one stage in full detail from the live canvas: every "
            "widget value (get_canvas only mirrors prompt/workflow), input "
            "connections with source nodes, output connections with target "
            "nodes, asset_refs, running state, position and any dangling "
            "@mention warnings. Call before set_stage widgets so you edit "
            "from actual values instead of guessing. node is a stage uid or "
            "graph node id. Requires an open ComfyTV page in Desktop or a browser."
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
        "handler": _get_stage,
    },
    "stage_params": {
        "description": (
            "Manage custom stage parameters — extra widgets users define on a "
            "stage kind so workflows can bind values ComfyTV has no built-in "
            "key for. action 'list' (optional kind filter), 'create' (kind = "
            "a stage kind like 'video'/'image', label, type "
            "boolean/int/float/string/combo, optional default and config "
            "like {min,max,step} or {choices}), 'update' (id + fields), "
            "'delete' (id; system params are read-only). The returned "
            "param's 'key' is what you bind in workflow_edit as "
            "'option:<key>' — typical flow: stage_params create → "
            "workflow_edit bind {from: 'option:<key>'}."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {"type": "string",
                           "enum": ["list", "create", "update", "delete"]},
                "kind": {"type": "string"},
                "label": {"type": "string"},
                "type": {"type": "string"},
                "default": {},
                "config": {"type": "object"},
                "id": {"type": "integer"},
            },
            "required": ["action"],
            "additionalProperties": False,
        },
        "handler": _stage_params_tool,
    },
}
