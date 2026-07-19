from aiohttp import web

from .. import storage
from ._common import _log, routes

_STAGE_CLASSES: dict[str, type] | None = None
_INFRA_NAMES: set[str] | None = None


def _input_name(inp) -> str | None:
    name = getattr(inp, "id", None)
    if isinstance(name, str) and name:
        return name
    args = getattr(inp, "args", None)
    if args and isinstance(args[0], str):
        return args[0]
    kw = getattr(inp, "kw", None)
    if isinstance(kw, dict) and isinstance(kw.get("id"), str):
        return kw["id"]
    return None


def _input_field(inp, field: str):
    value = getattr(inp, field, None)
    if value is not None:
        return value
    kw = getattr(inp, "kw", None)
    if isinstance(kw, dict):
        return kw.get(field)
    return None


def _schema_field(schema, field: str):
    value = getattr(schema, field, None)
    if value is not None:
        return value
    kw = getattr(schema, "kw", None)
    if isinstance(kw, dict):
        return kw.get(field)
    return None


def _infra_input_names() -> set[str]:
    global _INFRA_NAMES
    if _INFRA_NAMES is None:
        from ..nodes.stages.common.inputs import (
            _custom_params_input, _main_prompt_input, _selected_index_input,
        )
        from ..nodes.stages.common.invoke import _standard_stage_inputs
        infra = [
            *_standard_stage_inputs(),
            _custom_params_input(),
            _selected_index_input(),
            _main_prompt_input(),
        ]
        _INFRA_NAMES = {n for n in (_input_name(i) for i in infra) if n}
    return _INFRA_NAMES


async def _stage_class_map() -> dict[str, type]:
    global _STAGE_CLASSES
    if _STAGE_CLASSES is None:
        from ..nodes.stages import ComfyTVExtension
        mapping: dict[str, type] = {}
        for cls in await ComfyTVExtension().get_node_list():
            try:
                node_id = _schema_field(cls.define_schema(), "node_id")
            except Exception as e:
                _log.warning("[ComfyTV/presets] schema read failed for %s: %s",
                             getattr(cls, "__name__", cls), e)
                continue
            if node_id:
                mapping[str(node_id)] = cls
        _STAGE_CLASSES = mapping
    return _STAGE_CLASSES


def _candidate_defaults(stage_cls) -> dict:
    infra = _infra_input_names()
    defaults: dict = {}
    for inp in _schema_field(stage_cls.define_schema(), "inputs") or []:
        name = _input_name(inp)
        if not name or name in infra:
            continue
        if not _input_field(inp, "socketless"):
            continue
        extra = _input_field(inp, "extra_dict")
        if not (isinstance(extra, dict) and extra.get("hidden")):
            continue
        default = _input_field(inp, "default")
        if default is None:
            options = _input_field(inp, "options")
            if isinstance(options, (list, tuple)) and options:
                default = options[0]
        defaults[name] = default
    return defaults


def _stage_defaults(node_id: str, stage_cls) -> dict:
    from ..nodes.stages.common.preset_fields import PRESET_FIELDS
    allowed = PRESET_FIELDS.get(node_id)
    if not allowed:
        return {}
    candidates = _candidate_defaults(stage_cls)
    missing = [name for name in allowed if name not in candidates]
    if missing:
        _log.warning("[ComfyTV/presets] PRESET_FIELDS[%s] lists unknown fields %s",
                     node_id, missing)
    return {name: candidates[name] for name in allowed if name in candidates}


@routes.get("/comfytv/presets")
async def list_presets(request: web.Request) -> web.Response:
    from ..nodes.stages.common.builtin_presets import builtin_preset_rows
    kind = (request.query.get("kind") or "").strip()
    rows = [
        *builtin_preset_rows(kind or None),
        *({**row, "builtin": False} for row in storage.list_presets(kind or None)),
    ]
    return web.json_response({"presets": rows})


@routes.post("/comfytv/presets")
async def create_preset(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception as e:
        return web.json_response({"error": f"invalid json: {e}"}, status=400)
    kind = (body.get("kind") or "").strip()
    name = (body.get("name") or "").strip()
    config = body.get("config")
    if not kind:
        return web.json_response({"error": "kind is required"}, status=400)
    if not name:
        return web.json_response({"error": "name is required"}, status=400)
    if not isinstance(config, dict):
        return web.json_response({"error": "config must be an object"}, status=400)
    from ..nodes.stages.common.builtin_presets import builtin_preset_names
    if name in builtin_preset_names(kind):
        return web.json_response(
            {"error": "name reserved by built-in preset"}, status=400)
    row = storage.save_preset(kind, name, config)
    if row is None:
        return web.json_response({"error": "invalid preset"}, status=400)
    return web.json_response({"ok": True, "preset": row})


def _resolve_preset_id(raw: str) -> tuple[int | None, web.Response | None]:
    if raw.startswith("builtin:"):
        return None, web.json_response(
            {"error": "built-in presets are read-only"}, status=400)
    try:
        return int(raw), None
    except ValueError:
        return None, web.json_response({"error": "preset not found"}, status=404)


@routes.patch("/comfytv/presets/{pid}")
async def update_preset(request: web.Request) -> web.Response:
    pid, err = _resolve_preset_id(request.match_info["pid"])
    if err is not None:
        return err
    try:
        body = await request.json()
    except Exception as e:
        return web.json_response({"error": f"invalid json: {e}"}, status=400)
    name = body.get("name")
    config = body.get("config")
    if name is not None and not isinstance(name, str):
        return web.json_response({"error": "name must be a string"}, status=400)
    if config is not None and not isinstance(config, dict):
        return web.json_response({"error": "config must be an object"}, status=400)
    row = storage.update_preset(pid, name=name, config=config)
    if row is None:
        return web.json_response({"error": "preset not found or name taken"}, status=404)
    return web.json_response({"ok": True, "preset": row})


@routes.delete("/comfytv/presets/{pid}")
async def delete_preset(request: web.Request) -> web.Response:
    pid, err = _resolve_preset_id(request.match_info["pid"])
    if err is not None:
        return err
    if not storage.delete_preset(pid):
        return web.json_response({"error": "preset not found"}, status=404)
    return web.json_response({"ok": True})


@routes.get("/comfytv/stage_defaults")
async def get_stage_defaults(request: web.Request) -> web.Response:
    node_id = (request.query.get("node_id") or "").strip()
    if not node_id:
        return web.json_response({"error": "node_id is required"}, status=400)
    stage_cls = (await _stage_class_map()).get(node_id)
    if stage_cls is None:
        return web.json_response({"error": f"unknown node_id {node_id!r}"}, status=404)
    return web.json_response({"defaults": _stage_defaults(node_id, stage_cls)})
