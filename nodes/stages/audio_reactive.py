from ._common import *  # noqa: F401, F403
from ...runners.audio_react import (
    audio_reactive_keyframes, meter_overlay_video, BANDS,
)

from .common.fx_helpers import (  # noqa: F401
    _need_video, _progress_cb, _f,
    _hidden_float, _hidden_int, _hidden_combo,
)


class AudioReactiveStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AudioReactiveStage",
            display_name="Audio Reactive",
            category="ComfyTV/AudioFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("band", list(BANDS) + ['custom'], 'bass'),
                _hidden_float("freq_lo", 40.0, 10.0, 16000.0, step=10.0),
                _hidden_float("freq_hi", 200.0, 20.0, 16000.0, step=10.0),
                _hidden_float("attack", 0.02, 0.001, 1.0, step=0.001),
                _hidden_float("release", 0.25, 0.01, 2.0, step=0.01),
                _hidden_float("rate", 10.0, 1.0, 60.0, step=1.0),
                _hidden_float("min_value", 0.0, -1000.0, 1000.0),
                _hidden_float("max_value", 1.0, -1000.0, 1000.0),
                _hidden_float("gain", 1.0, 0.1, 8.0),
                _hidden_combo("field", ['v', 'scale', 'opacity', 'x', 'y',
                                        'rotation'], 'v'),
                COMFYTV_AUDIO.Input("audio", optional=True),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_TEXT.Output("keyframes")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                band='bass', freq_lo=40.0, freq_hi=200.0, attack=0.02,
                release=0.25, rate=10.0, min_value=0.0, max_value=1.0,
                gain=1.0, field='v', audio="", video=""):
        src = (audio or '').strip() or (video or '').strip()
        if not src:
            raise RuntimeError(
                "Audio Reactive needs an audio (or video with audio) input.")
        payload = audio_reactive_keyframes(
            src, band=band, freq_lo=_f(freq_lo, 10, 16000, 40.0),
            freq_hi=_f(freq_hi, 20, 16000, 200.0),
            attack=_f(attack, 0.001, 1, 0.02),
            release=_f(release, 0.01, 2, 0.25),
            rate=_f(rate, 1, 60, 10.0),
            min_value=_f(min_value, -1000, 1000, 0.0),
            max_value=_f(max_value, -1000, 1000, 1.0),
            gain=_f(gain, 0.1, 8, 1.0), field=field,
            progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class AudioMeterStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AudioMeterStage",
            display_name="Audio Meter Overlay",
            category="ComfyTV/AudioFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_int("meter_w", 400, 80, 1920),
                _hidden_int("meter_h", 20, 8, 120),
                _hidden_combo("corner", ['bottom-left', 'bottom-right',
                                         'top-left', 'top-right'],
                              'bottom-left'),
                _hidden_int("margin", 16, 0, 200),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                meter_w=400, meter_h=20, corner='bottom-left', margin=16,
                video=""):
        _need_video(video, "Audio Meter Overlay")
        payload = meter_overlay_video(
            video, meter_w=min(1920, max(80, int(meter_w))),
            meter_h=min(120, max(8, int(meter_h))), corner=corner,
            margin=min(200, max(0, int(margin))),
            progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)
