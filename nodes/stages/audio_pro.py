from ._common import *  # noqa: F401, F403
from ...runners.media_filter import (
    filter_audio, crossfade_audios, analyze_audio, audio_image, AFADE_CURVES,
)
from ...runners.audio_dsp import (
    echo_feedback, evaluate_loudness_compliance, mix_audios, segment_export,
    render_waveform_image, render_spectrogram_image,
    convolve_ir, ess_sweep, deconvolve_ir,
)

from .video_fx import _hidden_float, _hidden_int, _hidden_combo, _f  # noqa: F401
from .audio_fx import _pick_source

import re

_AUDIO_SR = 44100


class AudioEchoStage(io.ComfyNode):

    PRESETS = {
        'doubled': '0.8:0.88:60:0.4',
        'robot': '0.8:0.88:6:0.4',
        'mountains': '0.8:0.9:1000:0.3',
        'mountains2': '0.8:0.9:1000|1800:0.3|0.25',
    }

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AudioEchoStage",
            display_name="Audio Echo",
            category="ComfyTV/AudioFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("preset",
                              ['custom', 'feedback'] + list(cls.PRESETS),
                              'mountains'),
                _hidden_float("in_gain", 0.6, 0.0, 1.0),
                _hidden_float("out_gain", 0.3, 0.0, 1.0),
                _hidden_float("delay_ms", 1000.0, 1.0, 90000.0, step=1.0),
                _hidden_float("decay", 0.5, 0.01, 1.0),
                COMFYTV_AUDIO.Input("audio", optional=True),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_AUDIO.Output("audio")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                preset='mountains', in_gain=0.6, out_gain=0.3,
                delay_ms=1000.0, decay=0.5, audio="", video=""):
        src = _pick_source(audio, video, "Audio Echo")
        if preset == 'feedback':
            payload = echo_feedback(
                src, delay_s=_f(delay_ms, 1.0, 90000.0, 1000.0) / 1000.0,
                decay=_f(decay, 0.01, 1.0, 0.5))
            return _stage_emit_auto(cls, project_id=project_id,
                                    payload_str=payload,
                                    parent_output_id=parent_output_id)
        if preset in cls.PRESETS:
            args = cls.PRESETS[preset]
        else:
            args = (f'{_f(in_gain, 0.0, 1.0, 0.6)}:{_f(out_gain, 0.0, 1.0, 0.3)}'
                    f':{_f(delay_ms, 1.0, 90000.0, 1000.0)}'
                    f':{_f(decay, 0.01, 1.0, 0.5)}')
        payload = filter_audio(src, [('aecho', args)])
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class AudioModulationStage(io.ComfyNode):

    CHORUS_PRESETS = {
        'single': '0.7:0.9:55:0.4:0.25:2',
        'double': '0.6:0.9:50|60:0.4|0.32:0.25|0.4:2|1.3',
        'triple': '0.5:0.9:50|60|40:0.4|0.32|0.3:0.25|0.4|0.3:2|2.3|1.3',
    }

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AudioModulationStage",
            display_name="Audio Modulation",
            category="ComfyTV/AudioFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("mode",
                              ['phaser', 'flanger', 'chorus', 'vibrato',
                               'tremolo', 'pulsator'], 'phaser'),
                _hidden_float("ph_delay", 3.0, 0.0, 5.0),
                _hidden_float("ph_decay", 0.4, 0.0, 0.99),
                _hidden_float("ph_speed", 0.5, 0.1, 2.0),
                _hidden_combo("ph_type", ['triangular', 'sinusoidal'],
                              'triangular'),
                _hidden_float("fl_delay", 0.0, 0.0, 30.0),
                _hidden_float("fl_depth", 2.0, 0.0, 10.0),
                _hidden_float("fl_regen", 0.0, -95.0, 95.0, step=1.0),
                _hidden_float("fl_width", 71.0, 0.0, 100.0, step=1.0),
                _hidden_float("fl_speed", 0.5, 0.1, 10.0),
                _hidden_combo("fl_shape", ['sinusoidal', 'triangular'],
                              'sinusoidal'),
                _hidden_float("fl_phase", 25.0, 0.0, 100.0, step=1.0),
                _hidden_combo("chorus_preset", list(cls.CHORUS_PRESETS),
                              'single'),
                _hidden_float("lfo_f", 5.0, 0.1, 20000.0),
                _hidden_float("lfo_d", 0.5, 0.0, 1.0),
                _hidden_float("pu_hz", 2.0, 0.01, 100.0),
                _hidden_float("pu_amount", 1.0, 0.0, 1.0),
                _hidden_float("pu_width", 1.0, 0.0, 2.0),
                _hidden_combo("pu_mode",
                              ['sine', 'triangle', 'square', 'sawup',
                               'sawdown'], 'sine'),
                COMFYTV_AUDIO.Input("audio", optional=True),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_AUDIO.Output("audio")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                mode='phaser',
                ph_delay=3.0, ph_decay=0.4, ph_speed=0.5, ph_type='triangular',
                fl_delay=0.0, fl_depth=2.0, fl_regen=0.0, fl_width=71.0,
                fl_speed=0.5, fl_shape='sinusoidal', fl_phase=25.0,
                chorus_preset='single', lfo_f=5.0, lfo_d=0.5,
                pu_hz=2.0, pu_amount=1.0, pu_width=1.0, pu_mode='sine',
                audio="", video=""):
        src = _pick_source(audio, video, "Audio Modulation")
        if mode == 'phaser':
            t = 't' if ph_type == 'triangular' else 's'
            spec = ('aphaser',
                    f'in_gain=0.4:out_gain=0.74'
                    f':delay={_f(ph_delay, 0.0, 5.0, 3.0)}'
                    f':decay={_f(ph_decay, 0.0, 0.99, 0.4)}'
                    f':speed={_f(ph_speed, 0.1, 2.0, 0.5)}:type={t}')
        elif mode == 'flanger':
            shape = fl_shape if fl_shape in ('sinusoidal', 'triangular') \
                else 'sinusoidal'
            spec = ('flanger',
                    f'delay={_f(fl_delay, 0.0, 30.0, 0.0)}'
                    f':depth={_f(fl_depth, 0.0, 10.0, 2.0)}'
                    f':regen={_f(fl_regen, -95.0, 95.0, 0.0)}'
                    f':width={_f(fl_width, 0.0, 100.0, 71.0)}'
                    f':speed={_f(fl_speed, 0.1, 10.0, 0.5)}'
                    f':shape={shape}:phase={_f(fl_phase, 0.0, 100.0, 25.0)}')
        elif mode == 'chorus':
            args = cls.CHORUS_PRESETS.get(chorus_preset,
                                          cls.CHORUS_PRESETS['single'])
            spec = ('chorus', args)
        elif mode == 'vibrato':
            spec = ('vibrato', f'f={_f(lfo_f, 0.1, 20000.0, 5.0)}'
                               f':d={_f(lfo_d, 0.0, 1.0, 0.5)}')
        elif mode == 'tremolo':
            spec = ('tremolo', f'f={_f(lfo_f, 0.1, 20000.0, 5.0)}'
                               f':d={_f(lfo_d, 0.0, 1.0, 0.5)}')
        elif mode == 'pulsator':
            pm = pu_mode if pu_mode in ('sine', 'triangle', 'square',
                                        'sawup', 'sawdown') else 'sine'
            spec = ('apulsator',
                    f'mode={pm}:timing=hz:hz={_f(pu_hz, 0.01, 100.0, 2.0)}'
                    f':amount={_f(pu_amount, 0.0, 1.0, 1.0)}'
                    f':width={_f(pu_width, 0.0, 2.0, 1.0)}')
        else:
            raise RuntimeError(f"Audio Modulation: unknown mode {mode!r}")
        payload = filter_audio(src, [spec])
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class AudioStereoStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AudioStereoStage",
            display_name="Audio Stereo",
            category="ComfyTV/AudioFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("mode",
                              ['widen', 'extrastereo', 'crossfeed', 'haas',
                               'balance', 'mono', 'swap'], 'widen'),
                _hidden_float("sw_delay", 20.0, 1.0, 100.0),
                _hidden_float("sw_feedback", 0.3, 0.0, 0.9),
                _hidden_float("sw_crossfeed", 0.3, 0.0, 0.8),
                _hidden_float("sw_drymix", 0.8, 0.0, 1.0),
                _hidden_float("es_m", 2.5, -10.0, 10.0),
                _hidden_float("cf_strength", 0.2, 0.0, 1.0),
                _hidden_float("cf_range", 0.5, 0.0, 1.0),
                _hidden_float("haas_side_gain", 1.0, 0.06, 12.0),
                _hidden_float("haas_left_delay", 2.05, 0.0, 40.0),
                _hidden_float("haas_right_delay", 2.12, 0.0, 40.0),
                _hidden_float("balance", 0.0, -1.0, 1.0),
                COMFYTV_AUDIO.Input("audio", optional=True),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_AUDIO.Output("audio")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                mode='widen', sw_delay=20.0, sw_feedback=0.3, sw_crossfeed=0.3,
                sw_drymix=0.8, es_m=2.5, cf_strength=0.2, cf_range=0.5,
                haas_side_gain=1.0, haas_left_delay=2.05, haas_right_delay=2.12,
                balance=0.0, audio="", video=""):
        src = _pick_source(audio, video, "Audio Stereo")
        if mode == 'widen':
            spec = ('stereowiden',
                    f'delay={_f(sw_delay, 1.0, 100.0, 20.0)}'
                    f':feedback={_f(sw_feedback, 0.0, 0.9, 0.3)}'
                    f':crossfeed={_f(sw_crossfeed, 0.0, 0.8, 0.3)}'
                    f':drymix={_f(sw_drymix, 0.0, 1.0, 0.8)}')
        elif mode == 'extrastereo':
            spec = ('extrastereo', f'm={_f(es_m, -10.0, 10.0, 2.5)}')
        elif mode == 'crossfeed':
            spec = ('crossfeed',
                    f'strength={_f(cf_strength, 0.0, 1.0, 0.2)}'
                    f':range={_f(cf_range, 0.0, 1.0, 0.5)}')
        elif mode == 'haas':
            spec = ('haas',
                    f'side_gain={_f(haas_side_gain, 0.06, 12.0, 1.0)}'
                    f':left_delay={_f(haas_left_delay, 0.0, 40.0, 2.05)}'
                    f':right_delay={_f(haas_right_delay, 0.0, 40.0, 2.12)}')
        elif mode == 'balance':
            spec = ('stereotools',
                    f'balance_out={_f(balance, -1.0, 1.0, 0.0)}')
        elif mode == 'mono':
            spec = ('pan', 'stereo|c0=.5*c0+.5*c1|c1=.5*c0+.5*c1')
        elif mode == 'swap':
            spec = ('pan', 'stereo|c0=c1|c1=c0')
        else:
            raise RuntimeError(f"Audio Stereo: unknown mode {mode!r}")
        payload = filter_audio(src, [spec])
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class AudioTimePitchStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AudioTimePitchStage",
            display_name="Audio Time / Pitch",
            category="ComfyTV/AudioFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("mode", ['speed', 'pitch', 'reverse'], 'speed'),
                _hidden_float("tempo", 1.0, 0.25, 4.0),
                _hidden_float("semitones", 0.0, -24.0, 24.0, step=0.5),
                COMFYTV_AUDIO.Input("audio", optional=True),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_AUDIO.Output("audio")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                mode='speed', tempo=1.0, semitones=0.0, audio="", video=""):
        src = _pick_source(audio, video, "Audio Time / Pitch")
        if mode == 'speed':
            t = _f(tempo, 0.25, 4.0, 1.0)
            if t == 1.0:
                raise RuntimeError("Audio Time / Pitch: tempo is 1.0 — nothing to do.")
            specs = [('atempo', f'{t}')] if t >= 0.5 else \
                [('atempo', f'{t ** 0.5:.8f}'), ('atempo', f'{t ** 0.5:.8f}')]
        elif mode == 'pitch':
            n = _f(semitones, -24.0, 24.0, 0.0)
            if not n:
                raise RuntimeError("Audio Time / Pitch: semitones is 0 — nothing to do.")
            ratio = 2.0 ** (n / 12.0)
            specs = [('asetrate', f'{int(round(_AUDIO_SR * ratio))}'),
                     ('aresample', f'{_AUDIO_SR}')]
            inv = 1.0 / ratio
            if inv >= 0.5:
                specs.append(('atempo', f'{inv:.8f}'))
            else:
                specs += [('atempo', f'{inv ** 0.5:.8f}'),
                          ('atempo', f'{inv ** 0.5:.8f}')]
        elif mode == 'reverse':
            specs = [('areverse', None)]
        else:
            raise RuntimeError(f"Audio Time / Pitch: unknown mode {mode!r}")
        payload = filter_audio(src, specs)
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class AudioRepairStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AudioRepairStage",
            display_name="Audio Repair",
            category="ComfyTV/AudioFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("method",
                              ['declick', 'declip', 'denorm', 'wavelet',
                               'hum'],
                              'declick'),
                _hidden_float("dk_window", 55.0, 10.0, 100.0),
                _hidden_float("dk_threshold", 2.0, 1.0, 100.0),
                _hidden_float("dk_burst", 2.0, 0.0, 10.0),
                _hidden_float("dc_threshold", 10.0, 1.0, 100.0),
                _hidden_int("dc_hsize", 1000, 100, 9999),
                _hidden_int("dn_level", -351, -451, -90),
                _hidden_float("wt_sigma", 0.0, 0.0, 1.0, step=0.001),
                _hidden_float("wt_percent", 85.0, 0.0, 100.0, step=1.0),
                _hidden_int("wt_levels", 10, 1, 12),
                _hidden_float("hum_freq", 50.0, 10.0, 2000.0, step=1.0),
                _hidden_int("hum_harmonics", 8, 1, 16),
                _hidden_float("hum_q", 8.0, 1.0, 100.0),
                COMFYTV_AUDIO.Input("audio", optional=True),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_AUDIO.Output("audio")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                method='declick', dk_window=55.0, dk_threshold=2.0,
                dk_burst=2.0, dc_threshold=10.0, dc_hsize=1000,
                dn_level=-351, wt_sigma=0.0, wt_percent=85.0, wt_levels=10,
                hum_freq=50.0, hum_harmonics=8, hum_q=8.0,
                audio="", video=""):
        src = _pick_source(audio, video, "Audio Repair")
        if method == 'hum':
            f0 = _f(hum_freq, 10.0, 2000.0, 50.0)
            q = _f(hum_q, 1.0, 100.0, 8.0)
            n = min(16, max(1, int(hum_harmonics or 8)))
            specs = []
            for i in range(1, n + 1):
                fi = f0 * i
                if fi >= _AUDIO_SR / 2.0 * 0.98:
                    break
                specs.append(('bandreject',
                              f'f={fi}:width_type=q:w={q * i}'))
            payload = filter_audio(src, specs)
            return _stage_emit_auto(cls, project_id=project_id,
                                    payload_str=payload,
                                    parent_output_id=parent_output_id)
        if method == 'declick':
            spec = ('adeclick',
                    f'window={_f(dk_window, 10.0, 100.0, 55.0)}'
                    f':threshold={_f(dk_threshold, 1.0, 100.0, 2.0)}'
                    f':burst={_f(dk_burst, 0.0, 10.0, 2.0)}')
        elif method == 'declip':
            spec = ('adeclip',
                    f'threshold={_f(dc_threshold, 1.0, 100.0, 10.0)}'
                    f':hsize={min(9999, max(100, int(dc_hsize or 1000)))}')
        elif method == 'denorm':
            spec = ('adenorm',
                    f'level={min(-90, max(-451, int(dn_level or -351)))}')
        elif method == 'wavelet':
            sigma = _f(wt_sigma, 0.0, 1.0, 0.0)
            if not sigma:
                raise RuntimeError(
                    "Audio Repair: wavelet denoise needs sigma > 0.")
            spec = ('afwtdn',
                    f'sigma={sigma}'
                    f':percent={_f(wt_percent, 0.0, 100.0, 85.0)}'
                    f':levels={min(12, max(1, int(wt_levels or 10)))}')
        else:
            raise RuntimeError(f"Audio Repair: unknown method {method!r}")
        payload = filter_audio(src, [spec])
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class AudioSaturateStage(io.ComfyNode):

    SOFTCLIP_TYPES = ['hard', 'tanh', 'atan', 'cubic', 'exp', 'alg',
                      'quintic', 'sin', 'erf']

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AudioSaturateStage",
            display_name="Audio Saturate",
            category="ComfyTV/AudioFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("mode",
                              ['softclip', 'psyclip', 'crush', 'exciter',
                               'crystalizer'], 'softclip'),
                _hidden_combo("sc_type", cls.SOFTCLIP_TYPES, 'hard'),
                _hidden_float("sc_threshold", 1.0, 0.01, 1.0),
                _hidden_float("py_clip", 1.0, 0.015625, 1.0),
                _hidden_float("py_adaptive", 0.5, 0.0, 1.0),
                _hidden_float("cr_bits", 8.0, 1.0, 64.0),
                _hidden_float("cr_mix", 0.5, 0.0, 1.0),
                _hidden_combo("cr_mode", ['lin', 'log'], 'lin'),
                _hidden_float("ex_amount", 1.0, 0.0, 64.0),
                _hidden_float("ex_drive", 8.5, 0.1, 10.0),
                _hidden_float("ex_blend", 0.0, -10.0, 10.0),
                _hidden_float("ex_freq", 7500.0, 2000.0, 12000.0, step=10.0),
                _hidden_float("cz_i", 2.0, -10.0, 10.0),
                COMFYTV_AUDIO.Input("audio", optional=True),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_AUDIO.Output("audio")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                mode='softclip', sc_type='hard', sc_threshold=1.0,
                py_clip=1.0, py_adaptive=0.5, cr_bits=8.0, cr_mix=0.5,
                cr_mode='lin', ex_amount=1.0, ex_drive=8.5, ex_blend=0.0,
                ex_freq=7500.0, cz_i=2.0, audio="", video=""):
        src = _pick_source(audio, video, "Audio Saturate")
        if mode == 'softclip':
            t = sc_type if sc_type in cls.SOFTCLIP_TYPES else 'hard'
            spec = ('asoftclip',
                    f'type={t}:threshold={_f(sc_threshold, 0.01, 1.0, 1.0)}')
        elif mode == 'psyclip':
            spec = ('apsyclip',
                    f'clip={_f(py_clip, 0.015625, 1.0, 1.0)}'
                    f':adaptive={_f(py_adaptive, 0.0, 1.0, 0.5)}')
        elif mode == 'crush':
            m = cr_mode if cr_mode in ('lin', 'log') else 'lin'
            spec = ('acrusher',
                    f'bits={_f(cr_bits, 1.0, 64.0, 8.0)}'
                    f':mix={_f(cr_mix, 0.0, 1.0, 0.5)}:mode={m}')
        elif mode == 'exciter':
            spec = ('aexciter',
                    f'amount={_f(ex_amount, 0.0, 64.0, 1.0)}'
                    f':drive={_f(ex_drive, 0.1, 10.0, 8.5)}'
                    f':blend={_f(ex_blend, -10.0, 10.0, 0.0)}'
                    f':freq={_f(ex_freq, 2000.0, 12000.0, 7500.0)}')
        elif mode == 'crystalizer':
            spec = ('crystalizer', f'i={_f(cz_i, -10.0, 10.0, 2.0)}')
        else:
            raise RuntimeError(f"Audio Saturate: unknown mode {mode!r}")
        payload = filter_audio(src, [spec])
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


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
            naming=nm, prefix=prefix or 'segment')
        payload = json.dumps(result)
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class AudioConvolveStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AudioConvolveStage",
            display_name="Audio Convolve (IR)",
            category="ComfyTV/AudioFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_float("wet", 1.0, 0.0, 2.0),
                _hidden_float("dry", 0.0, 0.0, 2.0),
                io.Boolean.Input("normalize", default=True, socketless=True,
                                 extra_dict={"hidden": True}),
                COMFYTV_AUDIO.Input("audio", optional=True),
                COMFYTV_AUDIO.Input("ir", optional=True),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_AUDIO.Output("audio")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                wet=1.0, dry=0.0, normalize=True, audio="", ir="", video=""):
        src = _pick_source(audio, video, "Audio Convolve")
        if not (ir or '').strip():
            raise RuntimeError(
                "Audio Convolve needs an upstream impulse response — "
                "wire an audio into the ir input.")
        payload = convolve_ir(src, ir, wet=_f(wet, 0.0, 2.0, 1.0),
                              dry=_f(dry, 0.0, 2.0, 0.0),
                              normalize=bool(normalize))
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
