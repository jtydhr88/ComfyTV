from ._common import *  # noqa: F401, F403
from ...runners.media_filter import filter_audio, has_filter, analyze_audio

import re

from .video_fx import _hidden_float, _hidden_int, _hidden_combo, _f  # noqa: F401


def _pick_source(audio, video, label):
    src = (audio or '').strip() or (video or '').strip()
    if not src:
        raise RuntimeError(
            f"{label} needs an upstream audio or video — wire one in."
        )
    return src


def _db_to_linear(db: float) -> float:
    return 10.0 ** (float(db) / 20.0)


_LOUDNORM_FIELDS = ('input_i', 'input_tp', 'input_lra', 'input_thresh',
                    'target_offset')


def _measure_astats(src: str):
    try:
        lines = analyze_audio(src, [('astats', None)])
    except Exception:
        return None
    flat = []
    for msg in lines:
        flat.extend(str(msg).splitlines())
    overall = []
    seen = False
    for line in flat:
        if 'Overall' in line:
            seen = True
        elif seen:
            overall.append(line)
    out = {}
    for key, label in (('peak_db', r'Peak level dB:\s*([-+0-9.]+)'),
                       ('rms_db', r'RMS level dB:\s*([-+0-9.]+)')):
        for line in overall or flat:
            m = re.search(label, line)
            if m:
                out[key] = float(m.group(1))
                break
    return out if len(out) == 2 else None


def _loudnorm_measure(src: str, base_args: str):
    try:
        lines = analyze_audio(
            src, [('loudnorm', f'{base_args}:print_format=json')])
    except Exception:
        return None
    joined = '\n'.join(str(m) for m in lines)
    out = {}
    for field in _LOUDNORM_FIELDS:
        m = re.search(rf'"{field}"\s*:\s*"([-+0-9.]+)"', joined)
        if not m:
            return None
        out[field] = float(m.group(1))
    return out


class AudioDynamicsStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AudioDynamicsStage",
            display_name="Audio Dynamics",
            category="ComfyTV/AudioFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("mode", ['compressor', 'gate', 'limiter', 'deesser'],
                              'compressor'),
                _hidden_float("threshold_db", -20.0, -60.0, 0.0, step=0.5),
                _hidden_float("ratio", 4.0, 1.0, 20.0, step=0.5),
                _hidden_float("attack_ms", 20.0, 0.01, 2000.0),
                _hidden_float("release_ms", 250.0, 0.01, 9000.0),
                _hidden_float("makeup_db", 0.0, 0.0, 24.0, step=0.5),
                _hidden_float("knee", 2.83, 1.0, 8.0),
                _hidden_float("intensity", 0.5, 0.0, 1.0),
                COMFYTV_AUDIO.Input("audio", optional=True),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_AUDIO.Output("audio")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                mode='compressor', threshold_db=-20.0, ratio=4.0,
                attack_ms=20.0, release_ms=250.0, makeup_db=0.0,
                knee=2.83, intensity=0.5, audio="", video=""):
        src = _pick_source(audio, video, "Audio Dynamics")
        thr = _db_to_linear(_f(threshold_db, -60.0, 0.0, -20.0))
        atk = _f(attack_ms, 0.01, 2000.0, 20.0)
        rel = _f(release_ms, 0.01, 9000.0, 250.0)
        if mode == 'compressor':
            spec = ('acompressor',
                    f'threshold={thr:.6f}:ratio={_f(ratio, 1, 20, 4)}'
                    f':attack={atk}:release={rel}'
                    f':makeup={_db_to_linear(_f(makeup_db, 0, 24)):.4f}'
                    f':knee={_f(knee, 1, 8, 2.83)}')
        elif mode == 'gate':
            spec = ('agate',
                    f'threshold={thr:.6f}:ratio={_f(ratio, 1, 20, 2)}'
                    f':attack={atk}:release={rel}:knee={_f(knee, 1, 8, 2.83)}')
        elif mode == 'limiter':
            if not has_filter('alimiter'):
                raise RuntimeError("Audio Dynamics: this FFmpeg build lacks alimiter.")
            spec = ('alimiter',
                    f'limit={min(1.0, max(0.0625, thr)):.6f}'
                    f':attack={min(max(atk, 0.1), 80)}'
                    f':release={min(max(rel, 1.0), 8000)}')
        elif mode == 'deesser':
            spec = ('deesser', f'i={_f(intensity, 0.0, 1.0, 0.5)}')
        else:
            raise RuntimeError(f"Audio Dynamics: unknown mode {mode!r}")
        payload = filter_audio(src, [spec])
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class AudioEQStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AudioEQStage",
            display_name="Audio EQ",
            category="ComfyTV/AudioFX",
            inputs=[
                *_standard_stage_inputs(),
                io.String.Input("bands", default="", multiline=False,
                                socketless=True, extra_dict={"hidden": True},
                                tooltip='JSON [{"type":"peak|highpass|lowpass|lowshelf|highshelf",'
                                        '"f":1000,"g":0,"q":1}] — driven by the EQ graph UI'),
                COMFYTV_AUDIO.Input("audio", optional=True),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_AUDIO.Output("audio")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                bands="", audio="", video=""):
        src = _pick_source(audio, video, "Audio EQ")
        try:
            parsed = json.loads(bands or "[]")
        except (ValueError, TypeError):
            parsed = []
        specs = []
        for b in parsed if isinstance(parsed, list) else []:
            try:
                btype = str(b.get('type', 'peak'))
                f = min(20000.0, max(20.0, float(b.get('f', 1000))))
                g = min(24.0, max(-24.0, float(b.get('g', 0))))
                q = min(20.0, max(0.1, float(b.get('q', 1.0))))
            except (TypeError, ValueError, AttributeError):
                continue
            if btype == 'peak':
                if g:
                    specs.append(('equalizer', f'f={f}:width_type=q:w={q}:g={g}'))
            elif btype == 'highpass':
                specs.append(('highpass', f'f={f}:poles=2'))
            elif btype == 'lowpass':
                specs.append(('lowpass', f'f={f}:poles=2'))
            elif btype == 'lowshelf' and has_filter('bass'):
                if g:
                    specs.append(('bass', f'g={g}:f={f}'))
            elif btype == 'highshelf' and has_filter('treble'):
                if g:
                    specs.append(('treble', f'g={g}:f={f}'))
        if not specs:
            raise RuntimeError("Audio EQ: no active bands — add a band or set a gain.")
        payload = filter_audio(src, specs)
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class AudioLoudnessStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AudioLoudnessStage",
            display_name="Audio Loudness",
            category="ComfyTV/AudioFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("mode", ['ebu_r128', 'dynamic', 'normalize'],
                              'ebu_r128'),
                _hidden_float("target_i", -16.0, -30.0, -10.0, step=0.5,
                              tooltip="integrated loudness target (LUFS)"),
                _hidden_float("target_tp", -1.5, -3.0, 0.0, step=0.1,
                              tooltip="max true peak (dBTP)"),
                _hidden_float("target_lra", 11.0, 1.0, 20.0, step=0.5),
                _hidden_int("dyn_frame_ms", 500, 10, 8000),
                _hidden_int("dyn_gauss", 31, 3, 301, "gaussian window (odd)"),
                _hidden_float("peak_target_db", -1.0, -30.0, 0.0, step=0.1),
                _hidden_combo("peak_mode", ['true_peak', 'sample'],
                              'true_peak'),
                io.Boolean.Input("use_rms", default=False, socketless=True,
                                 extra_dict={"hidden": True}),
                _hidden_float("rms_target_db", -9.0, -30.0, 0.0, step=0.5),
                io.Boolean.Input("use_lufs", default=False, socketless=True,
                                 extra_dict={"hidden": True}),
                COMFYTV_AUDIO.Input("audio", optional=True),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_AUDIO.Output("audio")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                mode='ebu_r128', target_i=-16.0, target_tp=-1.5, target_lra=11.0,
                dyn_frame_ms=500, dyn_gauss=31, peak_target_db=-1.0,
                peak_mode='true_peak', use_rms=False, rms_target_db=-9.0,
                use_lufs=False, audio="", video=""):
        src = _pick_source(audio, video, "Audio Loudness")
        if mode == 'normalize':
            stats = _measure_astats(src)
            loud = _loudnorm_measure(src, 'I=-16:TP=-1.5:LRA=11') \
                if (peak_mode == 'true_peak' or use_lufs) else None
            if stats is None:
                raise RuntimeError("Audio Loudness: measurement failed.")
            gains = []
            target_pk = _f(peak_target_db, -30.0, 0.0, -1.0)
            if peak_mode == 'true_peak' and loud is not None:
                gains.append(target_pk - loud['input_tp'])
            else:
                gains.append(target_pk - stats['peak_db'])
            if use_rms:
                gains.append(_f(rms_target_db, -30.0, 0.0, -9.0)
                             - stats['rms_db'])
            if use_lufs and loud is not None:
                gains.append(_f(target_i, -30.0, -10.0, -16.0)
                             - loud['input_i'])
            gain = min(gains)
            spec = ('volume', f'{gain:.4f}dB')
        elif mode == 'ebu_r128':
            base = (f'I={_f(target_i, -30, -10, -16)}'
                    f':TP={_f(target_tp, -3, 0, -1.5)}'
                    f':LRA={_f(target_lra, 1, 20, 11)}')
            measured = _loudnorm_measure(src, base)
            if measured:
                spec = ('loudnorm',
                        base
                        + f':measured_I={measured["input_i"]}'
                        f':measured_TP={measured["input_tp"]}'
                        f':measured_LRA={measured["input_lra"]}'
                        f':measured_thresh={measured["input_thresh"]}'
                        f':offset={measured["target_offset"]}'
                        f':linear=true')
            else:
                spec = ('loudnorm', base)
        else:
            g = min(301, max(3, int(dyn_gauss or 31)))
            g += (g + 1) % 2
            spec = ('dynaudnorm', f'f={min(8000, max(10, int(dyn_frame_ms or 500)))}:g={g}')
        payload = filter_audio(src, [spec])
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class AudioDenoiseStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AudioDenoiseStage",
            display_name="Audio Denoise",
            category="ComfyTV/AudioFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("method", ['afftdn', 'anlmdn', 'silenceremove'], 'afftdn'),
                _hidden_float("strength", 0.3, 0.0, 1.0),
                _hidden_float("silence_db", -50.0, -80.0, -20.0, step=1.0),
                _hidden_float("min_silence_s", 0.5, 0.1, 5.0, step=0.1),
                _hidden_float("keep_silence_s", 0.5, 0.0, 5.0, step=0.1),
                COMFYTV_AUDIO.Input("audio", optional=True),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_AUDIO.Output("audio")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                method='afftdn', strength=0.3, silence_db=-50.0, min_silence_s=0.5,
                keep_silence_s=0.5, audio="", video=""):
        src = _pick_source(audio, video, "Audio Denoise")
        s = _f(strength, 0.0, 1.0, 0.3)
        if method == 'afftdn':
            spec = ('afftdn', f'nr={max(0.01, s * 40.0):.2f}')
        elif method == 'anlmdn':
            spec = ('anlmdn', f's={max(0.00001, s * 0.01):.6f}')
        elif method == 'silenceremove':
            db = _f(silence_db, -80.0, -20.0, -50.0)
            dur = _f(min_silence_s, 0.1, 5.0, 0.5)
            keep = _f(keep_silence_s, 0.0, 5.0, 0.5)
            spec = ('silenceremove',
                    f'start_periods=1:start_threshold={db}dB:start_duration={dur}'
                    f':start_silence={keep}'
                    f':stop_periods=-1:stop_threshold={db}dB:stop_duration={dur}'
                    f':stop_silence={keep}')
        else:
            raise RuntimeError(f"Audio Denoise: unknown method {method!r}")
        payload = filter_audio(src, [spec])
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)
