from ._common import *  # noqa: F401, F403
from ...runners.patterns import (
    generate_pattern_video, ken_burns_video, PATTERN_KINDS, RAMP_INTERPS,
)

from .common.fx_helpers import (  # noqa: F401
    _progress_cb, _f,
    _hidden_float, _hidden_int, _hidden_str, _hidden_combo,
)


class PatternStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.PatternStage",
            display_name="Pattern",
            category="ComfyTV/Video",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("kind", PATTERN_KINDS, 'ramp'),
                _hidden_int("width", 1280, 16, 4096),
                _hidden_int("height", 720, 16, 4096),
                _hidden_int("fps", 24, 1, 120),
                _hidden_float("duration", 5.0, 0.5, 120.0, step=0.5),
                _hidden_str("color0", "#000000"),
                _hidden_str("color1", "#FFFFFF"),
                _hidden_float("p0_x", 0.0, 0.0, 1.0),
                _hidden_float("p0_y", 0.5, 0.0, 1.0),
                _hidden_float("p1_x", 1.0, 0.0, 1.0),
                _hidden_float("p1_y", 0.5, 0.0, 1.0),
                _hidden_combo("interp", RAMP_INTERPS, 'linear'),
                _hidden_float("softness", 0.0, 0.0, 1.0),
                _hidden_int("noise_scale", 64, 4, 512),
                _hidden_int("noise_octaves", 4, 1, 8),
                _hidden_float("noise_speed", 1.0, 0.0, 10.0),
                _hidden_int("seed", 7, 0, 99999),
                _hidden_int("box_size", 64, 2, 1024),
                _hidden_float("bar_intensity", 75.0, 1.0, 100.0, step=1.0),
                _hidden_float("wheel_gamma", 0.45, 0.0, 4.0),
                _hidden_float("wheel_rotate", 0.0, -180.0, 180.0, step=1.0),
                _hidden_combo("count_style", ['seconds', 'frames'], 'seconds'),
                _hidden_combo("count_direction", ['down', 'up'], 'down'),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                kind='ramp', width=1280, height=720, fps=24, duration=5.0,
                color0="#000000", color1="#FFFFFF",
                p0_x=0.0, p0_y=0.5, p1_x=1.0, p1_y=0.5,
                interp='linear', softness=0.0,
                noise_scale=64, noise_octaves=4, noise_speed=1.0, seed=7,
                box_size=64, bar_intensity=75.0, wheel_gamma=0.45,
                wheel_rotate=0.0, count_style='seconds',
                count_direction='down'):
        payload = generate_pattern_video(
            kind, width=int(width), height=int(height), fps=int(fps),
            duration=_f(duration, 0.5, 120, 5.0),
            color0=color0 or '#000000', color1=color1 or '#FFFFFF',
            p0=(_f(p0_x, 0, 1, 0.0), _f(p0_y, 0, 1, 0.5)),
            p1=(_f(p1_x, 0, 1, 1.0), _f(p1_y, 0, 1, 0.5)),
            interp=interp, softness=_f(softness, 0, 1, 0.0),
            noise_scale=int(noise_scale), noise_octaves=int(noise_octaves),
            noise_speed=_f(noise_speed, 0, 10, 1.0), seed=int(seed or 0),
            box_size=min(1024, max(2, int(box_size or 64))),
            bar_intensity=_f(bar_intensity, 1, 100, 75.0),
            wheel_gamma=_f(wheel_gamma, 0, 4, 0.45),
            wheel_rotate=_f(wheel_rotate, -180, 180, 0.0),
            count_style=count_style, count_direction=count_direction,
            progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class KenBurnsStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.KenBurnsStage",
            display_name="Ken Burns",
            category="ComfyTV/Video",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_int("width", 1280, 16, 4096),
                _hidden_int("height", 720, 16, 4096),
                _hidden_int("fps", 24, 1, 120),
                _hidden_float("duration", 5.0, 0.5, 120.0, step=0.5),
                _hidden_float("start_zoom", 1.0, 1.0, 6.0),
                _hidden_float("end_zoom", 1.3, 1.0, 6.0),
                _hidden_float("start_x", 0.5, 0.0, 1.0),
                _hidden_float("start_y", 0.5, 0.0, 1.0),
                _hidden_float("end_x", 0.5, 0.0, 1.0),
                _hidden_float("end_y", 0.5, 0.0, 1.0),
                _hidden_combo("interp", ['linear', 'smooth', 'ease_in',
                                         'ease_out'], 'smooth'),
                COMFYTV_IMAGE.Input("image", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                width=1280, height=720, fps=24, duration=5.0,
                start_zoom=1.0, end_zoom=1.3, start_x=0.5, start_y=0.5,
                end_x=0.5, end_y=0.5, interp='smooth', image=""):
        if not (image or '').strip():
            raise RuntimeError(
                "Ken Burns needs an image — wire one into the image input.")
        payload = ken_burns_video(
            image, width=int(width), height=int(height), fps=int(fps),
            duration=_f(duration, 0.5, 120, 5.0),
            start_zoom=_f(start_zoom, 1, 6, 1.0),
            end_zoom=_f(end_zoom, 1, 6, 1.3),
            start_x=_f(start_x, 0, 1, 0.5), start_y=_f(start_y, 0, 1, 0.5),
            end_x=_f(end_x, 0, 1, 0.5), end_y=_f(end_y, 0, 1, 0.5),
            interp=interp, progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)
