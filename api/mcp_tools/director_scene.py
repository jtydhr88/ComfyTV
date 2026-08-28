import re

from . import _shared
from ._shared import _command_payload


async def _director_get(args: dict) -> dict:
    node = args.get("node")
    if not node:
        raise ValueError("node is required (DirectorStage uid or graph node id)")
    payload = _command_payload(args, ("project_id",))
    payload["node"] = str(node)
    return await _shared.submit_command("director_get", payload)

async def _director_edit(args: dict) -> dict:
    node = args.get("node")
    if not node:
        raise ValueError("node is required (DirectorStage uid or graph node id)")
    ops = args.get("ops")
    if not isinstance(ops, list) or not ops:
        raise ValueError("ops must be a non-empty array of {op, ...} objects")
    for i, op in enumerate(ops):
        if not isinstance(op, dict) or not op.get("op"):
            raise ValueError(f"ops[{i}] must be an object with an 'op' field")
    payload = _command_payload(args, ("project_id",))
    payload["node"] = str(node)
    payload["ops"] = ops
    return await _shared.submit_command("director_edit", payload, timeout=30.0)

_SCENE_CHANNELS = ("color", "depth", "normal", "openpose", "id")

_SCENE_LAYERS_SCHEMA = {
    "type": "object",
    "properties": {
        "characters": {"type": "boolean"},
        "props": {"type": "boolean"},
        "room": {"type": "boolean"},
        "floor": {"type": "boolean"},
    },
    "additionalProperties": False,
}

def _scene_target(args: dict) -> dict:
    node = args.get("node")
    if not node:
        raise ValueError("node is required (a ComfyTV.Scene3DStage uid or graph node id)")
    payload = _command_payload(args, ("project_id",))
    payload["node"] = str(node)
    return payload

def _validate_channel(args: dict) -> None:
    channel = args.get("channel")
    if channel is not None and channel not in _SCENE_CHANNELS:
        raise ValueError(
            f"channel must be one of {', '.join(_SCENE_CHANNELS)}")

async def _scene_get(args: dict) -> dict:
    return await _shared.submit_command("scene_get", _scene_target(args))

async def _scene_edit(args: dict) -> dict:
    ops = args.get("ops")
    if not isinstance(ops, list) or not ops:
        raise ValueError("ops must be a non-empty array of operation objects")
    if not all(isinstance(op, dict) and op.get("op") for op in ops):
        raise ValueError("every op must be an object with an 'op' field")
    payload = _scene_target(args)
    payload["ops"] = ops
    return await _shared.submit_command("scene_edit", payload)

async def _scene_capture(args: dict) -> dict:
    _validate_channel(args)
    payload = _scene_target(args)
    payload.update(_command_payload(args, ("channel", "width", "height", "layers")))
    return await _shared.submit_command("scene_capture", payload, timeout=120.0)

async def _scene_record(args: dict) -> dict:
    _validate_channel(args)
    payload = _scene_target(args)
    payload.update(_command_payload(args, ("channel", "width", "height", "layers")))
    return await _shared.submit_command("scene_record", payload, timeout=300.0)


