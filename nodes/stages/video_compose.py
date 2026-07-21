from ._common import *  # noqa: F401, F403
from ...runners.blend_modes import MERGE_OPERATORS
from ...runners.media_torch import (
    transform_video, corner_pin_video, composite_videos,
)
from ...runners.uvmap import uv_remap_video

from .common.fx_helpers import (  # noqa: F401
    _need_video, _progress_cb, _f, _parse_json,
    _hidden_float, _hidden_str, _hidden_combo,
)


def _track_to_keyframes(track_raw, base_keys):
    track = _parse_json(track_raw, None)
    if not track:
        return base_keys
    if isinstance(track, list):
        keys = [k for k in track if isinstance(k, dict) and 't' in k]
        return keys or base_keys
    if 'transform' in track:
        return [{'t': k['t'], 'x': k['x'], 'y': k['y'],
                 'rotation': k.get('rotation', 0.0),
                 'scale': k.get('scale', 1.0), 'interp': 'linear'}
                for k in track['transform']]
    if 'x' not in track or 'y' not in track:
        return base_keys
    ox, oy = (track.get('origin') or [0, 0])[:2]
    keys = []
    for kx, ky in zip(track['x'], track['y']):
        keys.append({'t': kx['t'], 'x': kx['v'] - ox, 'y': -(ky['v'] - oy),
                     'interp': 'linear'})
    return keys


def _track_to_corner_keys(track_raw):
    track = _parse_json(track_raw, None)
    if not track or 'corners' not in track:
        return None
    return [{'t': k['t'], 'corners': k['corners']} for k in track['corners']]


class VideoCompositeStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoCompositeStage",
            display_name="Video Composite",
            category="ComfyTV/Compose",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("operator", MERGE_OPERATORS, 'over'),
                _hidden_float("opacity", 1.0, 0.0, 1.0),
                _hidden_float("pos_x", 0.0, -8192.0, 8192.0, step=1.0),
                _hidden_float("pos_y", 0.0, -8192.0, 8192.0, step=1.0),
                _hidden_float("scale", 1.0, 0.01, 10.0),
                _hidden_float("rotation", 0.0, -360.0, 360.0, step=0.5),
                _hidden_str("keyframes", "",
                            "JSON [{t,x,y,scale,rotation,opacity,interp}]"),
                COMFYTV_VIDEO.Input("background", optional=True),
                COMFYTV_VIDEO.Input("foreground", optional=True),
                COMFYTV_VIDEO.Input("mask", optional=True),
                COMFYTV_TEXT.Input("track", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                operator='over', opacity=1.0, pos_x=0.0, pos_y=0.0,
                scale=1.0, rotation=0.0, keyframes="",
                background="", foreground="", mask="", track=""):
        if not (background or '').strip() or not (foreground or '').strip():
            raise RuntimeError(
                "Video Composite needs background and foreground videos."
            )
        keys = _parse_json(keyframes, [])
        if (track or '').strip():
            keys = _track_to_keyframes(track, keys)
        payload = composite_videos(
            background, foreground, operator=operator,
            opacity=_f(opacity, 0, 1, 1.0),
            translate_x=float(pos_x or 0), translate_y=float(pos_y or 0),
            scale=_f(scale, 0.01, 10, 1.0), rotation_deg=float(rotation or 0),
            keyframes=keys or None,
            mask_url=(mask or '').strip() or None,
            progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class VideoTransformStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoTransformStage",
            display_name="Video Transform",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_float("pos_x", 0.0, -8192.0, 8192.0, step=1.0),
                _hidden_float("pos_y", 0.0, -8192.0, 8192.0, step=1.0),
                _hidden_float("scale", 1.0, 0.01, 10.0),
                _hidden_float("rotation", 0.0, -360.0, 360.0, step=0.5),
                _hidden_float("skew_x", 0.0, -2.0, 2.0),
                _hidden_float("motion_blur", 0.0, 0.0, 4.0,
                              tooltip="0 = off; higher = more shutter samples"),
                _hidden_float("shutter", 0.5, 0.0, 4.0, step=0.05),
                _hidden_combo("shutter_type", ['centered', 'start', 'end',
                                               'custom'], 'centered'),
                _hidden_float("shutter_offset", 0.0, -4.0, 4.0, step=0.05),
                _hidden_str("keyframes", "", "JSON [{t,x,y,scale,rotation,interp}]"),
                COMFYTV_VIDEO.Input("video", optional=True),
                COMFYTV_TEXT.Input("track", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                pos_x=0.0, pos_y=0.0, scale=1.0, rotation=0.0, skew_x=0.0,
                motion_blur=0.0, shutter=0.5, shutter_type='centered',
                shutter_offset=0.0, keyframes="", video="", track=""):
        keys = _parse_json(keyframes, [])
        if (track or '').strip():
            keys = _track_to_keyframes(track, keys)
        identity = not keys and float(pos_x or 0) == 0 \
            and float(pos_y or 0) == 0 and float(scale or 1) == 1 \
            and float(rotation or 0) == 0 and float(skew_x or 0) == 0
        if not (track or '').strip():
            if identity:
                return _fx_identity(video)
            fx_spec = build_torch_fx_spec(
                "ComfyTV.VideoTransformStage", "Video Transform", "video",
                "transform",
                {'pos_x': float(pos_x or 0), 'pos_y': float(pos_y or 0),
                 'scale': _f(scale, 0.01, 10, 1.0),
                 'rotation': float(rotation or 0),
                 'skew_x': _f(skew_x, -2, 2, 0.0),
                 'keyframes': keys or [],
                 'motion_blur': _f(motion_blur, 0, 4, 0.0),
                 'shutter': _f(shutter, 0, 4, 0.5),
                 'shutter_type': shutter_type,
                 'shutter_offset': _f(shutter_offset, -4, 4, 0.0)})
            return _fx_passthrough(video, fx_spec)
        _need_video(video, "Video Transform")
        video = bake_fx_video(video, progress=_progress_cb(cls))
        payload = transform_video(
            video, translate_x=float(pos_x or 0), translate_y=float(pos_y or 0),
            scale=_f(scale, 0.01, 10, 1.0), rotation_deg=float(rotation or 0),
            skew_x=_f(skew_x, -2, 2, 0.0), keyframes=keys or None,
            motion_blur=_f(motion_blur, 0, 4, 0.0),
            shutter=_f(shutter, 0, 4, 0.5), shutter_type=shutter_type,
            shutter_offset=_f(shutter_offset, -4, 4, 0.0),
            progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class CornerPinStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.CornerPinStage",
            display_name="Corner Pin",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_str("corners", "",
                            "JSON [[x1,y1],[x2,y2],[x3,y3],[x4,y4]] TL,TR,BR,BL"),
                _hidden_str("keyframes", "", "JSON [{t, corners}]"),
                COMFYTV_VIDEO.Input("video", optional=True),
                COMFYTV_TEXT.Input("track", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                corners="", keyframes="", video="", track=""):
        _need_video(video, "Corner Pin")
        pts = _parse_json(corners, None)
        keys = _parse_json(keyframes, [])
        if (track or '').strip():
            track_keys = _track_to_corner_keys(track)
            if track_keys:
                keys = track_keys
        if (not pts or len(pts) != 4) and not keys:
            raise RuntimeError(
                "Corner Pin: drag the four corners on the node first."
            )
        payload = corner_pin_video(video, pts, keyframes=keys or None,
                                   progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class STMapStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.STMapStage",
            display_name="UV Remap",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("mode", ['stmap', 'idistort'], 'stmap'),
                _hidden_combo("wrap", ['clamp', 'repeat', 'mirror'], 'clamp'),
                io.Boolean.Input("flip_v", default=True,
                                 socketless=True, extra_dict={"hidden": True}),
                _hidden_float("amount", 32.0, 0.0, 512.0, step=1.0),
                _hidden_float("u_offset", 0.0, -1.0, 1.0),
                _hidden_float("v_offset", 0.0, -1.0, 1.0),
                _hidden_float("u_scale", 1.0, -4.0, 4.0),
                _hidden_float("v_scale", 1.0, -4.0, 4.0),
                COMFYTV_VIDEO.Input("video", optional=True),
                COMFYTV_VIDEO.Input("uv_video", optional=True),
                COMFYTV_IMAGE.Input("uv_image", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                mode='stmap', wrap='clamp', flip_v=True, amount=32.0,
                u_offset=0.0, v_offset=0.0, u_scale=1.0, v_scale=1.0,
                video="", uv_video="", uv_image=""):
        _need_video(video, "UV Remap")
        uv = (uv_video or '').strip() or (uv_image or '').strip()
        if not uv:
            raise RuntimeError(
                "UV Remap needs a UV source — wire a uv_video or uv_image input."
            )
        payload = uv_remap_video(
            video, uv, mode=mode, wrap=wrap, flip_v=bool(flip_v),
            amount=_f(amount, 0, 512, 32.0),
            u_offset=_f(u_offset, -1, 1), v_offset=_f(v_offset, -1, 1),
            u_scale=_f(u_scale, -4, 4, 1.0), v_scale=_f(v_scale, -4, 4, 1.0),
            progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)
