from ._common import *  # noqa: F401, F403
from ...runners.media import get_video_info
from ...runners.media_filter import filter_video
from ...runners.roto import roto_mask_video
from ...runners.tracker import track_points
from ...runners.track_solve import solve_track_transforms
from ...runners.mask_propagate import propagate_mask_video
from ...runners.paint import paint_video

from .common.fx_helpers import (  # noqa: F401
    _need_video, _progress_cb, _f, _parse_json,
    _hidden_float, _hidden_int, _hidden_str, _hidden_combo,
)


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


class MaskPropagateStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.MaskPropagateStage",
            display_name="Mask Propagate",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("model", ['translation', 'similarity', 'perspective'],
                              'similarity'),
                _hidden_float("t_ref", 0.0, 0.0, 3600.0, step=0.05),
                _hidden_int("max_points", 24, 4, 64),
                io.Boolean.Input("invert", default=False,
                                 socketless=True, extra_dict={"hidden": True}),
                COMFYTV_VIDEO.Input("video", optional=True),
                COMFYTV_IMAGE.Input("mask", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("mask")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                model='similarity', t_ref=0.0, max_points=24, invert=False,
                video="", mask=""):
        _need_video(video, "Mask Propagate")
        if not (mask or '').strip():
            raise RuntimeError(
                "Mask Propagate needs a first-frame mask image — wire one in "
                "(the Split Part stage's SAM output works)."
            )
        payload = propagate_mask_video(
            video, mask, t_ref=_f(t_ref, 0, 3600, 0.0), model=model,
            max_points=min(64, max(4, int(max_points or 24))),
            invert=bool(invert), progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class PaintStrokeStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.PaintStrokeStage",
            display_name="Paint Strokes",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_str("strokes", "",
                            "JSON [{mode, points:[{x,y,p}], radius, hardness, "
                            "dx, dy, sigma, color}]"),
                _hidden_float("t_start", 0.0, 0.0, 3600.0, step=0.05),
                _hidden_float("t_end", -1.0, -1.0, 3600.0, step=0.05),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                strokes="", t_start=0.0, t_end=-1.0, video=""):
        _need_video(video, "Paint Strokes")
        parsed = _parse_json(strokes, [])
        if not parsed:
            raise RuntimeError("Paint Strokes: draw a stroke on the node first.")
        payload = paint_video(video, parsed,
                              t_start=_f(t_start, 0, 3600, 0.0),
                              t_end=float(t_end or -1),
                              progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


ANNOTATE_MODES = ['box', 'grid', 'fillborders', 'scroll']
FILLBORDER_MODES = ['smear', 'mirror', 'fixed', 'reflect', 'wrap', 'fade']


def _hex_color(raw, default="4ADE80"):
    c = (raw or '').strip().lstrip('#')
    if len(c) in (6, 8) and all(ch in '0123456789abcdefABCDEF' for ch in c):
        return c
    return default


class AnnotateStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AnnotateStage",
            display_name="Annotate",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("mode", ANNOTATE_MODES, 'box'),
                _hidden_float("x", 0.25, 0.0, 1.0),
                _hidden_float("y", 0.25, 0.0, 1.0),
                _hidden_float("w", 0.5, 0.0, 1.0),
                _hidden_float("h", 0.5, 0.0, 1.0),
                _hidden_str("color", "#4ADE80"),
                _hidden_int("thickness", 3, 1, 40),
                _hidden_float("opacity", 1.0, 0.0, 1.0),
                _hidden_combo("border_mode", FILLBORDER_MODES, 'mirror'),
                _hidden_int("border_px", 32, 0, 512),
                _hidden_float("scroll_h", 0.0, -1.0, 1.0),
                _hidden_float("scroll_v", 0.0, -1.0, 1.0),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                mode='box', x=0.25, y=0.25, w=0.5, h=0.5, color="#4ADE80",
                thickness=3, opacity=1.0, border_mode='mirror', border_px=32,
                scroll_h=0.0, scroll_v=0.0, video=""):
        _need_video(video, "Annotate")
        col = _hex_color(color)
        op = _f(opacity, 0, 1, 1.0)
        th = min(40, max(1, int(thickness)))
        if mode == 'box':
            specs = [('drawbox',
                      f'x=iw*{_f(x, 0, 1, 0.25)}:y=ih*{_f(y, 0, 1, 0.25)}'
                      f':w=iw*{_f(w, 0, 1, 0.5)}:h=ih*{_f(h, 0, 1, 0.5)}'
                      f':color=0x{col}@{op}:t={th}')]
        elif mode == 'grid':
            specs = [('drawgrid',
                      f'w=iw*{max(0.01, _f(w, 0, 1, 0.5))}'
                      f':h=ih*{max(0.01, _f(h, 0, 1, 0.5))}'
                      f':color=0x{col}@{op}:t={th}')]
        elif mode == 'fillborders':
            px = min(512, max(0, int(border_px)))
            if px <= 0:
                raise RuntimeError("Annotate: border size is zero.")
            info = get_video_info(video)
            px = max(1, min(px, int(info['width']) // 2,
                            int(info['height']) // 2))
            bm = border_mode if border_mode in FILLBORDER_MODES else 'mirror'
            specs = [('fillborders',
                      f'left={px}:right={px}:top={px}:bottom={px}:mode={bm}')]
        elif mode == 'scroll':
            sh = _f(scroll_h, -1, 1, 0.0)
            sv = _f(scroll_v, -1, 1, 0.0)
            if not sh and not sv:
                raise RuntimeError("Annotate: scroll speed is zero.")
            specs = [('scroll', f'horizontal={sh}:vertical={sv}')]
        else:
            raise RuntimeError(f"Annotate: unknown mode {mode!r}")
        payload = filter_video(video, specs, progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)
