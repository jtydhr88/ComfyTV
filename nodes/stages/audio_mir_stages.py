from ._common import *  # noqa: F401, F403
from ...runners.audio_mir import MIR_MODES

from .common.fx_helpers import (  # noqa: F401
    _need_video, _progress_cb, _f,
    _hidden_float, _hidden_int, _hidden_combo, _hidden_str,
)


class AudioStemSplitStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AudioStemSplitStage",
            display_name="Audio Stem Split",
            category="ComfyTV/AudioFX",
            inputs=[
                *_standard_stage_inputs(),
                COMFYTV_AUDIO.Input("audio", optional=True),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[
                COMFYTV_AUDIO.Output("vocals"),
                COMFYTV_AUDIO.Output("accompaniment"),
                COMFYTV_AUDIO.Output("drums"),
                COMFYTV_AUDIO.Output("bass"),
                COMFYTV_AUDIO.Output("other"),
            ],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                audio="", video=""):
        from ...runners.stem_split import separate_stems

        src = (audio or '').strip() or (video or '').strip()
        if not src:
            raise RuntimeError(
                "Audio Stem Split needs an audio (or video with audio) "
                "input.")
        stems = separate_stems(src, progress=_progress_cb(cls))
        return _stage_emit_auto(
            cls, project_id=project_id, payload_str=stems['vocals'],
            parent_output_id=parent_output_id,
            extra_outputs=(stems['accompaniment'], stems['drums'],
                           stems['bass'], stems['other']))


class AudioNoiseReductionStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AudioNoiseReductionStage",
            display_name="Noise Reduction (Spectral)",
            category="ComfyTV/AudioFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_float("reduction_db", 12.0, 1.0, 48.0, step=0.5),
                _hidden_float("sensitivity", 6.0, 0.5, 24.0, step=0.25),
                _hidden_int("freq_smooth_bands", 6, 0, 12),
                COMFYTV_AUDIO.Input("audio", optional=True),
                COMFYTV_VIDEO.Input("video", optional=True),
                COMFYTV_AUDIO.Input("noise_sample", optional=True),
            ],
            outputs=[COMFYTV_AUDIO.Output("audio")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                reduction_db=12.0, sensitivity=6.0, freq_smooth_bands=6,
                audio="", video="", noise_sample=""):
        from ...runners.noise_reduction import noise_reduce_audio

        src = (audio or '').strip() or (video or '').strip()
        if not src:
            raise RuntimeError(
                "Noise Reduction needs an audio (or video with audio) "
                "input.")
        payload = noise_reduce_audio(
            src, reduction_db=_f(reduction_db, 1, 48, 12.0),
            sensitivity=_f(sensitivity, 0.5, 24, 6.0),
            freq_smooth_bands=min(12, max(0, int(freq_smooth_bands or 0))),
            noise_url=(noise_sample or '').strip(),
            progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id,
                                payload_str=payload,
                                parent_output_id=parent_output_id)


class AudioMIRStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AudioMIRStage",
            display_name="Audio Beats & Notes",
            category="ComfyTV/AudioFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("mode", list(MIR_MODES), 'beats'),
                _hidden_float("threshold", 0.3, 0.05, 1.0, step=0.01),
                _hidden_float("min_gap_s", 0.05, 0.01, 1.0, step=0.01),
                _hidden_combo("field", ['v', 'scale', 'opacity', 'x', 'y',
                                        'rotation'], 'v'),
                COMFYTV_AUDIO.Input("audio", optional=True),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_TEXT.Output("keyframes"),
                     COMFYTV_TEXT.Output("labels")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                mode='beats', threshold=0.3, min_gap_s=0.05, field='v',
                audio="", video=""):
        from ...runners.audio_mir import mir_analyze

        src = (audio or '').strip() or (video or '').strip()
        if not src:
            raise RuntimeError(
                "Audio Beats & Notes needs an audio (or video with audio) "
                "input.")
        result = mir_analyze(
            src, mode=mode if mode in MIR_MODES else 'beats',
            threshold=_f(threshold, 0.05, 1, 0.3),
            min_gap_s=_f(min_gap_s, 0.01, 1, 0.05),
            field=field or 'v', progress=_progress_cb(cls))
        return _stage_emit_auto(
            cls, project_id=project_id, payload_str=result['keyframes'],
            parent_output_id=parent_output_id,
            extra_outputs=(result['labels'],))
