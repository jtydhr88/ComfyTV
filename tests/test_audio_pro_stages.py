from pathlib import Path

import pytest

av = pytest.importorskip("av")
np = pytest.importorskip("numpy")

from test_media_concat import _write_clip  # noqa: E402

ALL_AUDIO_PRO_CLASSES = [
    "AudioEchoStage", "AudioModulationStage", "AudioStereoStage",
    "AudioTimePitchStage", "AudioRepairStage", "AudioSaturateStage",
    "AudioCrossfadeStage", "AudioAnalyzeStage", "AudioVisualizeStage",
    "AudioMixStage", "AudioSegmentExportStage", "AudioConvolveStage",
    "AudioSweepStage", "AudioDeconvolveStage",
]


def _classes():
    import inspect

    from ComfyTV.nodes.stages import audio_pro
    out = {}
    for name, obj in inspect.getmembers(audio_pro):
        if inspect.isclass(obj) and hasattr(obj, "define_schema") \
                and obj.__module__ == audio_pro.__name__:
            out[name] = obj
    return out


@pytest.mark.parametrize("cls_name", ALL_AUDIO_PRO_CLASSES)
def test_define_schema(cls_name):
    classes = _classes()
    assert cls_name in classes, f"{cls_name} missing from audio_pro"
    classes[cls_name].define_schema()


def test_meta_registered():
    from ComfyTV.nodes.stages.common.meta import STAGE_META
    for name in ALL_AUDIO_PRO_CLASSES:
        assert name in STAGE_META, f"{name} missing from STAGE_META"


@pytest.fixture()
def clip():
    import folder_paths

    from ComfyTV.runners import media
    src_dir = Path(folder_paths.get_output_directory()) / 'audio-pro-src'
    src_dir.mkdir(parents=True, exist_ok=True)
    p = src_dir / 'ap_clip.mp4'
    if not p.exists():
        _write_clip(p, w=160, h=120, fps=24, seconds=1.5, with_audio=True)
    return media.path_to_view_url(p)


@pytest.fixture()
def clip_b(clip):
    import folder_paths

    from ComfyTV.runners import media
    src_dir = Path(folder_paths.get_output_directory()) / 'audio-pro-src'
    p = src_dir / 'ap_clip_b.mp4'
    if not p.exists():
        _write_clip(p, w=160, h=120, fps=24, seconds=1.2, with_audio=True)
    return media.path_to_view_url(p)


class TestEcho:
    @pytest.mark.parametrize("preset",
                             ['doubled', 'robot', 'mountains', 'mountains2'])
    def test_presets(self, clip, preset):
        _classes()["AudioEchoStage"].execute(
            project_id="p1", preset=preset, video=clip)

    def test_custom(self, clip):
        _classes()["AudioEchoStage"].execute(
            project_id="p1", preset='custom', in_gain=0.7, out_gain=0.4,
            delay_ms=250.0, decay=0.35, video=clip)


class TestModulation:
    @pytest.mark.parametrize("mode", ['phaser', 'flanger', 'vibrato',
                                      'tremolo', 'pulsator'])
    def test_modes(self, clip, mode):
        _classes()["AudioModulationStage"].execute(
            project_id="p1", mode=mode, video=clip)

    @pytest.mark.parametrize("preset", ['single', 'double', 'triple'])
    def test_chorus_presets(self, clip, preset):
        _classes()["AudioModulationStage"].execute(
            project_id="p1", mode='chorus', chorus_preset=preset, video=clip)


class TestStereo:
    @pytest.mark.parametrize("mode", ['widen', 'extrastereo', 'crossfeed',
                                      'haas', 'balance', 'mono', 'swap'])
    def test_modes(self, clip, mode):
        _classes()["AudioStereoStage"].execute(
            project_id="p1", mode=mode, balance=0.4, video=clip)


