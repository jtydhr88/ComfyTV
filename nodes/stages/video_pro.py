from ._common import *  # noqa: F401, F403
from ...runners.blend_modes import MERGE_OPERATORS
from ...runners.media_torch import (
    transform_video, corner_pin_video, composite_videos,
)
from ...runners.roto import roto_mask_video
from ...runners.tracker import track_point, track_points
from ...runners.track_solve import solve_track_transforms
from ...runners.text_overlay import title_video, burn_subtitles, list_fonts

from .video_fx import (  # noqa: F401
    _need_video, _progress_cb, _f,
    _hidden_float, _hidden_int, _hidden_str, _hidden_combo,
)


def _parse_json(raw, default):
    try:
        v = json.loads(raw) if isinstance(raw, str) and raw.strip() else default
        return v if v is not None else default
    except (ValueError, TypeError):
        return default


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
        _need_video(video, "Video Transform")
        keys = _parse_json(keyframes, [])
        if (track or '').strip():
            keys = _track_to_keyframes(track, keys)
        if not keys and float(pos_x or 0) == 0 and float(pos_y or 0) == 0 \
                and float(scale or 1) == 1 and float(rotation or 0) == 0 \
                and float(skew_x or 0) == 0:
            raise RuntimeError("Video Transform: everything at identity — move something first.")
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


class RotoMaskStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.RotoMaskStage",
            display_name="Roto Mask",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_str("shape_keys", "",
                            "JSON [{t, points:[{x,y,lx,ly,rx,ry}]}]"),
                _hidden_float("feather", 0.0, 0.0, 200.0, step=1.0),
                io.Boolean.Input("invert", default=False,
                                 socketless=True, extra_dict={"hidden": True}),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("mask")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                shape_keys="", feather=0.0, invert=False, video=""):
        _need_video(video, "Roto Mask")
        keys = _parse_json(shape_keys, [])
        if not keys or not keys[0].get('points') or len(keys[0]['points']) < 3:
            raise RuntimeError(
                "Roto Mask: draw a shape (3+ points) on the node first."
            )
        payload = roto_mask_video(video, keys, feather_px=_f(feather, 0, 200),
                                  invert=bool(invert),
                                  progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class MotionTrackStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.MotionTrackStage",
            display_name="Motion Track",
            category="ComfyTV/Video",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_str("points", "", "JSON [{x,y},...] track points"),
                _hidden_float("point_x", 0.0, 0.0, 8192.0, step=1.0),
                _hidden_float("point_y", 0.0, 0.0, 8192.0, step=1.0),
                _hidden_combo("solve", ['none', 'translation', 'similarity',
                                        'perspective'], 'none'),
                _hidden_float("t_start", 0.0, 0.0, 3600.0, step=0.05),
                _hidden_float("t_end", -1.0, -1.0, 3600.0, step=0.05),
                _hidden_int("pattern", 12, 4, 64, "pattern half-size (px)"),
                _hidden_int("search", 24, 8, 128, "search radius (px)"),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_TEXT.Output("track")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                points="", point_x=0.0, point_y=0.0, solve='none',
                t_start=0.0, t_end=-1.0, pattern=12, search=24, video=""):
        _need_video(video, "Motion Track")
        pts = _parse_json(points, [])
        if not pts and (float(point_x or 0) > 0 or float(point_y or 0) > 0):
            pts = [{'x': float(point_x), 'y': float(point_y)}]
        if not pts:
            raise RuntimeError(
                "Motion Track: click at least one point on the node first."
            )
        result = json.loads(track_points(
            video, pts,
            t_start=_f(t_start, 0, 3600, 0.0), t_end=float(t_end or -1),
            pattern_half=min(64, max(4, int(pattern or 12))),
            search_radius=min(128, max(8, int(search or 24))),
            progress=_progress_cb(cls)))

        first = result['tracks'][0]
        result['x'] = first['x']
        result['y'] = first['y']
        result['confidence'] = first['confidence']
        result['origin'] = first['origin']

        if solve and solve != 'none':
            solved = solve_track_transforms(
                result['tracks'], model=solve,
                w=result['width'], h=result['height'])
            if solve == 'perspective':
                result['corners'] = solved
            else:
                result['transform'] = [
                    {'t': k['t'], 'x': k['x'], 'y': -k['y'],
                     'rotation': -k['rotation'], 'scale': k['scale']}
                    for k in solved]
        payload = json.dumps(result)
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class TitleStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.TitleStage",
            display_name="Title",
            category="ComfyTV/Video",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_str("text", ""),
                _hidden_combo("font", list_fonts() or ['default'],
                              (list_fonts() or ['default'])[0]),
                _hidden_int("size", 48, 8, 400),
                _hidden_str("color", "#FFFFFF"),
                _hidden_int("stroke", 0, 0, 20),
                _hidden_str("stroke_color", "#000000"),
                _hidden_combo("anchor", ['bottom', 'top', 'center', 'top-left',
                                         'top-right', 'bottom-left',
                                         'bottom-right'], 'bottom'),
                _hidden_float("t_start", 0.0, 0.0, 3600.0, step=0.05),
                _hidden_float("t_end", -1.0, -1.0, 3600.0, step=0.05),
                _hidden_float("fade_s", 0.0, 0.0, 10.0, step=0.1),
                _hidden_combo("typewriter", ['off', 'char', 'word', 'line'],
                              'off'),
                _hidden_float("type_step", 0.1, 0.02, 2.0, step=0.01),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                text="", font='', size=48, color="#FFFFFF", stroke=0,
                stroke_color="#000000", anchor='bottom',
                t_start=0.0, t_end=-1.0, fade_s=0.0, typewriter='off',
                type_step=0.1, video=""):
        _need_video(video, "Title")
        if not (text or '').strip():
            raise RuntimeError("Title: type some text first.")
        payload = title_video(
            video, text, font=font, size=min(400, max(8, int(size or 48))),
            color=color or '#FFFFFF', stroke=min(20, max(0, int(stroke or 0))),
            stroke_color=stroke_color or '#000000', anchor=anchor,
            t_start=_f(t_start, 0, 3600, 0.0), t_end=float(t_end or -1),
            fade_s=_f(fade_s, 0, 10, 0.0),
            typewriter='' if typewriter == 'off' else typewriter,
            type_step=_f(type_step, 0.02, 2, 0.1),
            progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class SubtitleStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.SubtitleStage",
            display_name="Subtitles",
            category="ComfyTV/Video",
            inputs=[
                *_standard_stage_inputs(),
                io.String.Input("subs", default="", multiline=True,
                                socketless=True, extra_dict={"hidden": True},
                                tooltip="SRT or WebVTT cue text"),
                _hidden_combo("font", list_fonts() or ['default'],
                              (list_fonts() or ['default'])[0]),
                _hidden_int("size", 36, 8, 200),
                _hidden_str("color", "#FFFFFF"),
                _hidden_int("stroke", 2, 0, 20),
                _hidden_combo("anchor", ['bottom', 'top'], 'bottom'),
                COMFYTV_VIDEO.Input("video", optional=True),
                COMFYTV_TEXT.Input("subs_text", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                subs="", font='', size=36, color="#FFFFFF", stroke=2,
                anchor='bottom', video="", subs_text=""):
        _need_video(video, "Subtitles")
        raw = (subs_text or '').strip() or (subs or '').strip()
        if not raw:
            raise RuntimeError("Subtitles: paste SRT/VTT text or wire a text input.")
        payload = burn_subtitles(
            video, raw, font=font, size=min(200, max(8, int(size or 36))),
            color=color or '#FFFFFF', stroke=min(20, max(0, int(stroke or 2))),
            anchor=anchor, progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)
