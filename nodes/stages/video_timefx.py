from ._common import *  # noqa: F401, F403
from ...runners.time_fx import (
    SLITSCAN_MODES, SLITSCAN_FILTERS, FEEDBACK_MODES, NERVOUS_STYLES,
    STROBE_MODES,
)

from .common.fx_helpers import (  # noqa: F401
    _need_video, _progress_cb, _f,
    _hidden_float, _hidden_int, _hidden_combo,
)


class SlitScanStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.SlitScanStage",
            display_name="Slit Scan",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("mode", list(SLITSCAN_MODES), 'horizontal'),
                _hidden_float("gain", 24.0, -120.0, 120.0, step=1.0),
                _hidden_float("offset", 0.0, -60.0, 60.0, step=0.5),
                _hidden_combo("filter_mode", list(SLITSCAN_FILTERS),
                              'linear'),
                io.Boolean.Input("invert", default=False, socketless=True,
                                 extra_dict={"hidden": True}),
                COMFYTV_VIDEO.Input("video", optional=True),
                COMFYTV_IMAGE.Input("retime_image", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                mode='horizontal', gain=24.0, offset=0.0,
                filter_mode='linear', invert=False, video="",
                retime_image=""):
        from ...runners.time_fx import slitscan_video

        _need_video(video, "Slit Scan")
        m = mode if mode in SLITSCAN_MODES else 'horizontal'
        ri = (retime_image or '').strip()
        if ri and m != 'map':
            m = 'map'
        if m == 'map' and not ri:
            raise RuntimeError(
                "Slit Scan map mode needs a retime image — wire a grayscale "
                "map or switch to a slit mode.")
        payload = slitscan_video(
            video, mode=m, gain=_f(gain, -120, 120, 24.0),
            offset=_f(offset, -60, 60, 0.0),
            filter_mode=filter_mode if filter_mode in SLITSCAN_FILTERS
            else 'linear',
            invert=bool(invert), map_url=ri, progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id,
                                payload_str=payload,
                                parent_output_id=parent_output_id)


class FeedbackFXStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.FeedbackFXStage",
            display_name="Feedback FX",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("mode", list(FEEDBACK_MODES), 'vertigo'),
                _hidden_float("phase_increment", 0.08, 0.0, 1.0, step=0.005),
                _hidden_float("zoom", 0.06, -0.5, 0.5, step=0.005),
                _hidden_float("feedback_mix", 0.75, 0.0, 0.98, step=0.01),
                _hidden_combo("style", list(NERVOUS_STYLES), 'shuffle'),
                _hidden_int("frames", 32, 2, 32),
                _hidden_int("seed", 7, 0, 99999),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                mode='vertigo', phase_increment=0.08, zoom=0.06,
                feedback_mix=0.75, style='shuffle', frames=32, seed=7,
                video=""):
        params = {
            'mode': mode if mode in FEEDBACK_MODES else 'vertigo',
            'phase_increment': _f(phase_increment, 0, 1, 0.08),
            'zoom': _f(zoom, -0.5, 0.5, 0.06),
            'feedback_mix': _f(feedback_mix, 0, 0.98, 0.75),
            'style': style if style in NERVOUS_STYLES else 'shuffle',
            'frames': min(32, max(2, int(frames or 32))),
            'seed': min(99999, max(0, int(seed or 0))),
        }
        fx_spec = build_torch_fx_spec(
            "ComfyTV.FeedbackFXStage", "Feedback FX", "video", "feedback",
            params)
        return _fx_passthrough(video, fx_spec)


class StrobeStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.StrobeStage",
            display_name="Strobe",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_int("interval", 3, 1, 120),
                _hidden_combo("strobe_mode", list(STROBE_MODES), 'black'),
                io.Boolean.Input("invert", default=False, socketless=True,
                                 extra_dict={"hidden": True}),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                interval=3, strobe_mode='black', invert=False, video=""):
        params = {
            'interval': min(120, max(1, int(interval or 3))),
            'strobe_mode': strobe_mode if strobe_mode in STROBE_MODES
            else 'black',
            'invert': bool(invert),
        }
        fx_spec = build_torch_fx_spec(
            "ComfyTV.StrobeStage", "Strobe", "video", "strobe", params)
        return _fx_passthrough(video, fx_spec)
