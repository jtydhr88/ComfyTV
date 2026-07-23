from ._common import *  # noqa: F401, F403
from ...runners.optics import LENS_MODELS, LENS_DIRECTIONS, LENS_EDGES

from .common.fx_helpers import (  # noqa: F401
    _need_video, _progress_cb, _f,
    _hidden_float, _hidden_int, _hidden_combo,
)

V360_PROJECTIONS = ['equirect', 'flat', 'fisheye', 'dfisheye', 'sg', 'eac',
                    'ball', 'hammer', 'cylindrical', 'pannini', 'barrel']
_V360_CODES = {
    'equirect': 'e', 'flat': 'flat', 'fisheye': 'fisheye',
    'dfisheye': 'dfisheye', 'sg': 'sg', 'eac': 'eac', 'ball': 'ball',
    'hammer': 'hammer', 'cylindrical': 'cylindrical', 'pannini': 'pannini',
    'barrel': 'barrel',
}
V360_INTERPS = ['linear', 'cubic', 'lanczos', 'nearest']


class LensDistortStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.LensDistortStage",
            display_name="Lens Distort",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("model", LENS_MODELS, 'nuke_k1k2'),
                _hidden_combo("direction", LENS_DIRECTIONS, 'undistort'),
                _hidden_float("k1", 0.0, -1.0, 1.0, step=0.005),
                _hidden_float("k2", 0.0, -1.0, 1.0, step=0.005),
                _hidden_float("fov", 140.0, 20.0, 180.0, step=1.0),
                _hidden_float("center_x", 0.0, -0.5, 0.5),
                _hidden_float("center_y", 0.0, -0.5, 0.5),
                _hidden_float("squeeze", 1.0, 0.5, 2.0),
                _hidden_float("lens_scale", 1.0, 0.25, 4.0),
                _hidden_combo("edge", LENS_EDGES, 'clamp'),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                model='nuke_k1k2', direction='undistort', k1=0.0, k2=0.0,
                fov=140.0, center_x=0.0, center_y=0.0, squeeze=1.0,
                lens_scale=1.0, edge='clamp', video=""):
        params = {
            'model': model if model in LENS_MODELS else 'nuke_k1k2',
            'direction': direction if direction in LENS_DIRECTIONS
            else 'undistort',
            'k1': _f(k1, -1, 1, 0.0), 'k2': _f(k2, -1, 1, 0.0),
            'fov': _f(fov, 20, 180, 140.0),
            'center_x': _f(center_x, -0.5, 0.5, 0.0),
            'center_y': _f(center_y, -0.5, 0.5, 0.0),
            'squeeze': _f(squeeze, 0.5, 2, 1.0),
            'lens_scale': _f(lens_scale, 0.25, 4, 1.0),
            'edge': edge if edge in LENS_EDGES else 'clamp',
        }
        if params['model'] == 'nuke_k1k2' and not params['k1'] \
                and not params['k2'] and params['squeeze'] == 1.0 \
                and params['lens_scale'] == 1.0 \
                and not params['center_x'] and not params['center_y']:
            return _fx_identity(video)
        fx_spec = build_torch_fx_spec(
            "ComfyTV.LensDistortStage", "Lens Distort", "video",
            "lens_distort", params)
        return _fx_passthrough(video, fx_spec)


class ChromaticAberrationStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.ChromaticAberrationStage",
            display_name="Chromatic Aberration",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_float("amount", 0.01, -0.05, 0.05, step=0.001),
                _hidden_float("falloff", 1.0, 0.5, 3.0),
                _hidden_float("center_x", 0.0, -0.5, 0.5),
                _hidden_float("center_y", 0.0, -0.5, 0.5),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                amount=0.01, falloff=1.0, center_x=0.0, center_y=0.0,
                video=""):
        amt = _f(amount, -0.05, 0.05, 0.01)
        if not amt:
            return _fx_identity(video)
        fx_spec = build_torch_fx_spec(
            "ComfyTV.ChromaticAberrationStage", "Chromatic Aberration",
            "video", "chroma_ab",
            {'amount': amt, 'falloff': _f(falloff, 0.5, 3, 1.0),
             'center_x': _f(center_x, -0.5, 0.5, 0.0),
             'center_y': _f(center_y, -0.5, 0.5, 0.0)})
        return _fx_passthrough(video, fx_spec)


class LensFlareStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.LensFlareStage",
            display_name="Lens Flare",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_float("pos_x", 0.75, 0.0, 1.0),
                _hidden_float("pos_y", 0.25, 0.0, 1.0),
                _hidden_float("intensity", 0.8, 0.0, 3.0),
                _hidden_float("size", 0.25, 0.05, 1.0),
                _hidden_float("streak", 0.5, 0.0, 1.0),
                _hidden_int("ghosts", 5, 0, 8),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                pos_x=0.75, pos_y=0.25, intensity=0.8, size=0.25,
                streak=0.5, ghosts=5, video=""):
        inten = _f(intensity, 0, 3, 0.8)
        if not inten:
            return _fx_identity(video)
        fx_spec = build_torch_fx_spec(
            "ComfyTV.LensFlareStage", "Lens Flare", "video", "lens_flare",
            {'pos_x': _f(pos_x, 0, 1, 0.75), 'pos_y': _f(pos_y, 0, 1, 0.25),
             'intensity': inten, 'size': _f(size, 0.05, 1, 0.25),
             'streak': _f(streak, 0, 1, 0.5),
             'ghosts': max(0, min(8, int(ghosts or 0)))})
        return _fx_passthrough(video, fx_spec)


class ZDefocusStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        from ...runners.zdefocus import BOKEH_SHAPES
        return io.Schema(
            node_id="ComfyTV.ZDefocusStage",
            display_name="Z Defocus",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_float("focus_depth", 0.5, 0.0, 1.0),
                _hidden_float("focus_range", 0.15, 0.0, 1.0),
                _hidden_int("max_radius", 16, 1, 48),
                _hidden_int("layers", 8, 3, 12),
                _hidden_combo("shape", BOKEH_SHAPES, 'disc'),
                _hidden_float("highlight_boost", 0.0, 0.0, 3.0),
                io.Boolean.Input("invert_depth", default=False,
                                 socketless=True,
                                 extra_dict={"hidden": True}),
                COMFYTV_VIDEO.Input("video", optional=True),
                COMFYTV_IMAGE.Input("depth_image", optional=True),
                COMFYTV_VIDEO.Input("depth_video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                focus_depth=0.5, focus_range=0.15, max_radius=16, layers=8,
                shape='disc', highlight_boost=0.0, invert_depth=False,
                video="", depth_image="", depth_video=""):
        from ...runners.zdefocus import BOKEH_SHAPES, zdefocus_video

        _need_video(video, "Z Defocus")
        depth_vid = (depth_video or '').strip()
        depth_img = (depth_image or '').strip()
        if not depth_vid and not depth_img:
            raise RuntimeError(
                "Z Defocus needs a depth map — wire a depth image or depth "
                "video (e.g. from Depth Anything)."
            )
        payload = zdefocus_video(
            video, depth_vid or depth_img,
            depth_is_video=bool(depth_vid),
            focus_depth=_f(focus_depth, 0, 1, 0.5),
            focus_range=_f(focus_range, 0, 1, 0.15),
            max_radius=max(1, min(48, int(max_radius or 16))),
            layers=max(3, min(12, int(layers or 8))),
            shape=shape if shape in BOKEH_SHAPES else 'disc',
            highlight_boost=_f(highlight_boost, 0, 3, 0.0),
            invert_depth=bool(invert_depth),
            progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id,
                                payload_str=payload,
                                parent_output_id=parent_output_id)


class Video360Stage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.Video360Stage",
            display_name="360 Projection",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("proj_in", V360_PROJECTIONS, 'equirect'),
                _hidden_combo("proj_out", V360_PROJECTIONS, 'flat'),
                _hidden_float("v360_yaw", 0.0, -180.0, 180.0, step=1.0),
                _hidden_float("v360_pitch", 0.0, -180.0, 180.0, step=1.0),
                _hidden_float("v360_roll", 0.0, -180.0, 180.0, step=1.0),
                _hidden_float("v360_fov", 0.0, 0.0, 360.0, step=1.0,
                              tooltip="output horizontal FOV, 0 = default"),
                _hidden_combo("v360_interp", V360_INTERPS, 'cubic'),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                proj_in='equirect', proj_out='flat', v360_yaw=0.0,
                v360_pitch=0.0, v360_roll=0.0, v360_fov=0.0,
                v360_interp='cubic', video=""):
        pin = proj_in if proj_in in _V360_CODES else 'equirect'
        pout = proj_out if proj_out in _V360_CODES else 'flat'
        yaw = _f(v360_yaw, -180, 180, 0.0)
        pitch = _f(v360_pitch, -180, 180, 0.0)
        roll = _f(v360_roll, -180, 180, 0.0)
        fov = _f(v360_fov, 0, 360, 0.0)
        if pin == pout and not (yaw or pitch or roll or fov):
            return _fx_identity(video)
        interp = v360_interp if v360_interp in V360_INTERPS else 'cubic'
        parts = [f'input={_V360_CODES[pin]}', f'output={_V360_CODES[pout]}',
                 f'interp={interp}']
        if yaw:
            parts.append(f'yaw={yaw}')
        if pitch:
            parts.append(f'pitch={pitch}')
        if roll:
            parts.append(f'roll={roll}')
        if fov:
            parts.append(f'h_fov={fov}')
            parts.append(f'v_fov={fov * 9 / 16:.2f}')
        fx_spec = build_fx_spec(
            "ComfyTV.Video360Stage", "360 Projection", "video",
            [('v360', ':'.join(parts))],
            params={'proj_in': pin, 'proj_out': pout, 'v360_yaw': yaw,
                    'v360_pitch': pitch, 'v360_roll': roll, 'v360_fov': fov,
                    'v360_interp': interp})
        return _fx_passthrough(video, fx_spec)
