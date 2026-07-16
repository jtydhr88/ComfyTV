from ._common import *  # noqa: F401, F403
from ...runners.media import (
    extract_frame, trim_video, crop_video, resize_video, concat_videos,
    speed_video, transpose_video, adjust_volume, mux_audio, extract_frames_multi,
    demux_audio, silence_video, get_video_info,
)


class VideoExtractFrameStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoExtractFrameStage",
            display_name="Extract Frame",
            category="ComfyTV/Video",
            inputs=[
                *_standard_stage_inputs(),
                io.Combo.Input("position", options=['last', 'first', 'middle', 'custom'],
                               default='last',
                               tooltip="Which frame to grab. 'custom' uses at_seconds."),
                io.Float.Input("at_seconds", default=0.0, min=0.0, max=3600.0, step=0.05,
                               tooltip="Custom timestamp in seconds. Ignored unless position=custom."),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                position='last', at_seconds=0.0, video=""):
        if not (video or '').strip():
            raise RuntimeError(
                "Extract Frame needs an upstream video — wire one into the video input."
            )
        pos = position if position != 'custom' else float(at_seconds or 0.0)
        payload = extract_frame(video, pos)
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class VideoClipStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoClipStage",
            display_name="Video Clip",
            category="ComfyTV/Video",
            inputs=[
                *_standard_stage_inputs(),
                io.Float.Input("start_s", default=0.0, min=0.0, max=3600.0, step=0.01,
                               socketless=True, extra_dict={"hidden": True}),
                io.Float.Input("end_s", default=0.0, min=0.0, max=3600.0, step=0.01,
                               socketless=True, extra_dict={"hidden": True}),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                start_s=0.0, end_s=0.0, video=""):
        if not (video or '').strip():
            raise RuntimeError(
                "Video Clip needs an upstream video — wire one into the video input."
            )
        s = float(start_s or 0.0)

        if not end_s or float(end_s) <= 0:
            info = get_video_info(video)
            e = max(s + 0.05, float(info.get('duration') or 0))
        else:
            e = float(end_s)
        if e <= s:
            raise RuntimeError(f"Video Clip: end_s ({e}) must be > start_s ({s})")
        payload = trim_video(video, s, e)
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class VideoCropStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoCropStage",
            display_name="Video Crop",
            category="ComfyTV/Video",
            inputs=[
                *_standard_stage_inputs(),
                io.Int.Input("x", default=0, min=0, max=8192,
                             socketless=True, extra_dict={"hidden": True}),
                io.Int.Input("y", default=0, min=0, max=8192,
                             socketless=True, extra_dict={"hidden": True}),
                io.Int.Input("w", default=0, min=0, max=8192,
                             socketless=True, extra_dict={"hidden": True}),
                io.Int.Input("h", default=0, min=0, max=8192,
                             socketless=True, extra_dict={"hidden": True}),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                x=0, y=0, w=0, h=0, video=""):
        if not (video or '').strip():
            raise RuntimeError(
                "Video Crop needs an upstream video — wire one into the video input."
            )
        if int(w) <= 0 or int(h) <= 0:
            raise RuntimeError(
                "Video Crop: no crop region set — drag the rectangle on the node first."
            )
        payload = crop_video(video, int(x), int(y), int(w), int(h))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class VideoConcatStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoConcatStage",
            display_name="Video Concat",
            category="ComfyTV/Compose",
            inputs=[
                *_standard_stage_inputs(),
                io.String.Input("clip_order", default="", multiline=False,
                                socketless=True, extra_dict={"hidden": True},
                                tooltip="JSON list of video slot keys in concat order — "
                                        "driven by the reorder strip in the node body."),
                io.Autogrow.Input("videos", template=_video_template(12)),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                clip_order="", videos=None):
        def _norm(k):
            return str(k).split('.')[-1]

        if hasattr(videos, 'items'):
            slots = {_norm(k): v for k, v in videos.items()}
        else:
            slots = {f"video{i}": v for i, v in enumerate(_autogrow_values(videos))}

        try:
            order = [_norm(k) for k in json.loads(clip_order or "[]")]
        except (ValueError, TypeError):
            order = []
        ordered = [k for k in order if k in slots]
        ordered += [k for k in slots if k not in ordered]

        urls = [slots[k] for k in ordered if (slots[k] or '').strip()]
        if len(urls) < 2:
            raise RuntimeError(
                "Video Concat needs at least two upstream videos — wire them into the videos inputs."
            )

        def _progress(value, total, text=""):
            import comfy.model_management
            comfy.model_management.throw_exception_if_processing_interrupted()
            _emit_progress(cls, value, total, text)

        payload = concat_videos(urls, progress=_progress)
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class VideoSpeedStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoSpeedStage",
            display_name="Video Speed",
            category="ComfyTV/Video",
            inputs=[
                *_standard_stage_inputs(),
                io.Float.Input("speed", default=1.0, min=0.1, max=10.0, step=0.05,
                               socketless=True, extra_dict={"hidden": True}),
                io.Boolean.Input("reverse", default=False,
                                 socketless=True, extra_dict={"hidden": True}),
                io.Boolean.Input("pitch_compensate", default=True,
                                 socketless=True, extra_dict={"hidden": True}),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                speed=1.0, reverse=False, pitch_compensate=True, video=""):
        if not (video or '').strip():
            raise RuntimeError(
                "Video Speed needs an upstream video — wire one into the video input."
            )
        if float(speed or 1.0) == 1.0 and not reverse:
            raise RuntimeError(
                "Video Speed: nothing to do — set a speed other than 1x or enable reverse."
            )
        payload = speed_video(video, float(speed or 1.0), bool(reverse),
                              pitch_compensate=bool(pitch_compensate))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class VideoRotateStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoRotateStage",
            display_name="Video Rotate",
            category="ComfyTV/Video",
            inputs=[
                *_standard_stage_inputs(),
                io.Int.Input("rotate_deg", default=0, min=0, max=270, step=90,
                             socketless=True, extra_dict={"hidden": True}),
                io.Boolean.Input("flip_h", default=False,
                                 socketless=True, extra_dict={"hidden": True}),
                io.Boolean.Input("flip_v", default=False,
                                 socketless=True, extra_dict={"hidden": True}),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                rotate_deg=0, flip_h=False, flip_v=False, video=""):
        if not (video or '').strip():
            raise RuntimeError(
                "Video Rotate needs an upstream video — wire one into the video input."
            )
        payload = transpose_video(video, int(rotate_deg or 0), bool(flip_h), bool(flip_v))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class VideoSplitStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoSplitStage",
            display_name="Video Split",
            category="ComfyTV/Video",
            inputs=[
                *_standard_stage_inputs(),
                io.Float.Input("split_s", default=0.0, min=0.0, max=3600.0, step=0.01,
                               socketless=True, extra_dict={"hidden": True}),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video_a"), COMFYTV_VIDEO.Output("video_b")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                split_s=0.0, video=""):
        if not (video or '').strip():
            raise RuntimeError(
                "Video Split needs an upstream video — wire one into the video input."
            )
        s = float(split_s or 0.0)
        dur = float(get_video_info(video).get('duration') or 0.0)
        if not (0.05 <= s <= max(0.05, dur - 0.05)):
            raise RuntimeError(
                f"Video Split: split point ({s}s) must fall inside the clip (0–{dur:.2f}s)."
            )
        part_a = trim_video(video, 0.0, s)
        part_b = trim_video(video, s, dur)
        _persist(cls=cls, project_id=project_id, output_type='video',
                 payload_url=part_b, parent_output_id=parent_output_id)
        _emit_progress(cls, 1, 1, text="done")
        return _stage_emit(cls, project_id=project_id, output_type='video',
                           payload_str=part_a, parent_output_id=parent_output_id,
                           picked_payload=part_b)


class VideoVolumeStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoVolumeStage",
            display_name="Video Volume",
            category="ComfyTV/Video",
            inputs=[
                *_standard_stage_inputs(),
                io.Float.Input("volume", default=1.0, min=0.0, max=8.0, step=0.05,
                               socketless=True, extra_dict={"hidden": True}),
                io.Float.Input("fade_in_s", default=0.0, min=0.0, max=60.0, step=0.1,
                               socketless=True, extra_dict={"hidden": True}),
                io.Float.Input("fade_out_s", default=0.0, min=0.0, max=60.0, step=0.1,
                               socketless=True, extra_dict={"hidden": True}),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                volume=1.0, fade_in_s=0.0, fade_out_s=0.0, video=""):
        if not (video or '').strip():
            raise RuntimeError(
                "Video Volume needs an upstream video — wire one into the video input."
            )
        payload = adjust_volume(video, float(volume or 0.0),
                                float(fade_in_s or 0.0), float(fade_out_s or 0.0))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class VideoMuxAudioStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoMuxAudioStage",
            display_name="Mux Audio",
            category="ComfyTV/Video",
            inputs=[
                *_standard_stage_inputs(),
                io.Combo.Input("mode", options=['replace', 'mix'], default='replace',
                               socketless=True, extra_dict={"hidden": True}),
                io.Float.Input("offset_s", default=0.0, min=-600.0, max=600.0, step=0.05,
                               socketless=True, extra_dict={"hidden": True}),
                COMFYTV_VIDEO.Input("video", optional=True),
                COMFYTV_AUDIO.Input("audio", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                mode='replace', offset_s=0.0, video="", audio=""):
        if not (video or '').strip() or not (audio or '').strip():
            raise RuntimeError(
                "Mux Audio needs both an upstream video and an upstream audio."
            )
        payload = mux_audio(video, audio, mode=mode, offset_s=float(offset_s or 0.0))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class VideoFramesStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoFramesStage",
            display_name="Extract Frames",
            category="ComfyTV/Video",
            inputs=[
                *_standard_stage_inputs(),
                io.String.Input("marks", default="", multiline=False,
                                socketless=True, extra_dict={"hidden": True},
                                tooltip="JSON list of timestamps (seconds) — "
                                        "driven by the marker strip in the node body."),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_IMAGES.Output("images")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                marks="", video=""):
        if not (video or '').strip():
            raise RuntimeError(
                "Extract Frames needs an upstream video — wire one into the video input."
            )
        try:
            times = json.loads(marks or "[]")
        except (ValueError, TypeError):
            times = []
        payload = extract_frames_multi(video, times)
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class VideoResizeStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoResizeStage",
            display_name="Video Resize",
            category="ComfyTV/Video",
            inputs=[
                *_standard_stage_inputs(),
                io.Int.Input("width", default=1280, min=-1, max=8192,
                             socketless=True, extra_dict={"hidden": True},
                             tooltip="Output width in pixels. Use -1 to derive from height + source aspect ratio."),
                io.Int.Input("height", default=720, min=-1, max=8192,
                             socketless=True, extra_dict={"hidden": True},
                             tooltip="Output height in pixels. Use -1 to derive from width + source aspect ratio."),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                width=1280, height=720, video=""):
        if not (video or '').strip():
            raise RuntimeError(
                "Video Resize needs an upstream video — wire one into the video input."
            )
        payload = resize_video(video, int(width), int(height))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class VideoUpscaleStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoUpscaleStage",
            display_name="Video Upscale",
            category="ComfyTV/Video",
            inputs=[
                *_standard_stage_inputs(),
                io.Combo.Input("scale", options=["2x", "4x"], default="2x",
                               ),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,scale="2x", video=""):
        raise StageNotImplemented(
            "stage video (Video Upscale) not implemented yet — no real "
            "upscale backend is wired. (Previously this fabricated a sample "
            "clip URL and persisted it as a real output.)"
        )


class VideoSubtitleSmartEraseStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoSubtitleSmartEraseStage",
            display_name="Subtitle Erase (Smart)",
            category="ComfyTV/Video",
            inputs=[
                *_standard_stage_inputs(),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,video=""):
        raise StageNotImplemented(
            "stage video (Subtitle Erase / Smart) not implemented yet — no "
            "real subtitle-erase backend is wired. (Previously this fabricated "
            "a sample clip URL and persisted it as a real output.)"
        )


class VideoSubtitleSelectEraseStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoSubtitleSelectEraseStage",
            display_name="Subtitle Erase (Region)",
            category="ComfyTV/Video",
            inputs=[
                *_standard_stage_inputs(),
                io.Int.Input("region_x", default=0, min=0, max=8192,
                             socketless=True, extra_dict={"hidden": True}),
                io.Int.Input("region_y", default=0, min=0, max=8192,
                             socketless=True, extra_dict={"hidden": True}),
                io.Int.Input("region_w", default=0, min=0, max=8192,
                             socketless=True, extra_dict={"hidden": True}),
                io.Int.Input("region_h", default=0, min=0, max=8192,
                             socketless=True, extra_dict={"hidden": True}),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,region_x=0, region_y=0, region_w=0, region_h=0, video=""):
        raise StageNotImplemented(
            "stage video (Subtitle Erase / Region) not implemented yet — no "
            "real subtitle-erase backend is wired. (Previously this fabricated "
            "a sample clip URL and persisted it as a real output.)"
        )


class AudioExtractVocalStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AudioExtractVocalStage",
            display_name="Audio · Vocals Only",
            category="ComfyTV/Audio",
            inputs=[
                *_standard_stage_inputs(),
                io.Combo.Input("workflow", options=labels_for('audio-vocal'),
                               default=default_for('audio-vocal'),
                               tooltip="Which vocal-extraction workflow to run."),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_AUDIO.Output("audio")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    async def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                      workflow="", video=""):
        return await run_stage_workflow(
            cls,
            kind='audio-vocal',
            label=workflow,
            project_id=project_id,
            parent_output_id=parent_output_id,
            main_prompt=None,  # vocal extraction takes no text prompt
            upstream={'videos': [video] if video else []},
            options={},
        )


class AudioExtractBgStage(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AudioExtractBgStage",
            display_name="Audio · Background Only",
            category="ComfyTV/Audio",
            inputs=[
                *_standard_stage_inputs(),
                io.Combo.Input("workflow", options=labels_for('audio-bg'),
                               default=default_for('audio-bg'),
                               tooltip="Which background-extraction workflow to run."),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_AUDIO.Output("audio")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    async def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                      workflow="", video=""):
        return await run_stage_workflow(
            cls,
            kind='audio-bg',
            label=workflow,
            project_id=project_id,
            parent_output_id=parent_output_id,
            main_prompt=None,  # background extraction takes no text prompt
            upstream={'videos': [video] if video else []},
            options={},
        )


class AudioVideoDemuxAudioStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AudioVideoDemuxAudioStage",
            display_name="Demux · Audio Track",
            category="ComfyTV/Audio",
            inputs=[
                *_standard_stage_inputs(),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_AUDIO.Output("audio")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0, video=""):
        if not (video or '').strip():
            raise RuntimeError(
                "Demux Audio needs an upstream video — wire one into the video input."
            )
        payload = demux_audio(video)
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class AudioVideoDemuxVideoStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AudioVideoDemuxVideoStage",
            display_name="Demux · Silent Video",
            category="ComfyTV/Audio",
            inputs=[
                *_standard_stage_inputs(),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0, video=""):
        if not (video or '').strip():
            raise RuntimeError(
                "Demux Silent Video needs an upstream video — wire one into the video input."
            )
        payload = silence_video(video)
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


