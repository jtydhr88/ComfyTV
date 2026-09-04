from . import _shared
from ._shared import _command_payload

_CAPTURE_MODES = ("composite", "batch")


def _layer_target(args: dict) -> dict:
    node = args.get("node")
    if not node:
        raise ValueError("node is required (a ComfyTV.LayerEditorStage uid or graph node id)")
    payload = _command_payload(args, ("project_id",))
    payload["node"] = str(node)
    return payload


async def _layer_get(args: dict) -> dict:
    payload = _layer_target(args)
    if args.get("resources") is False:
        payload["resources"] = False
    return await _shared.submit_command("layer_get", payload)


async def _layer_edit(args: dict) -> dict:
    ops = args.get("ops")
    if not isinstance(ops, list) or not ops:
        raise ValueError("ops must be a non-empty array of operation objects")
    if not all(isinstance(op, dict) and op.get("op") for op in ops):
        raise ValueError("every op must be an object with an 'op' field")
    payload = _layer_target(args)
    payload["ops"] = ops
    return await _shared.submit_command("layer_edit", payload, timeout=60.0)


async def _layer_capture(args: dict) -> dict:
    mode = args.get("mode")
    if mode is not None and mode not in _CAPTURE_MODES:
        raise ValueError(f"mode must be one of {', '.join(_CAPTURE_MODES)}")
    payload = _layer_target(args)
    if mode:
        payload["mode"] = mode
    return await _shared.submit_command("layer_capture", payload, timeout=120.0)


_NODE_SCHEMA = {"type": "string"}

TOOLS: dict[str, dict] = {
    "layer_get": {
        "description": (
            "Read a Layer Editor stage's document: canvas size, the layer "
            "tree listed BOTTOM TO TOP (raster/text/adjustment/fill/vector/"
            "group; each with id, name, visible, opacity, blend, transform "
            "{x,y,w,h,rotation}, locks, clip, mask, fx and per-kind fields "
            "such as raster url/natural size, text content/font_size/color/"
            "align, adjustment op/params, fill spec, group children), the "
            "active/selected ids and undo/selection/floating flags. By "
            "default also returns resources: the op catalog for layer_edit, "
            "blend modes, adjustment/fx/filter parameter definitions "
            "(key/min/max/default), mask inits and canvas limits — pass "
            "resources:false to skip them on repeat calls. ALWAYS call "
            "before layer_edit to get current layer ids. node is the "
            "LayerEditorStage uid or graph node id; its card must be open "
            "in the tab."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": _NODE_SCHEMA,
                "resources": {"type": "boolean"},
                "project_id": {"type": "string"},
            },
            "required": ["node"],
            "additionalProperties": False,
        },
        "handler": _layer_get,
    },
    "layer_edit": {
        "description": (
            "Edit a Layer Editor document with an ops array (applied in "
            "order; on failure the error names the op index and earlier ops "
            "stay applied). Returns applied results (new ids) plus the "
            "updated document. Ops: {op:'add_asset', asset_id, name?} "
            "(PREFERRED for library media — the asset library entry from the "
            "assets tool / asset_edit create; PSD assets import as layers) · "
            "{op:'add_image', url, name?} (a raw /view?… URL, e.g. a "
            "latest_output image_url; uploaded automatically) · "
            "{op:'add_layer', name?} · {op:'add_text', text, x?, y?, "
            "font_size?, color?, align?, letter_spacing?, line_height?} · "
            "{op:'add_adjustment', kind, params?} · {op:'add_fill', fill?} "
            "· {op:'import_psd', url} · {op:'remove'|'duplicate'|"
            "'crop_to_content'|'merge_down'|'layer_to_canvas'|'rasterize'|"
            "'invert_mask'|'remove_mask'|'apply_mask', id} · {op:'move', id, "
            "dir:'up'|'down'} · {op:'move_to', id, target, pos:'above'|"
            "'below'|'into'} · {op:'group', ids} · {op:'ungroup', id} · "
            "{op:'rename', id, name} · {op:'set_visible', id, visible} · "
            "{op:'set_opacity', id, opacity 0-1} · {op:'set_blend', id, "
            "blend} · {op:'set_lock', id, content?, position?, alpha?} · "
            "{op:'set_clip', id, clip} · {op:'set_transform', id, x?, y?, "
            "w?, h?, rotation?} · {op:'place', id, x, y, w, h, fit?:'contain'"
            "|'cover'|'stretch', align_x?, align_y? (0-1, default 0.5), "
            "crop?} — fits the layer's natural size into a box; contain "
            "letterboxes, cover fills and (crop default true) masks the "
            "overflow to the box, stretch ignores aspect · {op:'nudge', id?, dx, dy} · {op:'arrange', "
            "ids?, arrange} · {op:'set_active', id} · {op:'select', ids} · "
            "{op:'add_mask', id, init?} · {op:'set_mask_enabled', id, "
            "enabled} · {op:'set_fx', id, fx:[{op, params?, enabled?, "
            "opacity?}]} (replaces the whole fx list) · "
            "{op:'set_adjustment', id, kind?, params?} · {op:'update_text', "
            "id, ...text fields} · {op:'set_fill', id, fill} · "
            "{op:'set_canvas_size', width, height} · {op:'flip', "
            "axis:'h'|'v'} · {op:'flatten'} · {op:'filter', id?, filter, "
            "params?} (destructive raster filter) · {op:'select_all'|"
            "'select_none'|'invert_selection'|'clear_selection'} · "
            "{op:'fill_selection', color?} · {op:'undo'|'redo'}. Valid kinds/"
            "blend/fx/filter names and their params come from layer_get "
            "resources. Layers list bottom-to-top; 'up' moves toward the "
            "top of the stack. Rejected while the editor is capturing or "
            "importing/exporting."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": _NODE_SCHEMA,
                "ops": {"type": "array", "items": {"type": "object"},
                        "minItems": 1},
                "project_id": {"type": "string"},
            },
            "required": ["node", "ops"],
            "additionalProperties": False,
        },
        "handler": _layer_edit,
    },
    "layer_capture": {
        "description": (
            "Composite a Layer Editor document and publish it to the "
            "stage's image output (also returned as image: a /view?… URL "
            "usable in other stages' asset_refs or view_image). mode "
            "'composite' (default) renders the flattened document; 'batch' "
            "additionally exports every top-level layer as its own image "
            "and fills the images output. Use after layer_edit to verify "
            "the result visually with view_image. Rejected while busy."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": _NODE_SCHEMA,
                "mode": {"type": "string", "enum": list(_CAPTURE_MODES)},
                "project_id": {"type": "string"},
            },
            "required": ["node"],
            "additionalProperties": False,
        },
        "handler": _layer_capture,
    },
}
