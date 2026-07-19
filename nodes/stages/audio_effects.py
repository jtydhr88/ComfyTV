from ._common import *  # noqa: F401, F403
from ...runners.media_filter import filter_audio
from ...runners.audio_dsp import echo_feedback, convolve_ir

from .common.fx_helpers import (  # noqa: F401
    _pick_source, _progress_cb, _f, _AUDIO_SR,
    _hidden_float, _hidden_combo,
)


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
        payload = filter_audio(src, [('aecho', args)],
                               progress=_progress_cb(cls))
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
            outputs=[COMFYTV_AUDIO.Output("audio"), COMFYTV_FXSPEC.Output("fx_spec")],
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
        src = (audio or '').strip() or (video or '').strip()
        if mode == 'phaser':
            t = 't' if ph_type == 'triangular' else 's'
            spec = ('aphaser',
                    f'in_gain=0.4:out_gain=0.74'
                    f':delay={_f(ph_delay, 0.1, 5.0, 3.0)}'
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
        fx_spec = build_fx_spec("ComfyTV.AudioModulationStage", "Audio Modulation",
                                "audio", [spec])
        if not src:
            return _fx_spec_only(fx_spec)
        payload = filter_audio(src, [spec], progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id,
                                extra_outputs=(fx_spec,))


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
            outputs=[COMFYTV_AUDIO.Output("audio"), COMFYTV_FXSPEC.Output("fx_spec")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                mode='widen', sw_delay=20.0, sw_feedback=0.3, sw_crossfeed=0.3,
                sw_drymix=0.8, es_m=2.5, cf_strength=0.2, cf_range=0.5,
                haas_side_gain=1.0, haas_left_delay=2.05, haas_right_delay=2.12,
                balance=0.0, audio="", video=""):
        src = (audio or '').strip() or (video or '').strip()
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
        fx_spec = build_fx_spec("ComfyTV.AudioStereoStage", "Audio Stereo",
                                "audio", [spec])
        if not src:
            return _fx_spec_only(fx_spec)
        payload = filter_audio(src, [spec], progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id,
                                extra_outputs=(fx_spec,))


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
            outputs=[COMFYTV_AUDIO.Output("audio"), COMFYTV_FXSPEC.Output("fx_spec")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                mode='speed', tempo=1.0, semitones=0.0, audio="", video=""):
        src = (audio or '').strip() or (video or '').strip()
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
        fx_spec = build_fx_spec("ComfyTV.AudioTimePitchStage", "Audio Time / Pitch",
                                "audio", specs)
        if not src:
            return _fx_spec_only(fx_spec)
        payload = filter_audio(src, specs, progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id,
                                extra_outputs=(fx_spec,))


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
            outputs=[COMFYTV_AUDIO.Output("audio"), COMFYTV_FXSPEC.Output("fx_spec")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                mode='softclip', sc_type='hard', sc_threshold=1.0,
                py_clip=1.0, py_adaptive=0.5, cr_bits=8.0, cr_mix=0.5,
                cr_mode='lin', ex_amount=1.0, ex_drive=8.5, ex_blend=0.0,
                ex_freq=7500.0, cz_i=2.0, audio="", video=""):
        src = (audio or '').strip() or (video or '').strip()
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
        fx_spec = build_fx_spec("ComfyTV.AudioSaturateStage", "Audio Saturate",
                                "audio", [spec])
        if not src:
            return _fx_spec_only(fx_spec)
        payload = filter_audio(src, [spec], progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id,
                                extra_outputs=(fx_spec,))


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
                              normalize=bool(normalize),
                              progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)