class TestTimePitch:
    def test_speed_up(self, clip):
        _classes()["AudioTimePitchStage"].execute(
            project_id="p1", mode='speed', tempo=1.5, video=clip)

    def test_speed_below_atempo_floor_chains(self, clip):
        _classes()["AudioTimePitchStage"].execute(
            project_id="p1", mode='speed', tempo=0.3, video=clip)

    def test_speed_noop_rejected(self, clip):
        with pytest.raises(RuntimeError, match="nothing to do"):
            _classes()["AudioTimePitchStage"].execute(
                project_id="p1", mode='speed', tempo=1.0, video=clip)

    @pytest.mark.parametrize("semi", [7.0, -7.0, 24.0, -24.0])
    def test_pitch(self, clip, semi):
        _classes()["AudioTimePitchStage"].execute(
            project_id="p1", mode='pitch', semitones=semi, video=clip)

    def test_reverse(self, clip):
        _classes()["AudioTimePitchStage"].execute(
            project_id="p1", mode='reverse', video=clip)


class TestRepair:
    @pytest.mark.parametrize("method", ['declick', 'declip', 'denorm'])
    def test_methods(self, clip, method):
        _classes()["AudioRepairStage"].execute(
            project_id="p1", method=method, video=clip)

    def test_wavelet(self, clip):
        _classes()["AudioRepairStage"].execute(
            project_id="p1", method='wavelet', wt_sigma=0.05, video=clip)

    def test_wavelet_zero_sigma_rejected(self, clip):
        with pytest.raises(RuntimeError, match="sigma"):
            _classes()["AudioRepairStage"].execute(
                project_id="p1", method='wavelet', wt_sigma=0.0, video=clip)


class TestSaturate:
    @pytest.mark.parametrize("mode", ['softclip', 'psyclip', 'crush',
                                      'exciter', 'crystalizer'])
    def test_modes(self, clip, mode):
        _classes()["AudioSaturateStage"].execute(
            project_id="p1", mode=mode, video=clip)


class TestCrossfade:
    def test_default(self, clip, clip_b):
        _classes()["AudioCrossfadeStage"].execute(
            project_id="p1", duration=0.4, video_a=clip, video_b=clip_b)

    def test_curves(self, clip, clip_b):
        _classes()["AudioCrossfadeStage"].execute(
            project_id="p1", duration=0.3, curve1='qsin', curve2='exp',
            overlap=False, video_a=clip, video_b=clip_b)

    def test_missing_b_rejected(self, clip):
        with pytest.raises(RuntimeError, match="B"):
            _classes()["AudioCrossfadeStage"].execute(
                project_id="p1", video_a=clip)

    def test_bad_curve_rejected(self, clip, clip_b):
        with pytest.raises(RuntimeError, match="curve"):
            _classes()["AudioCrossfadeStage"].execute(
                project_id="p1", curve1='bogus', video_a=clip, video_b=clip_b)


class TestAnalyzeRunner:
    def test_volumedetect_lines(self, clip):
        from ComfyTV.runners.media_filter import analyze_audio
        lines = analyze_audio(clip, [('volumedetect', None)])
        joined = '\n'.join(lines)
        assert 'mean_volume' in joined
        assert 'max_volume' in joined

    def test_ebur128_summary(self, clip):
        from ComfyTV.runners.media_filter import analyze_audio
        lines = analyze_audio(clip, [('ebur128', 'peak=true')])
        joined = '\n'.join(lines)
        assert 'LUFS' in joined


class TestAnalyzeStage:
    def _payload(self, monkeypatch, cls, **kw):
        import json

        from ComfyTV.nodes.stages import audio_pro
        captured = {}

        def _fake_emit(_cls, *, project_id, payload_str, **kwargs):
            captured['payload'] = payload_str
            return None

        monkeypatch.setattr(audio_pro, '_stage_emit_auto', _fake_emit)
        cls.execute(project_id="p1", **kw)
        return json.loads(captured['payload'])

    def test_loudness(self, clip, monkeypatch):
        data = self._payload(monkeypatch, _classes()["AudioAnalyzeStage"],
                             mode='loudness', video=clip)
        assert -70.0 < data['integrated_lufs'] < 0.0
        assert 'peak_dbfs' in data

    def test_volume(self, clip, monkeypatch):
        data = self._payload(monkeypatch, _classes()["AudioAnalyzeStage"],
                             mode='volume', video=clip)
        assert -60.0 < data['max_volume_db'] < 0.0
        assert data['mean_volume_db'] <= data['max_volume_db']

    def test_stats(self, clip, monkeypatch):
        data = self._payload(monkeypatch, _classes()["AudioAnalyzeStage"],
                             mode='stats', video=clip)
        assert 'rms_level_db' in data
        assert 'peak_level_db' in data

    def test_silence_none_found(self, clip, monkeypatch):
        data = self._payload(monkeypatch, _classes()["AudioAnalyzeStage"],
                             mode='silence', silence_noise_db=-60.0,
                             silence_duration=0.5, video=clip)
        assert data['count'] == 0

    def test_silence_found(self, clip, monkeypatch):
        data = self._payload(monkeypatch, _classes()["AudioAnalyzeStage"],
                             mode='silence', silence_noise_db=-1.0,
                             silence_duration=0.5, video=clip)
        assert data['count'] >= 1
        assert data['segments'][0]['start'] is not None


