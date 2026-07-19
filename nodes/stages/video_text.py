from ._common import *  # noqa: F401, F403
from ...runners.text_overlay import title_video, burn_subtitles, list_fonts

from .common.fx_helpers import (  # noqa: F401
    _need_video, _progress_cb, _f,
    _hidden_float, _hidden_int, _hidden_str, _hidden_combo,
)


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


class SubtitleGenStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.SubtitleGenStage",
            display_name="Subtitles · Speech-to-Text",
            category="ComfyTV/Video",
            inputs=[
                *_standard_stage_inputs(),
                io.Combo.Input("workflow", options=labels_for('speech-to-text'),
                               default=default_for('speech-to-text'),
                               tooltip="Which speech-to-text workflow to run."),
                COMFYTV_VIDEO.Input("video", optional=True),
                COMFYTV_AUDIO.Input("audio", optional=True),
            ],
            outputs=[COMFYTV_TEXT.Output("subtitles")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    async def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                      workflow="", video="", audio=""):
        upstream = {}
        if (audio or '').strip():
            upstream['audio'] = [audio]
        elif (video or '').strip():
            upstream['videos'] = [video]
        else:
            raise RuntimeError(
                "Speech-to-Text needs an upstream audio or video."
            )
        return await run_stage_workflow(
            cls,
            kind='speech-to-text',
            label=workflow,
            project_id=project_id,
            parent_output_id=parent_output_id,
            main_prompt=None,
            upstream=upstream,
            options={},
        )
