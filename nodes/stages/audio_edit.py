from ._common import *  # noqa: F401, F403
from ...runners.media_filter import crossfade_audios, AFADE_CURVES
from ...runners.audio_dsp import mix_audios, segment_export

from .common.fx_helpers import (  # noqa: F401
    _pick_source, _progress_cb, _f,
    _hidden_float, _hidden_combo,
)


class AudioCrossfadeStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AudioCrossfadeStage",
            display_name="Audio Crossfade",
            category="ComfyTV/AudioFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_float("duration", 1.0, 0.01, 60.0),
                _hidden_combo("curve1", AFADE_CURVES, 'tri'),
                _hidden_combo("curve2", AFADE_CURVES, 'tri'),
                io.Boolean.Input("overlap", default=True, socketless=True,
                                 extra_dict={"hidden": True}),
                COMFYTV_AUDIO.Input("audio_a", optional=True),
                COMFYTV_AUDIO.Input("audio_b", optional=True),
                COMFYTV_VIDEO.Input("video_a", optional=True),
                COMFYTV_VIDEO.Input("video_b", optional=True),
            ],
            outputs=[COMFYTV_AUDIO.Output("audio")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                duration=1.0, curve1='tri', curve2='tri', overlap=True,
                audio_a="", audio_b="", video_a="", video_b=""):
        src_a = _pick_source(audio_a, video_a, "Audio Crossfade (A)")
        src_b = _pick_source(audio_b, video_b, "Audio Crossfade (B)")
        payload = crossfade_audios(
            src_a, src_b, duration=_f(duration, 0.01, 60.0, 1.0),
            curve1=curve1, curve2=curve2, overlap=bool(overlap))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class AudioMixStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        per_input = []
        for ch in ('a', 'b', 'c', 'd'):
            per_input.append(_hidden_float(f"gain_{ch}", 0.0, -60.0, 12.0,
                                           step=0.5))
            per_input.append(_hidden_float(f"pan_{ch}", 0.0, -1.0, 1.0))
        return io.Schema(
            node_id="ComfyTV.AudioMixStage",
            display_name="Audio Mix",
            category="ComfyTV/AudioFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("pan_law", ['audacity', 'constant_power'],
                              'audacity'),
                _hidden_combo("dither", ['none', 'tpdf', 'shaped'], 'none'),
                *per_input,
                COMFYTV_AUDIO.Input("audio_a", optional=True),
                COMFYTV_AUDIO.Input("audio_b", optional=True),
                COMFYTV_AUDIO.Input("audio_c", optional=True),
                COMFYTV_AUDIO.Input("audio_d", optional=True),
            ],
            outputs=[COMFYTV_AUDIO.Output("audio")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                pan_law='audacity', dither='none',
                gain_a=0.0, pan_a=0.0, gain_b=0.0, pan_b=0.0,
                gain_c=0.0, pan_c=0.0, gain_d=0.0, pan_d=0.0,
                audio_a="", audio_b="", audio_c="", audio_d=""):
        sources = []
        params = {
            'a': (audio_a, gain_a, pan_a), 'b': (audio_b, gain_b, pan_b),
            'c': (audio_c, gain_c, pan_c), 'd': (audio_d, gain_d, pan_d),
        }
        for ch in ('a', 'b', 'c', 'd'):
            url, gain, pan = params[ch]
            if (url or '').strip():
                sources.append({'url': url,
                                'gain_db': _f(gain, -60.0, 12.0, 0.0),
                                'pan': _f(pan, -1.0, 1.0, 0.0)})
        if not sources:
            raise RuntimeError(
                "Audio Mix needs at least one upstream audio — wire one in.")
        law = pan_law if pan_law in ('audacity', 'constant_power') \
            else 'audacity'
        dth = dither if dither in ('none', 'tpdf', 'shaped') else 'none'
        payload = mix_audios(sources, pan_law=law, dither=dth)
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class AudioSegmentExportStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AudioSegmentExportStage",
            display_name="Audio Split Export",
            category="ComfyTV/AudioFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("detect", ['silence', 'json'], 'silence'),
                _hidden_float("threshold_db", -60.0, -90.0, -20.0, step=1.0),
                _hidden_float("min_silence_s", 0.5, 0.01, 5.0),
                _hidden_float("min_segment_s", 0.1, 0.01, 10.0),
                _hidden_float("fade_ms", 1.45, 0.0, 500.0),
                _hidden_combo("naming",
                              ['num_and_prefix', 'num_and_name', 'name'],
                              'num_and_prefix'),
                io.String.Input("prefix", default="segment", multiline=False,
                                socketless=True, extra_dict={"hidden": True}),
                io.String.Input("segments", default="", multiline=False,
                                socketless=True, extra_dict={"hidden": True},
                                tooltip='JSON [{"start":s,"end":s}] for '
                                        'detect=json'),
                COMFYTV_AUDIO.Input("audio", optional=True),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_TEXT.Output("files")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                detect='silence', threshold_db=-60.0, min_silence_s=0.5,
                min_segment_s=0.1, fade_ms=1.45, naming='num_and_prefix',
                prefix='segment', segments="", audio="", video=""):
        src = _pick_source(audio, video, "Audio Split Export")
        seg_list = None
        if detect == 'json':
            try:
                parsed = json.loads(segments or "[]")
            except (ValueError, TypeError):
                parsed = []
            seg_list = [
                {'start': float(s['start']), 'end': float(s['end'])}
                for s in parsed
                if isinstance(s, dict) and 'start' in s and 'end' in s
            ]
            if not seg_list:
                raise RuntimeError(
                    "Audio Split Export: detect=json needs a segments list.")
        nm = naming if naming in ('num_and_prefix', 'num_and_name', 'name') \
            else 'num_and_prefix'
        result = segment_export(
            src, segments=seg_list,
            threshold_db=_f(threshold_db, -90.0, -20.0, -60.0),
            min_silence_s=_f(min_silence_s, 0.01, 5.0, 0.5),
            min_segment_s=_f(min_segment_s, 0.01, 10.0, 0.1),
            fade_ms=_f(fade_ms, 0.0, 500.0, 1.45),
            naming=nm, prefix=prefix or 'segment',
            progress=_progress_cb(cls))
        payload = json.dumps(result)
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)
