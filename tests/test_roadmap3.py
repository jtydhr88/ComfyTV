"""Backend tests for the roadmap-3 sprints: keying suite, temporal ops,
color/quality infra, generators, and audio-reactive modulation."""
import json
import math
from fractions import Fraction
from pathlib import Path

import pytest

av = pytest.importorskip("av")
np = pytest.importorskip("numpy")
torch = pytest.importorskip("torch")

from test_media_concat import _write_clip  # noqa: E402


def _src_dir():
    import folder_paths
    d = Path(folder_paths.get_output_directory()) / 'r3-src'
    d.mkdir(parents=True, exist_ok=True)
    return d


def _write_frames(path, frames, fps=12):
    with av.open(str(path), 'w') as out:
        v = out.add_stream('libx264', rate=fps)
        v.height, v.width = frames[0].shape[0], frames[0].shape[1]
        v.pix_fmt = 'yuv420p'
        v.options = {'qp': '0'}
        for i, arr in enumerate(frames):
            f = av.VideoFrame.from_ndarray(arr, format='rgb24').reformat(
                format='yuv420p')
            f.pts = i
            f.time_base = Fraction(1, fps)
            for pkt in v.encode(f):
                out.mux(pkt)
        for pkt in v.encode():
            out.mux(pkt)


def _decode_all(url):
    from ComfyTV.runners import media
    with av.open(str(media.localize(url))) as c:
        return [f.to_ndarray(format='rgb24').astype(np.float32)
                for f in c.decode(c.streams.video[0])]


def _greenscreen_clip():
    d = _src_dir()
    p = d / 'green.mp4'
    if not p.exists():
        arr = np.zeros((96, 96, 3), dtype=np.uint8)
        arr[:, :] = (20, 220, 30)
        arr[30:70, 30:70] = (200, 60, 60)
        _write_frames(p, [arr] * 6)
    return p


def _plate_png():
    from PIL import Image
    d = _src_dir()
    p = d / 'plate.png'
    if not p.exists():
        arr = np.zeros((96, 96, 3), dtype=np.uint8)
        arr[:, :] = (20, 220, 30)
        Image.fromarray(arr).save(p)
    return p