TOOLS: dict[str, dict] = {
    "director_get": {
        "description": (
            "Read a Director stage's full timeline: settings (chain mode "
            "off/prepend/replace — how each clip receives the previous "
            "clip's last frame), total seconds, default workflow, and every "
            "clip in order with id/enabled/workflow/prompt/duration_s/seed/"
            "transition(+_s)/per-clip images/videos/audio reference URLs and "
            "render status ({url, cached} — cached means an unchanged clip "
            "reuses its render on the next run). Also lists valid "
            "workflow_options, transitions and chain_modes. ALWAYS call "
            "before director_edit to get clip ids. node is the "
            "DirectorStage uid or graph node id; its card must be open in "
            "the tab."
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
        "handler": _director_get,
    },
    "director_edit": {
        "description": (
            "Edit a Director stage's clip timeline with an ops array, then "
            "run_stage the director node to render (unchanged clips reuse "
            "cached renders — only edited clips re-generate). Ops: "
            "{op:'add_clip', prompt?, workflow?, duration_s? (1-120s), "
            "transition?, transition_s?, enabled?, images?/videos?/audio? "
            "(arrays of /view?… URLs from assets/outputs), index?} → "
            "returns the new clip id; {op:'update_clip', id, ...same "
            "fields}; {op:'remove_clip', id}; {op:'duplicate_clip', id}; "
            "{op:'move_clip', id, index}; {op:'reroll', id?} re-seeds one "
            "clip (or all without id) to force a fresh take; "
            "{op:'set_chain', chain: off/prepend/replace}. Clip prompts may "
            "@-mention media: ordinals are ZERO-BASED per type over the "
            "MERGED pool — the director node's shared asset_refs (set via "
            "set_stage, the whole-film cast) come first, then the clip's "
            "own refs; @image_0 is the first shared image. No mentions = "
            "send all refs; mentioning = only the mentioned ones are sent. "
            "Rejected while the director is running."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {"type": "string"},
                "ops": {"type": "array", "items": {"type": "object"},
                        "minItems": 1},
                "project_id": {"type": "string"},
            },
            "required": ["node", "ops"],
            "additionalProperties": False,
        },
        "handler": _director_edit,
    },
    "scene_get": {
        "description": (
            "Read a Scene3D stage's full scene: characters, primitives, models, "
            "lights, cameras (with motion presets), environment and output "
            "settings, plus available resources (character library, camera "
            "motion presets, model assets, capture channels) and busy state. "
            "Characters and models in the scene include available_clips — "
            "pick one with scene_edit set_animation {id, clip}, otherwise "
            "the character holds a static pose and only the camera moves. "
            "ALWAYS call this before scene_edit to see current ids and "
            "resources. node is the Scene3DStage uid or graph_node_id."
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
        "handler": _scene_get,
    },
    "scene_edit": {
        "description": (
            "Build/modify a Scene3D scene with an atomic array of structured "
            "ops (one undo step). Ops: add_primitive {shape: cube|sphere|"
            "cylinder|plane, color?, name?}, add_model {asset_id|url} "
            "(meshes glb/gltf/fbx/obj AND gaussian splats spz/splat/ksplat/"
            "ply — splats render in the color channel only, hidden in depth/"
            "normal/id control renders), "
            "add_character {model (from resources)}, add_light {type: "
            "directional|point|spot, color?, intensity?, position?, target?}, "
            "add_camera {fov?, output?}, set_transform {id, position?, "
            "rotation_deg?|quaternion?|look_at?, scale?}, set_color (on a "
            "character it tints the mannequin — use distinct colors in "
            "multi-character scenes so prompts can bind identity, e.g. "
            "'@image_0 is the red figure'; '' clears), "
            "patch_light, set_animation {id, clip (an available_clips name "
            "from scene_get — required for a character/model to actually "
            "move), speed?, loop?}, rename, "
            "set_hidden, remove, set_environment {show_grid?, background?, "
            "show_room?, floor_only? (ground plane without walls — an "
            "outdoor-friendly parallax anchor for control renders)}, "
            "set_output {fps?, frame_count?, camera_id?}, "
            "bind_camera_preset {id, preset_id (from resources — this is how "
            "you get dolly/orbit/push camera moves), speed?}, "
            "set_camera_tuning {id, reverse?, path_scale?, yaw_degrees?, ...}, "
            "set_camera_fov. Director cut track: add_shot {camera_id, "
            "dur_frames?, name?, lock? (character id the camera aims at), "
            "index?} — ordered shots pack gaplessly on the global clock and "
            "playback/recording switches to each shot's camera in turn "
            "(camera presets restart per shot; the world runs continuously); "
            "patch_shot {id, camera_id?, dur_frames?, lock? ('' clears), "
            "name?}, move_shot {id, index}, remove also deletes shots. "
            "Prompt strips (frame-range prompts for downstream generation): "
            "add_prompt {start, end, text?}, patch_prompt {id, start?, end?, "
            "text?}. Character paths: set_path {id (character), points "
            "([[x,z]|[x,y,z], ...] ground waypoints, >=2), times_sec? (per-"
            "waypoint arrival seconds -> non-linear speed), straight?, "
            "range? {start, end frames — when the walk happens}, sync_speed? "
            "(m/s: drives the clip by distance so feet don't slide; ~1.4 "
            "for Walk_Loop), clear?} — the character travels the spline "
            "facing its tangent (pair with set_animation Walk_Loop). "
            "All add_* ops accept position/rotation_deg/"
            "look_at/scale; positions are [x,y,z] with y up, units≈meters. "
            "After editing, verify visually with scene_capture. An unknown op "
            "or id errors with the full valid list and applies nothing."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {"type": "string"},
                "ops": {"type": "array", "items": {"type": "object"},
                        "minItems": 1},
                "project_id": {"type": "string"},
            },
            "required": ["node", "ops"],
            "additionalProperties": False,
        },
        "handler": _scene_edit,
    },
    "scene_capture": {
        "description": (
            "Render the Scene3D scene to still image(s) — every camera plus "
            "the free view when no output camera is set — and return their "
            "URLs. channel: color (default), depth, normal, openpose or id "
            "(flat unique color per entity + an id_legend mapping id/name/"
            "color in the response — key masks for downstream regional "
            "control). layers {characters?, props?, room?, floor?: bool} "
            "hides scene layers for THIS capture only — e.g. {characters: "
            "false} renders environment-only depth so the control signal "
            "does not lock the character silhouette; {room: false, floor: "
            "true} keeps just the ground plane as a parallax anchor. Use "
            "after every scene_edit to visually verify the scene (fetch the "
            "returned URL and look at it) before recording. Also writes the "
            "capture into the stage so run_stage persists it to history."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {"type": "string"},
                "channel": {"type": "string",
                            "enum": list(_SCENE_CHANNELS)},
                "width": {"type": "integer", "minimum": 64, "maximum": 4096},
                "height": {"type": "integer", "minimum": 64, "maximum": 4096},
                "layers": _SCENE_LAYERS_SCHEMA,
                "project_id": {"type": "string"},
            },
            "required": ["node"],
            "additionalProperties": False,
        },
        "handler": _scene_capture,
    },
    "scene_record": {
        "description": (
            "Record the Scene3D scene along its timeline into a webm video "
            "and return its URL — the reference-video output. With a shot "
            "cut track (add_shot) the recording follows the cut: total "
            "duration is the summed shot dur_frames and the camera switches "
            "per shot. Otherwise duration comes from bound camera motion "
            "presets / character animations, or an explicit set_output "
            "frame_count; fps from set_output. Requires "
            "something recordable (a shot cut track, bind_camera_preset, an "
            "animated character, or frame_count > 0). channel and layers "
            "work like scene_capture: depth/openpose sequences feed "
            "control-video workflows (e.g. 'Local LTX 2.3 Control V2V'); "
            "channel 'id' returns an id_legend for per-entity masking; "
            "layers {characters: false} makes environment-only control, "
            "{room: false, floor: true} keeps just a ground-plane parallax "
            "anchor. The color webm can feed MiniMax H3 R2V as a loose "
            "reference."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {"type": "string"},
                "channel": {"type": "string",
                            "enum": list(_SCENE_CHANNELS)},
                "width": {"type": "integer", "minimum": 64, "maximum": 4096},
                "height": {"type": "integer", "minimum": 64, "maximum": 4096},
                "layers": _SCENE_LAYERS_SCHEMA,
                "project_id": {"type": "string"},
            },
            "required": ["node"],
            "additionalProperties": False,
        },
        "handler": _scene_record,
    },
}
