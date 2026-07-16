from pathlib import Path

import pytest

av = pytest.importorskip("av")
np = pytest.importorskip("numpy")

from test_media_concat import _write_clip  # noqa: E402

ALL_AUDIO_PRO_CLASSES = [
    "AudioEchoStage", "AudioModulationStage", "AudioStereoStage",
    "AudioTimePitchStage", "AudioRepairStage", "AudioSaturateStage",
    "AudioCrossfadeStage", "AudioAnalyzeStage", "AudioVisualizeStage",
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


class TestNoInput:
    @pytest.mark.parametrize("cls_name", [
        "AudioEchoStage", "AudioModulationStage", "AudioStereoStage",
        "AudioTimePitchStage", "AudioRepairStage", "AudioSaturateStage",
        "AudioAnalyzeStage", "AudioVisualizeStage",
    ])
    def test_missing_input_rejected(self, cls_name):
        with pytest.raises(RuntimeError, match="upstream"):
            _classes()[cls_name].execute(project_id="p1")
