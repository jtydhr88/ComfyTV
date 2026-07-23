"""Audio sprint 2: stem split, spectral noise reduction, StaffPad PV, MIR."""
import json
import math

import pytest

av = pytest.importorskip("av")
np = pytest.importorskip("numpy")
torch = pytest.importorskip("torch")

SR = 44100


def _stereo(mono):
    return np.stack([mono, mono]).astype(np.float32)


def _sine(freq, seconds, amp=0.5):
    t = np.arange(int(SR * seconds)) / SR
    return (amp * np.sin(2 * np.pi * freq * t)).astype(np.float32)


def _wav_url(arr):
    from ComfyTV.runners.audio_dsp import _write_wav
    return _write_wav(arr)


def _decode(url):
    from ComfyTV.runners.media import localize, _decode_audio_to_array
    return _decode_audio_to_array(localize(url))


def _classes():
    from ComfyTV.nodes.stages import audio_mir_stages, audio_effects
    import inspect
    out = {}
    for mod in (audio_mir_stages, audio_effects):
        for name, obj in inspect.getmembers(mod):
            if inspect.isclass(obj) and hasattr(obj, "define_schema") \
                    and obj.__module__ == mod.__name__:
                out[name] = obj
    return out


@pytest.mark.parametrize("cls_name", [
    "AudioStemSplitStage", "AudioNoiseReductionStage", "AudioMIRStage",
])
def test_define_schema(cls_name):
    classes = _classes()
    assert cls_name in classes
    classes[cls_name].define_schema()


class TestNoiseReduction:
    def _noisy_tone(self, seconds=2.0, noise_amp=0.05):
        rng = np.random.default_rng(3)
        tone = _sine(440.0, seconds, amp=0.4)
        noise = (noise_amp * rng.standard_normal(tone.shape)) \
            .astype(np.float32)
        return _stereo(tone + noise), _stereo(noise)

    def test_reduces_noise_keeps_tone(self):
        from ComfyTV.runners.noise_reduction import spectral_gate
        mix, noise = self._noisy_tone()
        y = spectral_gate(torch.from_numpy(mix), reduction_db=18.0,
                          noise=torch.from_numpy(noise)).numpy()
        spec_in = np.abs(np.fft.rfft(mix[0]))
        spec_out = np.abs(np.fft.rfft(y[0]))
        freqs = np.fft.rfftfreq(mix.shape[1], 1 / SR)
        tone_band = (freqs > 400) & (freqs < 480)
        noise_band = freqs > 5000
        assert spec_out[tone_band].sum() > 0.6 * spec_in[tone_band].sum()
        assert spec_out[noise_band].sum() < 0.4 * spec_in[noise_band].sum()

    def test_auto_profile_runs(self):
        from ComfyTV.runners.noise_reduction import spectral_gate
        mix, _ = self._noisy_tone()
        y = spectral_gate(torch.from_numpy(mix), reduction_db=12.0)
        assert y.shape == mix.shape

    def test_stage_e2e(self):
        mix, noise = self._noisy_tone(seconds=1.0)
        cls = _classes()["AudioNoiseReductionStage"]
        out = cls.execute(project_id='p1', audio=_wav_url(mix),
                          noise_sample=_wav_url(noise))
        arr = _decode(out.values[0])
        assert arr.shape[1] > SR // 2


