from ._common import *  # noqa: F401, F403
from ...runners.stylize_fx import (
    ARTFX_MODES, WATER_PHYSICS, WAVE_ENVELOPES, WAVE_AXES,
)

from .common.fx_helpers import (  # noqa: F401
    _need_video, _progress_cb, _f,
    _hidden_float, _hidden_int, _hidden_combo,
)


class ArtFXStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.ArtFXStage",
            display_name="Art FX",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("mode", list(ARTFX_MODES), 'cartoon'),
                _hidden_float("threshold", 0.12, 0.01, 1.0, step=0.005),
                _hidden_int("levels", 8, 2, 32),
                _hidden_int("diff_space", 1, 1, 4),
                _hidden_float("edge_scale", 1.5, 0.1, 8.0, step=0.05),
                _hidden_int("scatter", 1, 1, 4),
                _hidden_float("color_mix", 0.0, 0.0, 1.0),
                io.Boolean.Input("invert", default=False, socketless=True,
                                 extra_dict={"hidden": True}),
                _hidden_float("azimuth", 135.0, 0.0, 360.0, step=1.0),
                _hidden_float("elevation", 30.0, 0.0, 90.0, step=1.0),
                _hidden_float("emboss_width", 10.0, 1.0, 40.0, step=0.5),
                _hidden_float("dot_radius", 4.0, 1.0, 10.0, step=0.5),
                _hidden_float("angle_c", 15.0, 0.0, 360.0, step=1.0),
                _hidden_float("angle_m", 45.0, 0.0, 360.0, step=1.0),
                _hidden_float("angle_y", 0.0, 0.0, 360.0, step=1.0),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                mode='cartoon', threshold=0.12, levels=8, diff_space=1,
                edge_scale=1.5, scatter=1, color_mix=0.0, invert=False,
                azimuth=135.0, elevation=30.0, emboss_width=10.0,
                dot_radius=4.0, angle_c=15.0, angle_m=45.0, angle_y=0.0,
                video=""):
        params = {
            'mode': mode if mode in ARTFX_MODES else 'cartoon',
            'threshold': _f(threshold, 0.01, 1, 0.12),
            'levels': min(32, max(2, int(levels or 8))),
            'diff_space': min(4, max(1, int(diff_space or 1))),
            'edge_scale': _f(edge_scale, 0.1, 8, 1.5),
            'scatter': min(4, max(1, int(scatter or 1))),
            'color_mix': _f(color_mix, 0, 1, 0.0),
            'invert': bool(invert),
            'azimuth': _f(azimuth, 0, 360, 135.0),
            'elevation': _f(elevation, 0, 90, 30.0),
            'emboss_width': _f(emboss_width, 1, 40, 10.0),
            'dot_radius': _f(dot_radius, 1, 10, 4.0),
            'angle_c': _f(angle_c, 0, 360, 15.0),
            'angle_m': _f(angle_m, 0, 360, 45.0),
            'angle_y': _f(angle_y, 0, 360, 0.0),
        }
        fx_spec = build_torch_fx_spec(
            "ComfyTV.ArtFXStage", "Art FX", "video", "artfx", params)
        return _fx_passthrough(video, fx_spec)


class GlitchFXStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.GlitchFXStage",
            display_name="Glitch FX",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_float("chance", 0.5, 0.0, 1.0),
                _hidden_float("block_h", 0.2, 0.01, 1.0),
                _hidden_float("shift", 0.2, 0.01, 1.0),
                _hidden_int("color_intensity", 3, 0, 4),
                _hidden_int("seed", 7, 0, 99999),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                chance=0.5, block_h=0.2, shift=0.2, color_intensity=3,
                seed=7, video=""):
        params = {
            'chance': _f(chance, 0, 1, 0.5),
            'block_h': _f(block_h, 0.01, 1, 0.2),
            'shift': _f(shift, 0.01, 1, 0.2),
            'color_intensity': min(4, max(0, int(color_intensity or 0))),
            'seed': min(99999, max(0, int(seed or 0))),
        }
        if params['chance'] <= 0:
            return _fx_identity(video)
        fx_spec = build_torch_fx_spec(
            "ComfyTV.GlitchFXStage", "Glitch FX", "video", "glitch", params)
        return _fx_passthrough(video, fx_spec)


class KaleidoscopeStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.KaleidoscopeStage",
            display_name="Kaleidoscope",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_int("segments", 6, 1, 64),
                _hidden_float("angle", 0.0, -180.0, 180.0, step=1.0),
                _hidden_float("source_angle", 0.0, -180.0, 180.0, step=1.0),
                _hidden_float("center_x", 0.5, 0.0, 1.0),
                _hidden_float("center_y", 0.5, 0.0, 1.0),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                segments=6, angle=0.0, source_angle=0.0, center_x=0.5,
                center_y=0.5, video=""):
        params = {
            'segments': min(64, max(1, int(segments or 6))),
            'angle': _f(angle, -180, 180, 0.0),
            'source_angle': _f(source_angle, -180, 180, 0.0),
            'center_x': _f(center_x, 0, 1, 0.5),
            'center_y': _f(center_y, 0, 1, 0.5),
        }
        fx_spec = build_torch_fx_spec(
            "ComfyTV.KaleidoscopeStage", "Kaleidoscope", "video", "kaleido",
            params)
        return _fx_passthrough(video, fx_spec)


class WaveWarpStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.WaveWarpStage",
            display_name="Wave Warp",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_float("amplitude", 16.0, 0.0, 200.0, step=1.0),
                _hidden_float("frequency", 3.0, 0.1, 40.0, step=0.1),
                _hidden_float("speed", 0.5, -8.0, 8.0, step=0.05),
                _hidden_combo("axis", list(WAVE_AXES), 'both'),
                _hidden_combo("envelope", list(WAVE_ENVELOPES), 'parabolic'),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                amplitude=16.0, frequency=3.0, speed=0.5, axis='both',
                envelope='parabolic', video=""):
        params = {
            'amplitude': _f(amplitude, 0, 200, 16.0),
            'frequency': _f(frequency, 0.1, 40, 3.0),
            'speed': _f(speed, -8, 8, 0.5),
            'axis': axis if axis in WAVE_AXES else 'both',
            'envelope': envelope if envelope in WAVE_ENVELOPES
            else 'parabolic',
        }
        if params['amplitude'] <= 0:
            return _fx_identity(video)
        fx_spec = build_torch_fx_spec(
            "ComfyTV.WaveWarpStage", "Wave Warp", "video", "wave_warp",
            params)
        return _fx_passthrough(video, fx_spec)


class WaterStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.WaterStage",
            display_name="Water",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("physics", list(WATER_PHYSICS), 'water'),
                io.Boolean.Input("rain", default=True, socketless=True,
                                 extra_dict={"hidden": True}),
                io.Boolean.Input("swirl", default=False, socketless=True,
                                 extra_dict={"hidden": True}),
                _hidden_int("rain_every", 4, 1, 24),
                _hidden_float("amplitude", 0.5, 0.0, 1.0),
                _hidden_float("swirl_x", 0.0, -0.5, 0.5),
                _hidden_float("swirl_y", 0.0, -0.5, 0.5),
                _hidden_int("seed", 7, 0, 99999),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                physics='water', rain=True, swirl=False, rain_every=4,
                amplitude=0.5, swirl_x=0.0, swirl_y=0.0, seed=7, video=""):
        params = {
            'physics': physics if physics in WATER_PHYSICS else 'water',
            'rain': bool(rain),
            'swirl': bool(swirl),
            'rain_every': min(24, max(1, int(rain_every or 4))),
            'amplitude': _f(amplitude, 0, 1, 0.5),
            'swirl_x': _f(swirl_x, -0.5, 0.5, 0.0),
            'swirl_y': _f(swirl_y, -0.5, 0.5, 0.0),
            'seed': min(99999, max(0, int(seed or 0))),
        }
        if not params['rain'] and not params['swirl']:
            return _fx_identity(video)
        fx_spec = build_torch_fx_spec(
            "ComfyTV.WaterStage", "Water", "video", "water", params)
        return _fx_passthrough(video, fx_spec)


class LightGraffitiStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.LightGraffitiStage",
            display_name="Light Graffiti",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_float("threshold", 0.9, 0.5, 1.0, step=0.005),
                _hidden_float("sum_threshold", 2.2, 0.0, 3.0, step=0.05),
                _hidden_float("decay", 0.0, 0.0, 1.0, step=0.005),
                _hidden_float("gain", 1.0, 0.1, 4.0, step=0.05),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                threshold=0.9, sum_threshold=2.2, decay=0.0, gain=1.0,
                video=""):
        params = {
            'threshold': _f(threshold, 0.5, 1, 0.9),
            'sum_threshold': _f(sum_threshold, 0, 3, 2.2),
            'decay': _f(decay, 0, 1, 0.0),
            'gain': _f(gain, 0.1, 4, 1.0),
        }
        fx_spec = build_torch_fx_spec(
            "ComfyTV.LightGraffitiStage", "Light Graffiti", "video",
            "light_graffiti", params)
        return _fx_passthrough(video, fx_spec)
