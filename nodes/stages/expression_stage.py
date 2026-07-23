from ._common import *  # noqa: F401, F403
from ...runners.expression import EXPRESSION_FIELDS

from .common.fx_helpers import (  # noqa: F401
    _need_video, _progress_cb, _f,
    _hidden_float, _hidden_int, _hidden_str, _hidden_combo,
)


class ExpressionStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.ExpressionStage",
            display_name="Expression",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_str("expression", "sin(t*2)*10"),
                _hidden_combo("field", list(EXPRESSION_FIELDS), 'v'),
                _hidden_float("rate", 10.0, 1.0, 60.0, step=1.0),
                _hidden_float("duration", 5.0, 0.05, 3600.0, step=0.5),
                _hidden_float("fps", 24.0, 1.0, 120.0, step=1.0),
                _hidden_int("seed", 0, 0, 99999),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_TEXT.Output("keyframes")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                expression="sin(t*2)*10", field='v', rate=10.0, duration=5.0,
                fps=24.0, seed=0, video=""):
        from ...runners.expression import expression_keyframes
        from ...runners.media import get_video_info

        dur = _f(duration, 0.05, 3600, 5.0)
        fr = _f(fps, 1, 120, 24.0)
        src = (video or '').strip()
        if src:
            info = get_video_info(src)
            if info.get('duration'):
                dur = float(info['duration'])
            if info.get('fps'):
                fr = float(info['fps'])
        payload = expression_keyframes(
            expression, field=field if field in EXPRESSION_FIELDS else 'v',
            duration=dur, fps=fr, rate=_f(rate, 1, 60, 10.0),
            seed=min(99999, max(0, int(seed or 0))),
            progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id,
                                payload_str=payload,
                                parent_output_id=parent_output_id)
