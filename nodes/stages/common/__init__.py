import hashlib
import json
import os
import re
from typing import Any

import folder_paths
from typing_extensions import override

from comfy_api.latest import ComfyExtension, io

from .... import storage
from ....runners import RUNNER_REGISTRY, RunnerContext

from .schema import (
    COMFYTV_SCHEMA_VERSION,
    COMFYTV_TEXT, COMFYTV_IMAGE, COMFYTV_VIDEO, COMFYTV_STORYBOARD,
    COMFYTV_IMAGES, COMFYTV_PANORAMA, COMFYTV_AUDIO, COMFYTV_TIMELINE,
    COMFYTV_MODEL, COMFYTV_MATERIAL,
)
from .inputs import (
    _force_run_token, _project_id_input, _parent_output_id_input,
    _selected_index_input, _main_prompt_input, _custom_params_input,
    _text_template, _image_template, _video_template, _model_template,
)
from .meta import STAGE_META, _KIND_TO_OUTPUT_TYPE  # noqa: F401 (re-export)
from .progress import _emit_progress, _fake_run_ticks
from .emit import (
    _persist, _stage_emit, _stage_emit_auto,
    _input_file_url, _pick_image_from_batch,
)
from .invoke import (
    run_stage_workflow, invoke_runner, _standard_stage_inputs,
    StageError, StageRunnerMissing, StageNotImplemented, StageEmptyOutput,
)
from .prompts import (
    _combine_prompt,
    _multiangle_prompt, _MULTIANGLE_AZIMUTHS,
)
from .storyboard import (
    _storyboard_llm_prompt, _storyboard_regenerate_shot_prompt,
    _shape_storyboard_from_llm, _parse_shotlist_text,
)
from .fakes import (
    _seed, _autogrow_values,
    _fake_text, _fake_image, _fake_video, _fake_audio,
    _fake_storyboard, _fake_image_batch_from_storyboard,
    _fake_image_variations, _fake_panorama_views,
    _PANORAMA_VIEW_LABELS_4,
    _VIDEO_SAMPLES, _AUDIO_SAMPLES,
)
from .workflow_lists import labels_for, default_for
from .constants import (
    RESOLUTIONS, ASPECT_RATIOS,
    VIDEO_DURATION_MIN_S, VIDEO_DURATION_MAX_S, VIDEO_DURATION_DEFAULT_S,
)


__all__ = [
    "COMFYTV_SCHEMA_VERSION",
    "COMFYTV_TEXT", "COMFYTV_IMAGE", "COMFYTV_IMAGES", "COMFYTV_VIDEO",
    "COMFYTV_AUDIO", "COMFYTV_STORYBOARD", "COMFYTV_PANORAMA",
    "COMFYTV_TIMELINE", "COMFYTV_MODEL", "COMFYTV_MATERIAL",
    "STAGE_META", "_KIND_TO_OUTPUT_TYPE",
    "_VIDEO_SAMPLES", "_AUDIO_SAMPLES",
    "_force_run_token", "_project_id_input", "_parent_output_id_input",
    "_selected_index_input", "_main_prompt_input", "_custom_params_input",
    "_text_template", "_image_template", "_video_template", "_model_template",
    "_emit_progress", "_fake_run_ticks", "_persist", "_stage_emit_auto",
    "_stage_emit", "_input_file_url", "_pick_image_from_batch",
    "run_stage_workflow", "invoke_runner", "_standard_stage_inputs",
    "StageError", "StageRunnerMissing", "StageNotImplemented", "StageEmptyOutput",
    "_seed", "_autogrow_values", "_combine_prompt",
    "_fake_text", "_fake_image", "_fake_video", "_fake_audio",
    "_fake_storyboard", "_fake_image_batch_from_storyboard",
    "_storyboard_llm_prompt", "_shape_storyboard_from_llm",
    "_storyboard_regenerate_shot_prompt", "_parse_shotlist_text",
    "_fake_image_variations", "_fake_panorama_views",
    "_PANORAMA_VIEW_LABELS_4",
    "labels_for", "default_for",
    "RESOLUTIONS", "ASPECT_RATIOS",
    "VIDEO_DURATION_MIN_S", "VIDEO_DURATION_MAX_S", "VIDEO_DURATION_DEFAULT_S",
    "_multiangle_prompt", "_MULTIANGLE_AZIMUTHS",
    "RUNNER_REGISTRY", "RunnerContext",
    "io", "ComfyExtension", "override",
    "json", "os", "hashlib", "Any", "folder_paths", "storage",
]
