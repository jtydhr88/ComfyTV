from ._common import *  # noqa: F401, F403
from ...runners.media_filter import analyze_audio, audio_image
from ...runners.audio_dsp import (
    evaluate_loudness_compliance, render_waveform_image,
    render_spectrogram_image, ess_sweep, deconvolve_ir,
)

import re

from .common.fx_helpers import (  # noqa: F401
    _pick_source, _f,
    _hidden_float, _hidden_int, _hidden_combo,
)


def _parse_kv_lines(lines, keys):
    out = {}
    for line in lines:
        for key, (label, cast) in keys.items():
            if key in out:
                continue
            m = re.search(label, line)
            if m:
                try:
                    out[key] = cast(m.group(1))
                except (TypeError, ValueError):
                    pass
    return out


class AudioAnalyzeStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AudioAnalyzeStage",
            display_name="Audio Analyze",
            category="ComfyTV/AudioFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("mode",
                              ['loudness', 'volume', 'stats', 'silence'],
                              'loudness'),
                _hidden_float("silence_noise_db", -60.0, -100.0, 0.0, step=1.0),
                _hidden_float("silence_duration", 2.0, 0.01, 60.0),
                COMFYTV_AUDIO.Input("audio", optional=True),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_TEXT.Output("report")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                mode='loudness', silence_noise_db=-60.0, silence_duration=2.0,
                audio="", video=""):
        src = _pick_source(audio, video, "Audio Analyze")
        if mode == 'loudness':
            specs = [('ebur128', 'peak=true')]
        elif mode == 'volume':
            specs = [('volumedetect', None)]
        elif mode == 'stats':
            specs = [('astats', None)]
        elif mode == 'silence':
            db = _f(silence_noise_db, -100.0, 0.0, -60.0)
            dur = _f(silence_duration, 0.01, 60.0, 2.0)
            specs = [('silencedetect', f'n={db}dB:d={dur}')]
        else:
            raise RuntimeError(f"Audio Analyze: unknown mode {mode!r}")

        messages = analyze_audio(src, specs)
        lines = []
        for msg in messages:
            lines.extend(str(msg).splitlines())

        result = {'mode': mode}
        num = r'([-+]?[0-9]*\.?[0-9]+)'
        if mode == 'loudness':
            m_max = s_max = None
            for line in lines:
                m = re.search(rf'M:\s*{num}\s+S:\s*{num}', line)
                if m:
                    mv, sv = float(m.group(1)), float(m.group(2))
                    if m_max is None or mv > m_max:
                        m_max = mv
                    if s_max is None or sv > s_max:
                        s_max = sv
            for i, line in enumerate(lines):
                if 'Summary:' in line:
                    lines = lines[i + 1:]
                    break
            if m_max is not None and m_max > -120.0:
                result['momentary_max_lufs'] = m_max
            if s_max is not None and s_max > -120.0:
                result['short_max_lufs'] = s_max
            result.update(_parse_kv_lines(lines, {
                'integrated_lufs': (rf'I:\s+{num}\s+LUFS', float),
                'threshold_lufs': (rf'Threshold:\s+{num}\s+LUFS', float),
                'lra_lu': (rf'LRA:\s+{num}\s+LU', float),
                'lra_low_lufs': (rf'LRA low:\s+{num}\s+LUFS', float),
                'lra_high_lufs': (rf'LRA high:\s+{num}\s+LUFS', float),
                'peak_dbfs': (rf'Peak:\s+{num}\s+dBFS', float),
            }))
            if 'integrated_lufs' not in result:
                raise RuntimeError(
                    "Audio Analyze: ebur128 produced no summary — "
                    "is the clip long enough (≥ 400 ms)?")
            if 'peak_dbfs' in result:
                result['platforms'] = evaluate_loudness_compliance(
                    result['integrated_lufs'], result['peak_dbfs'])
        elif mode == 'volume':
            result.update(_parse_kv_lines(lines, {
                'mean_volume_db': (rf'mean_volume:\s+{num}\s+dB', float),
                'max_volume_db': (rf'max_volume:\s+{num}\s+dB', float),
                'n_samples': (r'n_samples:\s+(\d+)', int),
            }))
        elif mode == 'stats':
            overall = []
            seen_overall = False
            for line in lines:
                if 'Overall' in line:
                    seen_overall = True
                elif seen_overall:
                    overall.append(line)
            result.update(_parse_kv_lines(overall or lines, {
                'dc_offset': (rf'DC offset:\s+{num}', float),
                'peak_level_db': (rf'Peak level dB:\s+{num}', float),
                'rms_level_db': (rf'RMS level dB:\s+{num}', float),
                'rms_peak_db': (rf'RMS peak dB:\s+{num}', float),
                'flat_factor': (rf'Flat factor:\s+{num}', float),
                'peak_count': (r'Peak count:\s+(\d+)', int),
            }))
        elif mode == 'silence':
            segments = []
            start = None
            for line in lines:
                m = re.search(rf'silence_start:\s+{num}', line)
                if m:
                    start = float(m.group(1))
                    continue
                m = re.search(
                    rf'silence_end:\s+{num}\s+\|\s+silence_duration:\s+{num}',
                    line)
                if m:
                    segments.append({
                        'start': start if start is not None
                        else round(float(m.group(1)) - float(m.group(2)), 4),
                        'end': float(m.group(1)),
                        'duration': float(m.group(2)),
                    })
                    start = None
            if start is not None:
                segments.append({'start': start, 'end': None, 'duration': None})
            result['segments'] = segments
            result['count'] = len(segments)

        payload = json.dumps(result)
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class AudioVisualizeStage(io.ComfyNode):

    SPECTRUM_COLORS = ['intensity', 'channel', 'rainbow', 'moreland',
                       'nebulae', 'fire', 'fiery', 'fruit', 'cool', 'magma',
                       'green', 'viridis', 'plasma', 'cividis', 'terrain']

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AudioVisualizeStage",
            display_name="Audio Visualize",
            category="ComfyTV/AudioFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("mode",
                              ['waveform', 'spectrum', 'waveform_pro',
                               'spectrum_pro'], 'waveform'),
                _hidden_int("width", 1200, 240, 4096),
                _hidden_int("height", 480, 120, 2048),
                io.Boolean.Input("split_channels", default=False,
                                 socketless=True, extra_dict={"hidden": True}),
                _hidden_combo("color", cls.SPECTRUM_COLORS, 'intensity'),
                io.Boolean.Input("legend", default=True, socketless=True,
                                 extra_dict={"hidden": True}),
                _hidden_combo("pro_scale", ['log', 'linear', 'mel'], 'log'),
                _hidden_combo("pro_colormap", ['roseus', 'gray'], 'roseus'),
                _hidden_float("range_db", 80.0, 20.0, 120.0, step=1.0),
                _hidden_float("gain_db", 20.0, 0.0, 60.0, step=1.0),
                _hidden_float("freq_gain", 0.0, -10.0, 10.0, step=0.5),
                io.Boolean.Input("show_rms", default=True, socketless=True,
                                 extra_dict={"hidden": True}),
                io.Boolean.Input("show_clipping", default=True,
                                 socketless=True, extra_dict={"hidden": True}),
                io.Boolean.Input("db_axis", default=False, socketless=True,
                                 extra_dict={"hidden": True}),
                COMFYTV_AUDIO.Input("audio", optional=True),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                mode='waveform', width=1200, height=480, split_channels=False,
                color='intensity', legend=True, pro_scale='log',
                pro_colormap='roseus', range_db=80.0, gain_db=20.0,
                freq_gain=0.0, show_rms=True, show_clipping=True,
                db_axis=False, audio="", video=""):
        src = _pick_source(audio, video, "Audio Visualize")
        w = min(4096, max(240, int(width or 1200)))
        h = min(2048, max(120, int(height or 480)))
        if mode == 'waveform_pro':
            payload = render_waveform_image(
                src, width=w, height=h, show_rms=bool(show_rms),
                show_clipping=bool(show_clipping), db_axis=bool(db_axis))
        elif mode == 'spectrum_pro':
            payload = render_spectrogram_image(
                src, width=w, height=h,
                scale=pro_scale if pro_scale in ('log', 'linear', 'mel')
                else 'log',
                colormap=pro_colormap if pro_colormap in ('roseus', 'gray')
                else 'roseus',
                range_db=_f(range_db, 20.0, 120.0, 80.0),
                gain_db=_f(gain_db, 0.0, 60.0, 20.0),
                freq_gain_dbpoct=_f(freq_gain, -10.0, 10.0, 0.0))
        elif mode == 'waveform':
            payload = audio_image(
                src, 'showwavespic',
                f's={w}x{h}:split_channels={1 if split_channels else 0}')
        elif mode == 'spectrum':
            c = color if color in cls.SPECTRUM_COLORS else 'intensity'
            payload = audio_image(
                src, 'showspectrumpic',
                f's={w}x{h}:color={c}:legend={1 if legend else 0}')
        else:
            raise RuntimeError(f"Audio Visualize: unknown mode {mode!r}")
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class AudioSweepStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AudioSweepStage",
            display_name="Audio Sweep (ESS)",
            category="ComfyTV/AudioFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_float("duration_s", 5.0, 1.0, 30.0),
                _hidden_float("fmin", 20.0, 10.0, 1000.0, step=1.0),
                _hidden_float("fmax", 20000.0, 1000.0, 20000.0, step=10.0),
                _hidden_float("amp", 0.5, 0.01, 1.0),
                _hidden_float("tail_s", 5.0, 0.0, 10.0),
            ],
            outputs=[COMFYTV_AUDIO.Output("audio")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                duration_s=5.0, fmin=20.0, fmax=20000.0, amp=0.5, tail_s=5.0):
        payload = ess_sweep(
            duration_s=_f(duration_s, 1.0, 30.0, 5.0),
            fmin=_f(fmin, 10.0, 1000.0, 20.0),
            fmax=_f(fmax, 1000.0, 20000.0, 20000.0),
            amp=_f(amp, 0.01, 1.0, 0.5),
            tail_s=_f(tail_s, 0.0, 10.0, 5.0))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class AudioDeconvolveStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AudioDeconvolveStage",
            display_name="Audio Deconvolve (IR)",
            category="ComfyTV/AudioFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_float("duration_s", 5.0, 1.0, 30.0),
                _hidden_float("fmin", 20.0, 10.0, 1000.0, step=1.0),
                _hidden_float("fmax", 20000.0, 1000.0, 20000.0, step=10.0),
                _hidden_float("amp", 0.5, 0.01, 1.0),
                _hidden_float("ir_len_s", 2.0, 0.1, 10.0),
                COMFYTV_AUDIO.Input("audio", optional=True),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_AUDIO.Output("audio")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                duration_s=5.0, fmin=20.0, fmax=20000.0, amp=0.5,
                ir_len_s=2.0, audio="", video=""):
        src = _pick_source(audio, video, "Audio Deconvolve")
        payload = deconvolve_ir(
            src,
            duration_s=_f(duration_s, 1.0, 30.0, 5.0),
            fmin=_f(fmin, 10.0, 1000.0, 20.0),
            fmax=_f(fmax, 1000.0, 20000.0, 20000.0),
            amp=_f(amp, 0.01, 1.0, 0.5),
            ir_len_s=_f(ir_len_s, 0.1, 10.0, 2.0))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)
