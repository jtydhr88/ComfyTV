from ._common import *  # noqa: F401, F403
from ...runners.media_remap import time_remap, frame_hold, render_sequence
from ...runners.media_filter import XFADE_TRANSITIONS
from ...runners.paint import paint_video
from ...runners.stabilize import stabilize_video

from .video_fx import (  # noqa: F401
    _need_video, _progress_cb, _f,
    _hidden_float, _hidden_int, _hidden_str, _hidden_combo,
)
from .video_pro import _parse_json


class TimeRemapStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.TimeRemapStage",
            display_name="Time Remap",
            category="ComfyTV/Video",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("mode", ['speed', 'hold'], 'speed'),
                _hidden_str("speed_keys", "",
                            "JSON [{t (output s), v (speed ×), interp}]"),
                _hidden_int("smooth_fps", 0, 0, 120,
                            "0 = off; >0 pre-interpolates the source to this fps (slow)"),
                _hidden_int("hold_frame", 0, 0, 100000),
                _hidden_int("hold_increment", 0, 0, 1000),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                mode='speed', speed_keys="", smooth_fps=0, hold_frame=0,
                hold_increment=0, video=""):
        _need_video(video, "Time Remap")
        if mode == 'hold':
            payload = frame_hold(
                video, first_frame=max(0, int(hold_frame or 0)),
                increment=max(0, int(hold_increment or 0)),
                progress=_progress_cb(cls))
        else:
            keys = _parse_json(speed_keys, [])
            if not keys:
                raise RuntimeError(
                    "Time Remap: add speed keyframes on the node first "
                    "(constant speed is what Video Speed is for)."
                )
            payload = time_remap(
                video, keys, smooth_fps=min(120, max(0, int(smooth_fps or 0))),
                progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class SequenceStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.SequenceStage",
            display_name="Sequence",
            category="ComfyTV/Compose",
            inputs=[
                *_standard_stage_inputs(),
                io.String.Input("segments", default="", multiline=False,
                                socketless=True, extra_dict={"hidden": True},
                                tooltip='JSON [{slot, in_s, out_s, transition, trans_dur}] '
                                        'in playback order — driven by the segment list UI'),
                io.Autogrow.Input("videos", template=_video_template(12)),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                segments="", videos=None):
        def _norm(k):
            return str(k).split('.')[-1]

        if hasattr(videos, 'items'):
            slots = {_norm(k): v for k, v in videos.items()}
        else:
            slots = {f"video{i}": v for i, v in enumerate(_autogrow_values(videos))}

        seg_defs = _parse_json(segments, [])
        segs = []
        if seg_defs:
            for s in seg_defs:
                url = slots.get(_norm(s.get('slot', '')), '')
                if (url or '').strip():
                    segs.append({**s, 'url': url})
        else:
            segs = [{'url': v, 'transition': 'cut'}
                    for k, v in slots.items() if (v or '').strip()]
        if not segs:
            raise RuntimeError(
                "Sequence needs at least one connected video segment."
            )
        payload = render_sequence(segs, progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class VideoStabilizeV2Stage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoStabilizeV2Stage",
            display_name="Stabilize Pro",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_int("smoothing", 15, 0, 60,
                            "camera-path gaussian radius in frames"),
                _hidden_int("accuracy", 15, 1, 15,
                            "fraction of measurement fields used"),
                io.Boolean.Input("opt_zoom", default=True,
                                 socketless=True, extra_dict={"hidden": True},
                                 tooltip="auto-zoom just enough to hide borders"),
                _hidden_float("extra_zoom", 0.0, 0.0, 30.0, step=0.5),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                smoothing=15, accuracy=15, opt_zoom=True, extra_zoom=0.0,
                video=""):
        _need_video(video, "Stabilize Pro")
        payload = stabilize_video(
            video, smoothing=min(60, max(0, int(smoothing or 15))),
            accuracy=min(15, max(1, int(accuracy or 15))),
            opt_zoom=bool(opt_zoom),
            extra_zoom=_f(extra_zoom, 0, 30, 0.0),
            progress=_progress_cb(cls))
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