class TestDespill:
    def test_green_spill_removed(self):
        from ComfyTV.runners import media
        from ComfyTV.runners.keying import despill_video
        out = despill_video(media.path_to_view_url(_greenscreen_clip()))
        frames = _decode_all(out)
        mid = frames[len(frames) // 2]
        screen = mid[5:25, 5:25]
        assert screen[..., 1].mean() < 120

    def test_subject_untouched(self):
        from ComfyTV.runners import media
        from ComfyTV.runners.keying import despill_video
        out = despill_video(media.path_to_view_url(_greenscreen_clip()))
        frames = _decode_all(out)
        mid = frames[len(frames) // 2]
        subject = mid[40:60, 40:60]
        assert subject[..., 0].mean() > 150


class TestColorSuppress:
    def test_green_suppress(self):
        from ComfyTV.runners import media
        from ComfyTV.runners.keying import color_suppress_video
        out = color_suppress_video(
            media.path_to_view_url(_greenscreen_clip()), green=1.0)
        mid = _decode_all(out)[0]
        screen = mid[5:25, 5:25]
        assert abs(screen[..., 1].mean() - max(
            screen[..., 0].mean(), screen[..., 2].mean())) < 25

    def test_matte_output(self):
        from ComfyTV.runners import media
        from ComfyTV.runners.keying import color_suppress_video
        out = color_suppress_video(
            media.path_to_view_url(_greenscreen_clip()), green=1.0,
            output='matte')
        mid = _decode_all(out)[0]
        assert mid[5:25, 5:25].mean() > mid[40:60, 40:60].mean() + 40


class TestKeyerLuma:
    def test_bright_keyed_out(self):
        from ComfyTV.runners import media
        from ComfyTV.runners.keying import keyer_video
        d = _src_dir()
        p = d / 'bw.mp4'
        if not p.exists():
            arr = np.zeros((96, 96, 3), dtype=np.uint8)
            arr[:, 48:] = 255
            _write_frames(p, [arr] * 6)
        out = keyer_video(media.path_to_view_url(p), mode='luminance',
                          output='matte')
        mid = _decode_all(out)[0]
        assert mid[40:60, 60:90].mean() < 40
        assert mid[40:60, 5:40].mean() > 215


class TestPik:
    def test_matte_from_plate(self):
        from ComfyTV.runners import media
        from ComfyTV.runners.keying import pik_video
        out = pik_video(media.path_to_view_url(_greenscreen_clip()),
                        clean_plate_url=media.path_to_view_url(_plate_png()),
                        output='matte')
        mid = _decode_all(out)[0]
        assert mid[40:60, 40:60].mean() > 200
        assert mid[5:25, 5:25].mean() < 40

    def test_pick_mode_no_plate(self):
        from ComfyTV.runners import media
        from ComfyTV.runners.keying import pik_video
        out = pik_video(media.path_to_view_url(_greenscreen_clip()),
                        screen='pick', pick_color='#14DC1E',
                        output='matte')
        mid = _decode_all(out)[0]
        assert mid[40:60, 40:60].mean() > 180
        assert mid[5:25, 5:25].mean() < 60


class TestKeyMixMatteMorph:
    def test_keymix_mask_blend(self):
        from PIL import Image
        from ComfyTV.runners import media
        from ComfyTV.runners.keying import keymix_videos
        d = _src_dir()
        a = d / 'solid_a.mp4'
        b = d / 'solid_b.mp4'
        m = d / 'halfmask.png'
        if not a.exists():
            _write_frames(a, [np.full((96, 96, 3), 220, dtype=np.uint8)] * 6)
        if not b.exists():
            _write_frames(b, [np.full((96, 96, 3), 30, dtype=np.uint8)] * 6)
        if not m.exists():
            mask = np.zeros((96, 96), dtype=np.uint8)
            mask[:, 48:] = 255
            Image.fromarray(mask).save(m)
        out = keymix_videos(media.path_to_view_url(a),
                            media.path_to_view_url(b),
                            media.path_to_view_url(m))
        mid = _decode_all(out)[0]
        assert mid[:, 60:].mean() > 180
        assert mid[:, :36].mean() < 70

    def test_matte_monitor_stretch(self):
        from ComfyTV.runners import media
        from ComfyTV.runners.keying import matte_monitor_video
        d = _src_dir()
        p = d / 'gray30.mp4'
        if not p.exists():
            _write_frames(p, [np.full((96, 96, 3), 77, dtype=np.uint8)] * 4)
        out = matte_monitor_video(media.path_to_view_url(p), slope=0.5)
        mid = _decode_all(out)[0]
        assert abs(mid.mean() - 102) < 10

    def test_erode_shrinks_dilate_grows(self):
        from ComfyTV.runners import media
        from ComfyTV.runners.keying import morphology_video
        d = _src_dir()
        p = d / 'sq_matte.mp4'
        if not p.exists():
            arr = np.zeros((96, 96, 3), dtype=np.uint8)
            arr[38:58, 38:58] = 255
            _write_frames(p, [arr] * 4)
        er = _decode_all(morphology_video(media.path_to_view_url(p),
                                          op='erode', size_x=4, size_y=4))[0]
        di = _decode_all(morphology_video(media.path_to_view_url(p),
                                          op='dilate', size_x=4, size_y=4))[0]
        base = _decode_all(media.path_to_view_url(p))[0]
        thr = 128
        assert (er[..., 0] > thr).sum() < (base[..., 0] > thr).sum()
        assert (di[..., 0] > thr).sum() > (base[..., 0] > thr).sum()


class TestTemporal:
    def test_frame_blend_average(self):
        from ComfyTV.runners import media
        from ComfyTV.runners.temporal import frame_blend_video
        d = _src_dir()
        p = d / 'flicker.mp4'
        if not p.exists():
            frames = [np.full((96, 96, 3), 255 if i % 2 else 0,
                              dtype=np.uint8) for i in range(12)]
            _write_frames(p, frames)
        out = frame_blend_video(media.path_to_view_url(p), frame_min=-1,
                                frame_max=0, operation='average')
        frames = _decode_all(out)
        mid = frames[len(frames) // 2]
        assert 90 < mid.mean() < 165

    def test_frame_blend_max(self):
        from ComfyTV.runners import media
        from ComfyTV.runners.temporal import frame_blend_video
        d = _src_dir()
        p = d / 'flicker.mp4'
        out = frame_blend_video(media.path_to_view_url(p), frame_min=-1,
                                frame_max=0, operation='max')
        frames = _decode_all(out)
        mid = frames[len(frames) // 2]
        assert mid.mean() > 215

    def test_time_blur_runs(self):
        from ComfyTV.runners import media
        from ComfyTV.runners.temporal import time_blur_video
        d = _src_dir()
        p = d / 'flicker.mp4'
        out = time_blur_video(media.path_to_view_url(p), shutter=2.0,
                              divisions=4)
        frames = _decode_all(out)
        assert len(frames) >= 10
        assert 40 < frames[len(frames) // 2].mean() < 215

    def test_frame_hold_constant(self):
        from ComfyTV.runners import media
        from ComfyTV.runners.media_remap import frame_hold
        d = _src_dir()
        p = d / 'clipav.mp4'
        if not p.exists():
            _write_clip(p, w=96, h=96, fps=12, seconds=1.0, with_audio=False)
        out = frame_hold(media.path_to_view_url(p), first_frame=3)
        frames = _decode_all(out)
        assert len(frames) >= 10
        assert np.abs(frames[0] - frames[-1]).mean() < 3


class TestShutterSamples:
    def test_natron_sample_count(self):
        from ComfyTV.runners.media_torch import shutter_samples
        ts = shutter_samples(1.0, 1.0, 10.0, 'centered', 0.0, 10.0)
        assert len(ts) == 11
        assert ts[0] == pytest.approx(0.5)
        assert ts[-1] == pytest.approx(1.5)

    def test_shutter_types(self):
        from ComfyTV.runners.media_torch import shutter_samples
        start = shutter_samples(2.0, 0.5, 12.0, 'start', 0.0, 12.0)
        end = shutter_samples(2.0, 0.5, 12.0, 'end', 0.0, 12.0)
        custom = shutter_samples(2.0, 0.5, 12.0, 'custom', -6.0, 12.0)
        assert start[0] == pytest.approx(2.0)
        assert end[-1] == pytest.approx(2.0)
        assert custom[0] == pytest.approx(1.5)

    def test_off_when_zero(self):
        from ComfyTV.runners.media_torch import shutter_samples
        assert shutter_samples(3.0, 0.0, 10.0, 'centered', 0.0, 24.0) == [3.0]


class TestDither:
    def test_matches_scalar_reference(self):
        from ComfyTV.runners.media_torch import dither_to_byte
        torch.manual_seed(3)
        t = torch.rand(5, 23, 3)
        starts = torch.tensor([0, 7, 22, 11, 3])
        out = dither_to_byte(t, starts=starts).numpy()
        v16 = (t.clamp(0, 1) * 65280.0).round().long().numpy()
        ref = np.zeros_like(v16)
        for y in range(5):
            for c in range(3):
                err = 0x80
                for x in range(int(starts[y]), 23):
                    err = (err & 0xff) + v16[y, x, c]
                    ref[y, x, c] = err >> 8
                err = 0x80
                for x in range(int(starts[y]) - 1, -1, -1):
                    err = (err & 0xff) + v16[y, x, c]
                    ref[y, x, c] = err >> 8
        assert (out == ref).all()

    def test_close_to_round(self):
        from ComfyTV.runners.media_torch import dither_to_byte
        g = torch.linspace(0, 1, 512).view(1, 512, 1).expand(4, 512, 3)
        d = dither_to_byte(g).float()
        plain = (g * 255).round()
        assert (d - plain).abs().mean() < 0.5


class TestPeriodicCurve:
    def test_wraps(self):
        from ComfyTV.runners.keyframes import KeyframeCurve
        c = KeyframeCurve([
            {'t': 0.0, 'v': 0.0, 'interp': 'linear'},
            {'t': 1.0, 'v': 1.0, 'interp': 'linear'},
            {'t': 2.0, 'v': 0.0, 'interp': 'linear'},
        ], periodic=True)
        assert c.value(2.5) == pytest.approx(c.value(0.5))
        assert c.value(-1.5) == pytest.approx(c.value(0.5))

    def test_off_by_default(self):
        from ComfyTV.runners.keyframes import KeyframeCurve
        keys = [
            {'t': 0.0, 'v': 0.0, 'interp': 'linear'},
            {'t': 1.0, 'v': 1.0, 'interp': 'linear'},
            {'t': 2.0, 'v': 0.0, 'interp': 'linear'},
        ]
        plain = KeyframeCurve(keys)
        wrapped = KeyframeCurve(keys, periodic=True)
        assert wrapped.value(2.5) == pytest.approx(0.5)
        assert plain.value(2.5) != pytest.approx(wrapped.value(2.5))


class TestPatterns:
    def test_checkerboard(self):
        from ComfyTV.runners.patterns import generate_pattern_video
        out = generate_pattern_video('checkerboard', width=128, height=128,
                                     fps=6, duration=0.5, box_size=32)
        mid = _decode_all(out)[0]
        assert mid[10, 10].mean() < 60
        assert mid[10, 40].mean() > 190

    def test_colorbars_white_bar(self):
        from ComfyTV.runners.patterns import generate_pattern_video
        out = generate_pattern_video('colorbars', width=192, height=108,
                                     fps=6, duration=0.5)
        mid = _decode_all(out)[0]
        x = int(300 / 1920 * 192)
        v = mid[10, x]
        assert abs(float(v[0]) - 180) < 14
        yellow = mid[10, int(500 / 1920 * 192)]
        assert yellow[0] > 140 and yellow[1] > 140 and yellow[2] < 60

    def test_colorwheel(self):
        from ComfyTV.runners.patterns import generate_pattern_video
        out = generate_pattern_video('colorwheel', width=128, height=128,
                                     fps=6, duration=0.5)
        mid = _decode_all(out)[0]
        assert mid[64, 64].mean() > 200
        assert mid[2, 2].mean() < 40

    def test_count_board(self):
        from ComfyTV.runners.patterns import generate_pattern_video
        out = generate_pattern_video('count', width=128, height=128,
                                     fps=12, duration=2.0)
        frames = _decode_all(out)
        assert len(frames) >= 20
        assert np.abs(frames[0] - frames[13]).mean() > 1.0

    def test_ken_burns(self):
        from PIL import Image
        from ComfyTV.runners import media
        from ComfyTV.runners.patterns import ken_burns_video
        d = _src_dir()
        p = d / 'kb.png'
        if not p.exists():
            arr = np.zeros((256, 256, 3), dtype=np.uint8)
            arr[:128, :] = (200, 40, 40)
            arr[128:, :] = (40, 40, 200)
            Image.fromarray(arr).save(p)
        out = ken_burns_video(media.path_to_view_url(p), width=128,
                              height=128, fps=8, duration=1.0,
                              start_zoom=1.0, end_zoom=2.0)
        frames = _decode_all(out)
        assert frames[0].shape == (128, 128, 3)
        assert len(frames) >= 7


class TestRetro:
    def test_old_film_changes_frames(self):
        from ComfyTV.runners import media
        from ComfyTV.runners.retro import old_film_video
        d = _src_dir()
        p = d / 'clipav.mp4'
        if not p.exists():
            _write_clip(p, w=96, h=96, fps=12, seconds=1.0, with_audio=False)
        out = old_film_video(media.path_to_view_url(p), delta=10, every=100,
                             brightness_every=100)
        a = _decode_all(media.path_to_view_url(p))
        b = _decode_all(out)
        diffs = [np.abs(x - y).mean() for x, y in zip(a, b)]
        assert max(diffs) > 2.0

    def test_luma_wipe_split(self):
        from PIL import Image
        from ComfyTV.runners import media
        from ComfyTV.runners.retro import luma_wipe_videos
        d = _src_dir()
        a = d / 'solid_a.mp4'
        b = d / 'solid_b.mp4'
        lm = d / 'ramp_luma.png'
        if not a.exists():
            _write_frames(a, [np.full((96, 96, 3), 220, dtype=np.uint8)] * 6)
        if not b.exists():
            _write_frames(b, [np.full((96, 96, 3), 30, dtype=np.uint8)] * 6)
        if not lm.exists():
            ramp = np.tile(np.linspace(0, 255, 96).astype(np.uint8), (96, 1))
            Image.fromarray(ramp).save(lm)
        out = luma_wipe_videos(media.path_to_view_url(a),
                               media.path_to_view_url(b),
                               media.path_to_view_url(lm),
                               duration=0.5, softness=0.05)
        frames = _decode_all(out)
        mid = frames[len(frames) // 2]
        assert mid[:, :20].mean() != pytest.approx(mid[:, 76:].mean(), abs=30)


class TestReviewFixes:
    def test_oldfilm_shift_direction(self):
        from ComfyTV.runners import media
        from ComfyTV.runners.retro import old_film_video, _CRand
        d = _src_dir()
        p = d / 'topwhite.mp4'
        if not p.exists():
            arr = np.zeros((96, 96, 3), dtype=np.uint8)
            arr[:48] = 255
            _write_frames(p, [arr] * 8)
        out = old_film_video(media.path_to_view_url(p), delta=30, every=100,
                             brightness_up=0, brightness_down=0,
                             brightness_every=0, develop_up=0,
                             develop_down=0, develop_duration=0,
                             lines_num=0)
        frames = _decode_all(out)
        info = media.get_video_info(media.path_to_view_url(p))
        dur = max(1e-6, float(info['duration']))
        fps = info['fps'] or 24
        checked = 0
        for i, f in enumerate(frames):
            pos = min(1.0, max(0.0, (i / fps) / dur))
            rng = _CRand(int(pos * 10000))
            diffpic = rng.next() % 30 * 2 - 30
            if rng.next() % 100 > 100:
                diffpic = 0
            if abs(diffpic) < 6:
                continue
            checked += 1
            if diffpic > 0:
                assert f[-diffpic + 2:].mean() < 30
                assert f[2, :].mean() > 200
            else:
                assert f[:-diffpic - 2].mean() < 30
        assert checked > 0

    def test_scratch_lines_drift_not_teleport(self):
        from ComfyTV.runners import media
        from ComfyTV.runners.retro import old_film_video
        d = _src_dir()
        p = d / 'gray128.mp4'
        if not p.exists():
            _write_frames(p, [np.full((96, 96, 3), 128, dtype=np.uint8)] * 10)
        out = old_film_video(media.path_to_view_url(p), delta=0, every=0,
                             brightness_up=0, brightness_down=0,
                             brightness_every=0, develop_up=0,
                             develop_down=0, develop_duration=0,
                             lines_num=1, line_width=24,
                             lines_darker=100, lines_lighter=100)
        frames = _decode_all(out)
        centers = []
        for f in frames:
            dev = np.abs(f - 128.0).max(axis=2).max(axis=0)
            if dev.max() < 15:
                centers.append(None)
                continue
            centers.append(int(dev.argmax()))
        prev = None
        for c in centers:
            if c is None:
                continue
            if prev is not None:
                assert abs(c - prev) <= 14
            prev = c
        assert prev is not None

    def test_frame_blend_interval_alignment(self):
        from ComfyTV.runners import media
        from ComfyTV.runners.temporal import frame_blend_video
        d = _src_dir()
        p = d / 'flicker.mp4'
        out = frame_blend_video(media.path_to_view_url(p), frame_min=-5,
                                frame_max=0, interval=4,
                                operation='average')
        frames = _decode_all(out)
        mid = frames[len(frames) // 2]
        assert mid.mean() < 40 or mid.mean() > 215

    def test_colorbars_superblack_clamped(self):
        from ComfyTV.runners.patterns import _colorbars_rgb
        bars = _colorbars_rgb(192, 108, 75.0)
        row = bars[100]
        sb = row[int(1160 / 1920 * 192)]
        blk = row[int(1100 / 1920 * 192)]
        assert np.abs(sb - blk).max() < 1e-6
        assert abs(float(sb[0]) - 16.0 / 255.0) < 1e-6


class TestTitleUpgrades:
    def test_tokens(self):
        from ComfyTV.runners.text_overlay import _resolve_tokens
        assert _resolve_tokens('#frame#', 2.0, 12) == '24'
        assert _resolve_tokens('#timecode#', 61.5, 24) == '00:01:01:12'
        assert _resolve_tokens('t #shorttimecode#', 61.0, 24) == 't 01:01'

    def test_typewriter_slices(self):
        from ComfyTV.runners.text_overlay import _typewriter_slice
        assert _typewriter_slice('abc', 0.05, 0.0, 'char', 0.1) == ''
        assert _typewriter_slice('abc', 0.25, 0.0, 'char', 0.1) == 'ab'
        assert _typewriter_slice('one two', 0.35, 0.0, 'word', 0.1) == 'one two'
        assert _typewriter_slice('a\nb', 0.15, 0.0, 'line', 0.1) == 'a'


class TestAudioReactive:
    def _burst_wav(self):
        d = _src_dir()
        p = d / 'burst.wav'
        if not p.exists():
            sr = 22050
            t = np.arange(sr * 2, dtype=np.float32) / sr
            wave = 0.6 * np.sin(2 * np.pi * 100 * t)
            env = ((t % 1.0) < 0.5).astype(np.float32)
            samples = (wave * env).astype(np.float32)
            with av.open(str(p), 'w') as out:
                s = out.add_stream('pcm_f32le', rate=sr)
                s.layout = 'mono'
                frame = av.AudioFrame.from_ndarray(
                    samples.reshape(1, -1), format='fltp', layout='mono')
                frame.sample_rate = sr
                frame.pts = 0
                for pkt in s.encode(frame):
                    out.mux(pkt)
                for pkt in s.encode():
                    out.mux(pkt)
        return p

    def test_envelope_follows_bursts(self):
        from ComfyTV.runners import media
        from ComfyTV.runners.audio_react import band_envelope
        env, dt = band_envelope(media.path_to_view_url(self._burst_wav()),
                                band='bass')
        on = env[int(0.25 / dt)]
        off = env[int(0.9 / dt)]
        assert on > off + 0.3

    def test_keyframes_json(self):
        from ComfyTV.runners import media
        from ComfyTV.runners.audio_react import audio_reactive_keyframes
        raw = audio_reactive_keyframes(
            media.path_to_view_url(self._burst_wav()), band='bass',
            rate=8.0, min_value=1.0, max_value=2.0, field='scale')
        keys = json.loads(raw)
        assert len(keys) > 10
        assert all('scale' in k and 't' in k for k in keys)
        vals = [k['scale'] for k in keys]
        assert max(vals) > 1.4
        assert min(vals) >= 1.0

    def test_meter_overlay(self):
        from ComfyTV.runners import media
        from ComfyTV.runners.audio_react import meter_overlay_video
        d = _src_dir()
        p = d / 'clip_audio.mp4'
        if not p.exists():
            _write_clip(p, w=128, h=96, fps=12, seconds=1.0, with_audio=True)
        out = meter_overlay_video(media.path_to_view_url(p))
        info = media.get_video_info(out)
        assert info['has_audio'] is True
        assert info['width'] == 128
