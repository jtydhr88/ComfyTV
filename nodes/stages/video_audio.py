from ._common import *  # noqa: F401, F403
from ...runners.media import (
    extract_frame, trim_video, crop_video, resize_video,
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
                io.Float.Input("start_s", default=0.0, min=0.0, max=3600.0, step=0.1,
                               ),
                io.Float.Input("end_s", default=5.0, min=0.0, max=3600.0, step=0.1,
                               ),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                start_s=0.0, end_s=5.0, video=""):
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
                io.Int.Input("x", default=0, min=0, max=8192, step=2,
                             tooltip="Crop top-left X in pixels."),
                io.Int.Input("y", default=0, min=0, max=8192, step=2,
                             tooltip="Crop top-left Y in pixels."),
                io.Int.Input("w", default=512, min=2, max=8192, step=2,
                             tooltip="Crop width in pixels."),
                io.Int.Input("h", default=512, min=2, max=8192, step=2,
                             tooltip="Crop height in pixels."),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                x=0, y=0, w=512, h=512, video=""):
        if not (video or '').strip():
            raise RuntimeError(
                "Video Crop needs an upstream video — wire one into the video input."
            )
        payload = crop_video(video, int(x), int(y), int(w), int(h))
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
                io.Int.Input("width", default=1280, min=-1, max=8192, step=2,
                             tooltip="Output width in pixels. Use -1 to derive from height + source aspect ratio."),
                io.Int.Input("height", default=720, min=-1, max=8192, step=2,
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
                               default=AUDIO_VOCAL_WORKFLOWS[0] if AUDIO_VOCAL_WORKFLOWS else "",
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
                               default=AUDIO_BG_WORKFLOWS[0] if AUDIO_BG_WORKFLOWS else "",
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


