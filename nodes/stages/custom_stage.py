import json
import logging

from ._common import *  # noqa: F401, F403
from ...runners.custom_io import (
    OUTPUT_SLOTS, build_upstream, linked_text_options, normalize_custom_io,
    slot_values, split_multi_payload,
)
from .common.timing import consume_invoke_duration

_log = logging.getLogger(__name__)


def _load_custom_io(label: str) -> dict:
    from ...runners import workflow_db
    cfg = workflow_db.get_workflow_for_invoke('custom', label) if label else None
    meta = (cfg or {}).get('meta') or {}
    return normalize_custom_io(meta.get('custom_io'))


class CustomStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.CustomStage",
            display_name="Custom Stage",
            category="ComfyTV/Generate",
            inputs=[
                *_standard_stage_inputs(),
                io.Combo.Input("workflow", options=labels_for('custom') or [""],
                               default=default_for('custom'),
                               tooltip="Any ComfyUI workflow; choose which of its nodes' inputs and outputs "
                                       "this stage exposes with the Expose I/O panel on the card."),
                _main_prompt_input(tooltip="Main prompt — fed to every exposed text input marked as prompt."),
                io.Autogrow.Input("texts",  template=_text_template(8)),
                io.Autogrow.Input("images", template=_image_template(12)),
                io.Autogrow.Input("videos", template=_video_template(6)),
                io.Autogrow.Input("audio",  template=_audio_template(3)),
                io.Autogrow.Input("models", template=_model_template(4)),
                _custom_params_input(),
            ],
            outputs=[
                COMFYTV_IMAGE.Output("image"),
                COMFYTV_IMAGES.Output("images"),
                COMFYTV_VIDEO.Output("video"),
                COMFYTV_AUDIO.Output("audio"),
                COMFYTV_TEXT.Output("text"),
                COMFYTV_MODEL.Output("model"),
            ],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    async def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                      workflow="", main_prompt="", texts=None, images=None, videos=None,
                      audio=None, models=None, custom_params="{}"):
        custom_io = _load_custom_io(workflow)
        if not custom_io['outputs']:
            raise RuntimeError(
                f"Custom Stage workflow {workflow!r} exposes no output yet — open "
                f"Expose I/O on the card and pick at least one output node."
            )
        upstream = build_upstream(custom_io, {
            'texts': texts, 'images': images, 'videos': videos,
            'audio': audio, 'models': models,
        })
        payload = await invoke_runner(
            kind='custom',
            label=workflow,
            main_prompt=main_prompt,
            upstream=upstream,
            options=linked_text_options(custom_io, upstream),
            custom_params=custom_params,
        )
        by_kind, primary_kind, primary = split_multi_payload(payload, custom_io)
        if not primary:
            raise RuntimeError(
                f"Custom Stage workflow {workflow!r} produced no {primary_kind} output"
            )
        duration_ms = consume_invoke_duration()
        payload_json: dict = {"multi": by_kind}
        if primary_kind == 'images':
            try:
                payload_json.update(json.loads(primary))
            except (ValueError, TypeError):
                pass
        row_id = _persist(
            cls=cls,
            project_id=project_id,
            output_type=primary_kind,
            payload_url=primary if primary_kind != 'images' else "",
            payload_json=payload_json,
            parent_output_id=parent_output_id,
            duration_ms=duration_ms,
        )
        _emit_progress(cls, 1, 1, text="done")
        ui_data: dict = {
            "output": [primary],
            "custom_outputs": [json.dumps(by_kind)],
        }
        if row_id is not None:
            ui_data["output_id"] = [row_id]
        if duration_ms is not None:
            ui_data["duration_ms"] = [int(duration_ms)]
        return io.NodeOutput(*slot_values(by_kind), ui=ui_data)


__all__ = ["CustomStage", "OUTPUT_SLOTS"]
