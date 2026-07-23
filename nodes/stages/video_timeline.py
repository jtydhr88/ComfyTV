from ._common import *  # noqa: F401, F403
from ...runners.media_filter import xfade_videos, XFADE_TRANSITIONS
from ...runners.media_remap import time_remap, frame_hold, render_sequence
from ...runners.luma_maps import LUMA_MAP_KINDS

from .common.fx_helpers import (  # noqa: F401
    _need_video, _progress_cb, _f, _parse_json,
    _hidden_float, _hidden_int, _hidden_str, _hidden_combo,
)


class VideoTransitionStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoTransitionStage",
            display_name="Video Transition",
            category="ComfyTV/Compose",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("transition", XFADE_TRANSITIONS, 'fade'),
                _hidden_float("duration", 1.0, 0.1, 5.0, step=0.05),
                _hidden_float("offset", 0.0, 0.0, 3600.0,
                              tooltip="seconds into clip A where the transition starts; 0 = auto (end of A)"),
                _hidden_float("luma_softness", 0.1, 0.0, 1.0),
                io.Boolean.Input("luma_invert", default=False,
                                 socketless=True, extra_dict={"hidden": True}),
                _hidden_combo("luma_map", ['none'] + LUMA_MAP_KINDS, 'none'),
                COMFYTV_VIDEO.Input("video_a", optional=True),
                COMFYTV_VIDEO.Input("video_b", optional=True),
                COMFYTV_IMAGE.Input("luma_image", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                transition='fade', duration=1.0, offset=0.0,
                luma_softness=0.1, luma_invert=False, luma_map='none',
                video_a="", video_b="", luma_image=""):
        if not (video_a or '').strip() or not (video_b or '').strip():
            raise RuntimeError(
                "Video Transition needs two upstream videos — wire video_a and video_b."
            )
        if not (luma_image or '').strip() and luma_map in LUMA_MAP_KINDS:
            from ...runners.luma_maps import luma_map_image_url
            from ...runners.media import get_video_info
            info = get_video_info(video_a)
            luma_image = luma_map_image_url(
                luma_map, int(info.get('width') or 1280),
                int(info.get('height') or 720))
        if (luma_image or '').strip():
            from ...runners.video_timeline_ops import luma_wipe_videos
            payload = luma_wipe_videos(
                video_a, video_b, luma_image,
                duration=_f(duration, 0.1, 5.0, 1.0),
                softness=_f(luma_softness, 0, 1, 0.1),
                invert=bool(luma_invert), progress=_progress_cb(cls))
        else:
            payload = xfade_videos(video_a, video_b, transition=transition,
                                   duration=_f(duration, 0.1, 5.0, 1.0),
                                   offset=(_f(offset, 0.0, 3600.0) or None),
                                   progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


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