class TestStaffPadPV:
    def test_stretch_length(self):
        from ComfyTV.runners.staffpad_pv import time_stretch_pv
        x = _stereo(_sine(220.0, 1.0)).astype(np.float64)
        y = time_stretch_pv(x, 2.0)
        assert abs(y.shape[1] - 2 * x.shape[1]) < SR // 10
        y2 = time_stretch_pv(x, 0.5)
        assert abs(y2.shape[1] - x.shape[1] // 2) < SR // 10

    def test_pitch_shift_octave(self):
        from ComfyTV.runners.staffpad_pv import pitch_shift_pv
        x = _stereo(_sine(220.0, 1.5)).astype(np.float64)
        y = pitch_shift_pv(x, 12.0)
        assert abs(y.shape[1] - x.shape[1]) < SR // 5
        seg = y[0, SR // 4:SR]
        spec = np.abs(np.fft.rfft(seg * np.hanning(seg.size)))
        freqs = np.fft.rfftfreq(seg.size, 1 / SR)
        peak = freqs[int(np.argmax(spec))]
        assert abs(peak - 440.0) < 15.0

    def test_stage_pitch_hq(self):
        x = _stereo(_sine(220.0, 1.0))
        cls = _classes()["AudioTimePitchStage"]
        out = cls.execute(project_id='p1', mode='pitch_hq', semitones=7.0,
                          audio=_wav_url(x))
        arr = _decode(out.values[0])
        assert arr.shape[1] > SR // 2


class TestMIR:
    def _clicks(self, bpm=120.0, seconds=6.0):
        n = int(SR * seconds)
        x = np.zeros(n, dtype=np.float32)
        period = int(SR * 60.0 / bpm)
        for p in range(0, n, period):
            x[p:p + 200] = np.hanning(400)[:200].astype(np.float32) * 0.9
        return _stereo(x)

    def test_onsets_on_click_track(self):
        from ComfyTV.runners.audio_mir import (
            _detection_function, _adaptive_df, onset_times,
        )
        x = self._clicks()
        df = _adaptive_df(_detection_function(x.astype(np.float64)))
        times = onset_times(df, threshold=0.3, min_gap_s=0.1)
        assert 10 <= len(times) <= 14
        gaps = np.diff(times)
        assert abs(float(np.median(gaps)) - 0.5) < 0.05

    def test_beat_track_bpm(self):
        from ComfyTV.runners.audio_mir import (
            _detection_function, _adaptive_df, beat_track,
        )
        x = self._clicks(bpm=120.0)
        df = _adaptive_df(_detection_function(x.astype(np.float64)))
        beats, bpm = beat_track(df)
        assert len(beats) >= 8
        assert abs(bpm - 120.0) < 6.0

    def test_notes_extraction(self):
        from ComfyTV.runners.audio_mir import extract_notes
        x = np.concatenate([_sine(440.0, 0.6), _sine(659.25, 0.6)])
        notes = extract_notes(_stereo(x).astype(np.float64))
        texts = [n['text'] for n in notes]
        assert 'A4' in texts
        assert 'E5' in texts

    def test_stage_beats(self):
        cls = _classes()["AudioMIRStage"]
        out = cls.execute(project_id='p1', mode='beats',
                          audio=_wav_url(self._clicks()))
        keys = json.loads(out.values[0])
        labels = json.loads(out.values[1])
        assert keys and labels
        assert labels[0]['text'].startswith('beat')


class TestStemSplit:
    def test_chunked_overlap_add_identity(self):
        from ComfyTV.runners.stem_split import separate_array

        class FakeModel:
            def __call__(self, seg):
                return seg.unsqueeze(1).repeat(1, 4, 1, 1)

        rng = np.random.default_rng(9)
        mix = torch.from_numpy(
            rng.standard_normal((2, SR * 3)).astype(np.float32) * 0.3)
        out = separate_array(FakeModel(), mix, segment_s=1.0, overlap_s=0.25,
                             sample_rate=SR)
        for s in range(4):
            assert float((out[s] - mix).abs().max()) < 1e-4

    def test_stage_requires_input(self):
        cls = _classes()["AudioStemSplitStage"]
        with pytest.raises(RuntimeError, match="needs an audio"):
            cls.execute(project_id='p1')

    def test_separates_real_model(self):
        import torch.hub
        from pathlib import Path
        hub = Path(torch.hub.get_dir())
        cached = list(hub.rglob('hdemucs*.pt'))
        if not cached:
            pytest.skip("HDemucs weights not downloaded")
        from ComfyTV.runners.stem_split import separate_stems
        x = _stereo(_sine(220.0, 2.0))
        stems = separate_stems(_wav_url(x))
        assert set(stems) == {'vocals', 'drums', 'bass', 'other',
                              'accompaniment'}
        bass = _decode(stems['bass'])
        voc = _decode(stems['vocals'])
        assert np.abs(bass).mean() > np.abs(voc).mean()