class TestVisualize:
    def _payload(self, monkeypatch, **kw):
        from ComfyTV.nodes.stages import audio_pro
        captured = {}

        def _fake_emit(_cls, *, project_id, payload_str, **kwargs):
            captured['payload'] = payload_str
            return None

        monkeypatch.setattr(audio_pro, '_stage_emit_auto', _fake_emit)
        _classes()["AudioVisualizeStage"].execute(project_id="p1", **kw)
        return captured['payload']

    def test_waveform(self, clip, monkeypatch):
        from ComfyTV.runners.media import localize
        url = self._payload(monkeypatch, mode='waveform', width=600,
                            height=240, video=clip)
        p = localize(url)
        assert Path(p).suffix == '.png' and Path(p).stat().st_size > 0

    def test_spectrum(self, clip, monkeypatch):
        from ComfyTV.runners.media import localize
        url = self._payload(monkeypatch, mode='spectrum', width=640,
                            height=320, color='magma', video=clip)
        p = localize(url)
        assert Path(p).suffix == '.png' and Path(p).stat().st_size > 0

    def test_waveform_split_channels(self, clip, monkeypatch):
        url = self._payload(monkeypatch, mode='waveform', split_channels=True,
                            video=clip)
        assert url


class TestFeedbackEcho:
    def test_matches_naive_recurrence(self):
        from ComfyTV.runners.audio_dsp import feedback_echo_array
        rng = np.random.default_rng(7)
        x = (rng.standard_normal((2, 2000)) * 0.2).astype(np.float32)
        n, decay = 300, 0.6
        y = feedback_echo_array(x, n, decay)
        ref = x.astype(np.float64, copy=True)
        for i in range(n, ref.shape[1]):
            ref[:, i] += decay * ref[:, i - n]
        ref = np.clip(ref, -1.0, 1.0)
        assert np.allclose(y, ref, atol=1e-5)

    def test_zero_delay_rejected(self):
        from ComfyTV.runners.audio_dsp import feedback_echo_array
        with pytest.raises(RuntimeError, match="delay"):
            feedback_echo_array(np.zeros((2, 100), dtype=np.float32), 0, 0.5)

    def test_stage_feedback_preset(self, clip):
        _classes()["AudioEchoStage"].execute(
            project_id="p1", preset='feedback', delay_ms=200.0, decay=0.4,
            video=clip)


class TestRepairBoundaries:
    def test_wavelet_max_levels(self, clip):
        _classes()["AudioRepairStage"].execute(
            project_id="p1", method='wavelet', wt_sigma=0.05, wt_levels=12,
            video=clip)


class TestLoudnessTwoPass:
    def test_measure_fields(self, clip):
        from ComfyTV.nodes.stages.audio_fx import _loudnorm_measure
        measured = _loudnorm_measure(clip, 'I=-16:TP=-1.5:LRA=11')
        assert measured is not None
        for field in ('input_i', 'input_tp', 'input_lra', 'input_thresh',
                      'target_offset'):
            assert field in measured
        assert -70.0 <= measured['input_i'] < 0.0

    def test_stage_executes_linear(self, clip):
        from ComfyTV.nodes.stages.audio_fx import AudioLoudnessStage
        AudioLoudnessStage.execute(project_id="p1", mode='ebu_r128',
                                   video=clip)


class TestDenoiseKeepSilence:
    def test_silenceremove_with_keep(self, clip):
        from ComfyTV.nodes.stages.audio_fx import AudioDenoiseStage
        AudioDenoiseStage.execute(
            project_id="p1", method='silenceremove', silence_db=-50.0,
            min_silence_s=0.5, keep_silence_s=0.3, video=clip)


