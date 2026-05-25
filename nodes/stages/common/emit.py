import json
import logging
import urllib.parse
from typing import Any

from comfy_api.latest import io

from .... import storage as _storage_module
from .meta import STAGE_META, _KIND_TO_OUTPUT_TYPE
from .progress import _emit_progress


_JSON_PAYLOAD_TYPES = {'storyboard', 'images', 'timeline'}


def _persist(
    *,
    cls,
    project_id: str,
    output_type: str,
    payload_url: str,
    payload_json=None,
    params=None,
    parent_output_id=None,
    picked_index=None,
):
    try:
        node_id = getattr(cls.hidden, "unique_id", None) if hasattr(cls, "hidden") else None
        row = _storage_module.persist_output(
            project_id=project_id or "",
            stage_class=cls.__name__,
            stage_node_id=str(node_id) if node_id is not None else None,
            output_type=output_type,
            payload_url=payload_url,
            payload_json=payload_json,
            params=params,
            parent_output_id=int(parent_output_id) if parent_output_id else None,
            picked_index=int(picked_index) if picked_index is not None else None,
        )
        return row.get('id') if row else None
    except Exception as e:
        logging.warning("[ComfyTV] persist_output failed for %s: %s", cls.__name__, e)
        return None


def _stage_emit_auto(cls, *, project_id, payload_str, params=None, emit_ui: bool = True,
                     parent_output_id=None, picked_payload=None, picked_index=None):
    meta = STAGE_META.get(cls.__name__, {})
    kind = meta.get('kind', 'image')
    output_type = _KIND_TO_OUTPUT_TYPE.get(kind, kind)
    _emit_progress(cls, 1, 1, text="done")
    return _stage_emit(cls, project_id=project_id, output_type=output_type,
                       payload_str=payload_str, params=params, emit_ui=emit_ui,
                       parent_output_id=parent_output_id,
                       picked_payload=picked_payload, picked_index=picked_index)


def _stage_emit(
    cls,
    *,
    project_id: str,
    output_type: str,
    payload_str: str,
    params=None,
    emit_ui: bool = True,
    parent_output_id=None,
    picked_payload=None,
    picked_index=None,
):
    is_json = output_type in _JSON_PAYLOAD_TYPES
    row_id = _persist(
        cls=cls,
        project_id=project_id,
        output_type=output_type,
        payload_url=payload_str if not is_json else "",
        payload_json=payload_str if is_json else None,
        params=params,
        parent_output_id=parent_output_id,
        picked_index=picked_index,
    )
    has_pick = picked_payload is not None
    if emit_ui:
        ui_data: dict = {"output": [payload_str]}
        if has_pick:
            ui_data["picked"] = [picked_payload]
            if picked_index is not None:
                ui_data["picked_index"] = [int(picked_index)]
        if row_id is not None:
            ui_data["output_id"] = [row_id]
        if has_pick:
            return io.NodeOutput(payload_str, picked_payload, ui=ui_data)
        return io.NodeOutput(payload_str, ui=ui_data)
    if has_pick:
        return io.NodeOutput(payload_str, picked_payload)
    return io.NodeOutput(payload_str)


def _input_file_url(filename: str) -> str:
    if not filename:
        return ''
    slash = filename.rfind('/')
    subfolder = filename[:slash] if slash >= 0 else ''
    name = filename[slash + 1:] if slash >= 0 else filename
    params = {'filename': name, 'type': 'input'}
    if subfolder:
        params['subfolder'] = subfolder
    return f"/view?{urllib.parse.urlencode(params)}"


def _pick_image_from_batch(batch: Any, selected_index: int) -> str:
    try:
        data = json.loads(batch) if isinstance(batch, str) else batch
        images = data.get("images", []) if isinstance(data, dict) else []
    except (ValueError, TypeError):
        return ""
    if not isinstance(images, list):
        return ""
    match = next(
        (img for img in images if str(img.get("index")) == str(selected_index)),
        None,
    )
    if match is None and 1 <= selected_index <= len(images):
        match = images[selected_index - 1]
    return str(match.get("image_url", "")) if isinstance(match, dict) else ""