def _tone_silence_wav():
    from ComfyTV.runners.audio_dsp import _write_wav
    from ComfyTV.runners.media import _AUDIO_RATE, localize
    t = np.arange(int(0.6 * _AUDIO_RATE)) / _AUDIO_RATE
    tone = (0.3 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
    gap = np.zeros(int(0.8 * _AUDIO_RATE), dtype=np.float32)
    mono = np.concatenate([tone, gap, tone])
    url = _write_wav(np.stack([mono, mono]))
    return url, localize(url)


class TestPanAndDither:
    def test_audacity_pan_law(self):
        from ComfyTV.runners.audio_dsp import _pan_gains
        assert _pan_gains(0.0, 'audacity') == (1.0, 1.0)
        assert _pan_gains(-1.0, 'audacity') == (1.0, 0.0)
        assert _pan_gains(1.0, 'audacity') == (0.0, 1.0)

    def test_ardour_pan_law_center(self):
        from ComfyTV.runners.audio_dsp import _pan_gains
        gl, gr = _pan_gains(0.0, 'constant_power')
        assert abs(gl - 0.70795) < 1e-4 and abs(gr - 0.70795) < 1e-4

    def test_dither_quantized_grid(self):
        from ComfyTV.runners.audio_dsp import dither_quantize
        rng = np.random.default_rng(3)
        x = (rng.standard_normal((2, 500)) * 0.1).astype(np.float32)
        for mode in ('none', 'tpdf', 'shaped'):
            q = dither_quantize(x, mode)
            steps = q * 32768.0
            assert np.allclose(steps, np.rint(steps), atol=1e-3), mode

    def test_bad_dither_rejected(self):
        from ComfyTV.runners.audio_dsp import dither_quantize
        with pytest.raises(RuntimeError, match="dither"):
            dither_quantize(np.zeros((2, 4), dtype=np.float32), 'bogus')


class TestMix:
    def test_two_inputs(self, clip, clip_b):
        _classes()["AudioMixStage"].execute(
            project_id="p1", audio_a=clip, audio_b=clip_b,
            gain_a=-6.0, pan_a=-0.5, gain_b=0.0, pan_b=0.5)

    def test_constant_power_with_dither(self, clip, clip_b):
        _classes()["AudioMixStage"].execute(
            project_id="p1", pan_law='constant_power', dither='tpdf',
            audio_a=clip, audio_b=clip_b)

    def test_no_input_rejected(self):
        with pytest.raises(RuntimeError, match="at least one"):
            _classes()["AudioMixStage"].execute(project_id="p1")


class TestSegments:
    def test_audible_segments_array(self):
        from ComfyTV.runners.audio_dsp import audible_segments
        from ComfyTV.runners.media import _AUDIO_RATE
        tone = np.full(int(0.5 * _AUDIO_RATE), 0.3, dtype=np.float32)
        gap = np.zeros(int(0.6 * _AUDIO_RATE), dtype=np.float32)
        arr = np.stack([np.concatenate([tone, gap, tone])] * 2)
        segs = audible_segments(arr, threshold_db=-60.0, min_silence_s=0.1,
                                min_segment_s=0.1)
        assert len(segs) == 2
        assert abs(segs[0]['start'] - 0.0) < 0.05
        assert abs(segs[1]['start'] - 1.1) < 0.05

    def test_short_silence_merges(self):
        from ComfyTV.runners.audio_dsp import audible_segments
        from ComfyTV.runners.media import _AUDIO_RATE
        tone = np.full(int(0.5 * _AUDIO_RATE), 0.3, dtype=np.float32)
        gap = np.zeros(int(0.05 * _AUDIO_RATE), dtype=np.float32)
        arr = np.stack([np.concatenate([tone, gap, tone])] * 2)
        segs = audible_segments(arr, threshold_db=-60.0, min_silence_s=0.2,
                                min_segment_s=0.1)
        assert len(segs) == 1

    def test_export_by_silence(self):
        from ComfyTV.runners.audio_dsp import segment_export
        url, _ = _tone_silence_wav()
        result = segment_export(url, threshold_db=-60.0, min_silence_s=0.2,
                                min_segment_s=0.1, prefix='part')
        assert result['count'] == 2
        assert result['files'][0]['name'] == 'part-01'
        assert result['files'][1]['name'] == 'part-02'

    def test_stage_json_mode(self, clip, monkeypatch):
        import json as _json

        from ComfyTV.nodes.stages import audio_pro
        captured = {}

        def _fake_emit(_cls, *, project_id, payload_str, **kwargs):
            captured['payload'] = payload_str
            return None

        monkeypatch.setattr(audio_pro, '_stage_emit_auto', _fake_emit)
        _classes()["AudioSegmentExportStage"].execute(
            project_id="p1", detect='json',
            segments='[{"start":0.0,"end":0.5},{"start":0.7,"end":1.2}]',
            video=clip)
        data = _json.loads(captured['payload'])
        assert data['count'] == 2

    def test_stage_json_mode_empty_rejected(self, clip):
        with pytest.raises(RuntimeError, match="segments"):
            _classes()["AudioSegmentExportStage"].execute(
                project_id="p1", detect='json', segments='[]', video=clip)


class TestConvolve:
    def test_delta_ir_is_identity(self):
        from ComfyTV.runners.audio_dsp import _write_wav, convolve_ir
        from ComfyTV.runners.media import _AUDIO_RATE, _decode_audio_to_array, localize
        t = np.arange(int(0.3 * _AUDIO_RATE)) / _AUDIO_RATE
        tone = (0.3 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
        src = _write_wav(np.stack([tone, tone]))
        delta = np.zeros(64, dtype=np.float32)
        delta[0] = 1.0
        ir = _write_wav(np.stack([delta, delta]))
        out_url = convolve_ir(src, ir, wet=1.0, dry=0.0, normalize=False)
        out = _decode_audio_to_array(localize(out_url))
        n = tone.shape[0]
        assert np.abs(out[0, :n] - tone).max() < 0.01

    def test_stage_missing_ir_rejected(self, clip):
        with pytest.raises(RuntimeError, match="impulse"):
            _classes()["AudioConvolveStage"].execute(
                project_id="p1", video=clip)


class TestSweepDeconvolve:
    def test_roundtrip_gives_impulse(self, monkeypatch):
        from ComfyTV.runners.audio_dsp import deconvolve_ir, ess_sweep
        from ComfyTV.runners.media import _AUDIO_RATE, _decode_audio_to_array, localize
        sweep_url = ess_sweep(duration_s=1.0, fmin=20.0, fmax=8000.0,
                              amp=0.5, tail_s=0.5)
        ir_url = deconvolve_ir(sweep_url, duration_s=1.0, fmin=20.0,
                               fmax=8000.0, amp=0.5, ir_len_s=0.5)
        ir = _decode_audio_to_array(localize(ir_url))
        assert ir.shape[1] > 0
        peak_idx = int(np.argmax(np.abs(ir[0])))
        assert peak_idx < int(0.01 * _AUDIO_RATE)
        tail_energy = float((ir[0, int(0.1 * _AUDIO_RATE):] ** 2).sum())
        total_energy = float((ir[0] ** 2).sum())
        assert tail_energy / total_energy < 0.05

    def test_sweep_stage(self, monkeypatch):
        from ComfyTV.nodes.stages import audio_pro
        captured = {}

        def _fake_emit(_cls, *, project_id, payload_str, **kwargs):
            captured['payload'] = payload_str
            return None

        monkeypatch.setattr(audio_pro, '_stage_emit_auto', _fake_emit)
        _classes()["AudioSweepStage"].execute(project_id="p1", duration_s=1.0,
                                              tail_s=0.2)
        assert captured['payload']


class TestVisualizePro:
    def _payload(self, monkeypatch, **kw):
        from ComfyTV.nodes.stages import audio_pro
        captured = {}

        def _fake_emit(_cls, *, project_id, payload_str, **kwargs):
            captured['payload'] = payload_str
            return None

        monkeypatch.setattr(audio_pro, '_stage_emit_auto', _fake_emit)
        _classes()["AudioVisualizeStage"].execute(project_id="p1", **kw)
        return captured['payload']

    def test_waveform_pro(self, clip, monkeypatch):
        from ComfyTV.runners.media import localize
        url = self._payload(monkeypatch, mode='waveform_pro', width=600,
                            height=240, video=clip)
        assert Path(localize(url)).stat().st_size > 0

    @pytest.mark.parametrize("scale", ['log', 'linear', 'mel'])
    def test_spectrum_pro_scales(self, clip, monkeypatch, scale):
        from ComfyTV.runners.media import localize
        url = self._payload(monkeypatch, mode='spectrum_pro', width=480,
                            height=240, pro_scale=scale, video=clip)
        assert Path(localize(url)).stat().st_size > 0

    def test_spectrum_pro_gray(self, clip, monkeypatch):
        url = self._payload(monkeypatch, mode='spectrum_pro',
                            pro_colormap='gray', video=clip)
        assert url


class TestRepairHum:
    def test_hum_50hz(self, clip):
        _classes()["AudioRepairStage"].execute(
            project_id="p1", method='hum', hum_freq=50.0, hum_harmonics=8,
            hum_q=8.0, video=clip)

    def test_hum_harmonics_capped_at_nyquist(self, clip):
        _classes()["AudioRepairStage"].execute(
            project_id="p1", method='hum', hum_freq=2000.0, hum_harmonics=16,
            video=clip)


class TestCompliance:
    def test_platform_table(self):
        from ComfyTV.runners.audio_dsp import evaluate_loudness_compliance
        rows = evaluate_loudness_compliance(-14.0, -2.0)
        assert len(rows) == 11
        by_name = {r['name']: r['verdict'] for r in rows}
        assert by_name['Spotify'] == 'ok'
        assert by_name['EBU R128'] == 'over'
        assert by_name['Soundcloud'] == 'quiet'

    def test_true_peak_violation(self):
        from ComfyTV.runners.audio_dsp import evaluate_loudness_compliance
        rows = evaluate_loudness_compliance(-14.0, -0.5)
        by_name = {r['name']: r['verdict'] for r in rows}
        assert by_name['Spotify'] == 'over'

    def test_analyze_includes_platforms(self, clip, monkeypatch):
        import json as _json

        from ComfyTV.nodes.stages import audio_pro
        captured = {}

        def _fake_emit(_cls, *, project_id, payload_str, **kwargs):
            captured['payload'] = payload_str
            return None

        monkeypatch.setattr(audio_pro, '_stage_emit_auto', _fake_emit)
        _classes()["AudioAnalyzeStage"].execute(project_id="p1",
                                                mode='loudness', video=clip)
        data = _json.loads(captured['payload'])
        assert len(data['platforms']) == 11
        assert all(r['verdict'] in ('ok', 'over', 'quiet')
                   for r in data['platforms'])


class TestLoudnessNormalize:
    def test_sample_peak_target(self, clip, monkeypatch):
        from ComfyTV.nodes.stages import audio_fx
        from ComfyTV.runners.media_filter import analyze_audio
        captured = {}

        def _fake_emit(_cls, *, project_id, payload_str, **kwargs):
            captured['payload'] = payload_str
            return None

        monkeypatch.setattr(audio_fx, '_stage_emit_auto', _fake_emit)
        audio_fx.AudioLoudnessStage.execute(
            project_id="p1", mode='normalize', peak_mode='sample',
            peak_target_db=-3.0, video=clip)
        lines = analyze_audio(captured['payload'], [('volumedetect', None)])
        joined = '\n'.join(lines)
        import re as _re
        m = _re.search(r'max_volume:\s+([-\d.]+)', joined)
        assert m and abs(float(m.group(1)) - (-3.0)) < 0.6

    def test_multi_constraint_takes_strictest(self, clip):
        from ComfyTV.nodes.stages.audio_fx import AudioLoudnessStage
        AudioLoudnessStage.execute(
            project_id="p1", mode='normalize', peak_mode='true_peak',
            peak_target_db=-1.0, use_rms=True, rms_target_db=-20.0,
            use_lufs=True, target_i=-16.0, video=clip)


class TestNoInput:
    @pytest.mark.parametrize("cls_name", [
        "AudioEchoStage", "AudioModulationStage", "AudioStereoStage",
        "AudioTimePitchStage", "AudioRepairStage", "AudioSaturateStage",
        "AudioAnalyzeStage", "AudioVisualizeStage",
    ])
    def test_missing_input_rejected(self, cls_name):
        with pytest.raises(RuntimeError, match="upstream"):
            _classes()[cls_name].execute(project_id="p1")
