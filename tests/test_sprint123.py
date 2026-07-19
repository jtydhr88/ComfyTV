"""Tests for the sprint-1/2/3 backends: multi-point track solving, UV remap,
pitch-preserved speed, clone time offset, mask propagation, hue correct,
glow/god-rays, pattern generator."""
import json
import math
from fractions import Fraction
from pathlib import Path

import pytest

av = pytest.importorskip("av")
np = pytest.importorskip("numpy")
torch = pytest.importorskip("torch")

from test_media_concat import _write_clip  # noqa: E402


class TestTrackSolve:
    def test_translation(self):
        from ComfyTV.runners.track_solve import solve_translation
        x1 = [[0, 0], [10, 0], [0, 10]]
        x2 = [[5, 3], [15, 3], [5, 13]]
        m = solve_translation(x1, x2)
        assert m['tx'] == pytest.approx(5) and m['ty'] == pytest.approx(3)

    def test_similarity_umeyama(self):
        from ComfyTV.runners.track_solve import solve_similarity
        theta = 0.3
        s = 1.5
        R = np.array([[math.cos(theta), -math.sin(theta)],
                      [math.sin(theta), math.cos(theta)]])
        x1 = np.array([[0, 0], [10, 0], [0, 10], [10, 10]], dtype=float)
        x2 = x1 @ (s * R).T + np.array([4, -2])
        m = solve_similarity(x1, x2)
        assert m['scale'] == pytest.approx(s, abs=1e-6)
        assert m['rotation'] == pytest.approx(theta, abs=1e-6)
        assert m['tx'] == pytest.approx(4, abs=1e-6)
        assert m['ty'] == pytest.approx(-2, abs=1e-6)

    def test_similarity_reflection_guard(self):
        from ComfyTV.runners.track_solve import solve_similarity
        x1 = np.array([[0, 0], [10, 0], [0, 10]], dtype=float)
        x2 = np.array([[0, 0], [10, 0.1], [0.1, 10]], dtype=float)
        m = solve_similarity(x1, x2)
        assert m['scale'] > 0

    def test_robust_rejects_outlier(self):
        from ComfyTV.runners.track_solve import solve_robust
        x1 = [[0, 0], [10, 0], [0, 10], [10, 10], [5, 5], [2, 8]]
        x2 = [[1, 2], [11, 2], [1, 12], [11, 12], [6, 7], [300, -300]]
        m = solve_robust(np.array(x1) * 1.0, np.array(x2) * 1.0, 'translation')
        assert m['tx'] == pytest.approx(1, abs=0.2)
        assert m['ty'] == pytest.approx(2, abs=0.2)

    def test_homography_exact(self):
        from ComfyTV.runners.track_solve import solve_homography, _apply_model
        src = np.array([[0, 0], [100, 0], [100, 100], [0, 100]], dtype=float)
        dst = np.array([[10, 5], [90, 10], [95, 95], [5, 88]], dtype=float)
        H = solve_homography(src, dst)
        back = _apply_model(H, src)
        assert np.allclose(back, dst, atol=1e-4)

    def test_track_transforms_output(self):
        from ComfyTV.runners.track_solve import solve_track_transforms
        tracks = []
        for px, py in [(20, 20), (80, 20), (20, 80), (80, 80)]:
            tracks.append({
                'x': [{'t': 0.0, 'v': px}, {'t': 1.0, 'v': px + 10}],
                'y': [{'t': 0.0, 'v': py}, {'t': 1.0, 'v': py + 4}],
                'confidence': [{'t': 0.0, 'v': 1.0}, {'t': 1.0, 'v': 1.0}],
            })
        out = solve_track_transforms(tracks, 'similarity', w=100, h=100)
        assert out[0]['x'] == pytest.approx(0, abs=0.01)
        assert out[1]['x'] == pytest.approx(10, abs=0.1)
        assert out[1]['y'] == pytest.approx(4, abs=0.1)
        assert out[1]['scale'] == pytest.approx(1.0, abs=0.01)


def _write_two_dots(path: Path, n=16):
    with av.open(str(path), 'w') as out:
        v = out.add_stream('libx264', rate=12)
        v.width, v.height = 160, 120
        v.pix_fmt = 'yuv420p'
        for i in range(n):
            arr = np.zeros((120, 160, 3), dtype=np.uint8)
            x = 30 + i * 2
            arr[56 - 16:64 - 16, x - 4:x + 4] = 255
            arr[56 + 16:64 + 16, x - 4:x + 4] = (255, 0, 0)
            f = av.VideoFrame.from_ndarray(arr, format='rgb24').reformat(format='yuv420p')
            f.pts = i
            f.time_base = Fraction(1, 12)
            for pkt in v.encode(f):
                out.mux(pkt)
        for pkt in v.encode():
            out.mux(pkt)


class TestMultiTrack:
    def test_two_points_and_solve(self):
        import folder_paths
        from ComfyTV.runners import media
        from ComfyTV.nodes.stages.video_masking import MotionTrackStage
        d = Path(folder_paths.get_output_directory()) / 's123-src'
        d.mkdir(parents=True, exist_ok=True)
        p = d / 'dots.mp4'
        if not p.exists():
            _write_two_dots(p)
        url = media.path_to_view_url(p)
        MotionTrackStage.execute(
            project_id='p1', points='[{"x":30,"y":44},{"x":30,"y":76}]',
            solve='translation', pattern=8, search=12, video=url)

    def test_solve_needs_enough_points(self):
        from ComfyTV.runners.track_solve import solve_track_transforms
        tracks = [{'x': [{'t': 0, 'v': 1}], 'y': [{'t': 0, 'v': 1}],
                   'confidence': [{'t': 0, 'v': 1.0}]}]
        with pytest.raises(ValueError, match="at least"):
            solve_track_transforms(tracks, 'perspective', w=100, h=100)


@pytest.fixture()
def clip():
    import folder_paths
    from ComfyTV.runners import media
    d = Path(folder_paths.get_output_directory()) / 's123-src'
    d.mkdir(parents=True, exist_ok=True)
    p = d / 'clip.mp4'
    if not p.exists():
        _write_clip(p, w=96, h=96, fps=12, seconds=0.8, with_audio=True)
    return media.path_to_view_url(p)


class TestUVRemap:
    def _identity_stmap(self, w=96, h=96):
        import folder_paths
        from PIL import Image
        from ComfyTV.runners import media
        d = Path(folder_paths.get_output_directory()) / 's123-src'
        d.mkdir(parents=True, exist_ok=True)
        p = d / 'identity_uv.png'
        if not p.exists():
            xs = np.linspace(0, 255, w).astype(np.uint8)
            ys = np.linspace(255, 0, h).astype(np.uint8)
            arr = np.zeros((h, w, 3), dtype=np.uint8)
            arr[..., 0] = xs[None, :]
            arr[..., 1] = ys[:, None]
            Image.fromarray(arr).save(p)
        return media.path_to_view_url(p)

    def test_stmap_identity_roundtrip(self, clip):
        from ComfyTV.runners import media
        from ComfyTV.runners.uvmap import uv_remap_video
        out = uv_remap_video(clip, self._identity_stmap(), mode='stmap')
        info = media.get_video_info(out)
        assert (info['width'], info['height']) == (96, 96)

    def test_idistort_neutral(self, clip):
        import folder_paths
        from PIL import Image
        from ComfyTV.runners import media
        from ComfyTV.runners.uvmap import uv_remap_video
        d = Path(folder_paths.get_output_directory()) / 's123-src'
        p = d / 'neutral_uv.png'
        if not p.exists():
            arr = np.full((96, 96, 3), 128, dtype=np.uint8)
            Image.fromarray(arr).save(p)
        out = uv_remap_video(clip, media.path_to_view_url(p),
                             mode='idistort', amount=20)
        assert out.startswith('/view?')

    def test_bad_mode(self, clip):
        from ComfyTV.runners.uvmap import uv_remap_video
        with pytest.raises(RuntimeError, match="unknown mode"):
            uv_remap_video(clip, self._identity_stmap(), mode='warp')


class TestPitchPreserve:
    def test_atempo_specs(self):
        from ComfyTV.runners.media_filter import atempo_specs
        for factor in (0.25, 0.5, 1.0, 2.0, 4.0, 7.3):
            specs = atempo_specs(factor)
            prod = 1.0
            for _, args in specs:
                v = float(args)
                assert 0.5 - 1e-9 <= v <= 2.0 + 1e-9
                prod *= v
            assert prod == pytest.approx(factor, rel=1e-4)

    def test_process_audio_array_tempo(self):
        from ComfyTV.runners.media_filter import process_audio_array, atempo_specs
        t = np.arange(44100, dtype=np.float32) / 44100
        tone = np.stack([np.sin(2 * np.pi * 440 * t)] * 2) * 0.3
        out = process_audio_array(tone, atempo_specs(2.0))
        assert out.shape[1] == pytest.approx(22050, rel=0.05)

    def test_speed_video_pitch(self, clip):
        from ComfyTV.runners import media
        out = media.speed_video(clip, 2.0, pitch_compensate=True)
        info = media.get_video_info(out)
        assert 0.3 <= info['duration'] <= 0.6
        assert info['has_audio'] is True


class TestCloneTimeOffset:
    def test_absolute_source(self, clip):
        from ComfyTV.runners.paint import paint_video
        paint_video(clip, [{
            'mode': 'clone', 'radius': 10, 'time_absolute': 0.1,
            'points': [{'x': 48, 'y': 48}],
        }])

    def test_negative_relative(self, clip):
        from ComfyTV.runners.paint import paint_video
        paint_video(clip, [{
            'mode': 'clone', 'radius': 10, 'time_offset': -0.3,
            'points': [{'x': 48, 'y': 48}],
        }])

    def test_positive_relative_rejected(self, clip):
        from ComfyTV.runners.paint import paint_video
        with pytest.raises(RuntimeError, match="positive clone"):
            paint_video(clip, [{
                'mode': 'clone', 'radius': 10, 'time_offset': 0.3,
                'points': [{'x': 48, 'y': 48}],
            }])


def _write_textured_square(path: Path, n=14):
    rng = np.random.default_rng(11)
    tex = rng.integers(60, 255, (40, 40, 3), dtype=np.uint8)
    with av.open(str(path), 'w') as out:
        v = out.add_stream('libx264', rate=12)
        v.width, v.height = 160, 120
        v.pix_fmt = 'yuv420p'
        for i in range(n):
            arr = np.zeros((120, 160, 3), dtype=np.uint8)
            x = 20 + i * 3
            arr[40:80, x:x + 40] = tex
            f = av.VideoFrame.from_ndarray(arr, format='rgb24').reformat(format='yuv420p')
            f.pts = i
            f.time_base = Fraction(1, 12)
            for pkt in v.encode(f):
                out.mux(pkt)
        for pkt in v.encode():
            out.mux(pkt)


class TestMaskPropagate:
    def test_follows_moving_square(self):
        import folder_paths
        from PIL import Image
        from ComfyTV.runners import media
        from ComfyTV.runners.mask_propagate import propagate_mask_video
        d = Path(folder_paths.get_output_directory()) / 's123-src'
        d.mkdir(parents=True, exist_ok=True)
        p = d / 'movsq.mp4'
        if not p.exists():
            _write_textured_square(p)
        mp = d / 'movsq_mask.png'
        if not mp.exists():
            m = np.zeros((120, 160), dtype=np.uint8)
            m[40:80, 20:60] = 255
            Image.fromarray(m).save(mp)
        out = propagate_mask_video(media.path_to_view_url(p),
                                   media.path_to_view_url(mp),
                                   model='translation', max_points=12)
        src = media.localize(out)
        frames = []
        with av.open(str(src)) as c:
            for f in c.decode(c.streams.video[0]):
                frames.append(f.to_ndarray(format='gray'))
        last = frames[-1].astype(np.float32)
        moved = 20 + (len(frames)) * 3
        assert last[60, min(159, moved + 20)] > 150
        assert last[60, 25] < 80

    def test_needs_mask(self, clip):
        from ComfyTV.nodes.stages.video_masking import MaskPropagateStage
        with pytest.raises(RuntimeError, match="mask image"):
            MaskPropagateStage.execute(project_id='p1', video=clip)


class TestHueCorrect:
    def test_desaturate_band(self):
        import folder_paths
        from ComfyTV.runners import media
        from ComfyTV.runners.video_color_ops import hue_correct_video
        d = Path(folder_paths.get_output_directory()) / 's123-src'
        d.mkdir(parents=True, exist_ok=True)
        p = d / 'redgreen.mp4'
        if not p.exists():
            with av.open(str(p), 'w') as out:
                v = out.add_stream('libx264', rate=12)
                v.width, v.height = 96, 96
                v.pix_fmt = 'yuv420p'
                arr = np.zeros((96, 96, 3), dtype=np.uint8)
                arr[:, :48] = (200, 30, 30)
                arr[:, 48:] = (30, 200, 30)
                for i in range(6):
                    f = av.VideoFrame.from_ndarray(arr, format='rgb24').reformat(format='yuv420p')
                    f.pts = i
                    f.time_base = Fraction(1, 12)
                    for pkt in v.encode(f):
                        out.mux(pkt)
                for pkt in v.encode():
                    out.mux(pkt)
        url = media.path_to_view_url(p)
        curves = json.dumps({'sat': [[0.0, 1.0], [0.08, 1.0], [1 / 6, 0.0],
                                     [0.28, 1.0], [1.0, 1.0]]})
        out = hue_correct_video(url, curves)
        src = media.localize(out)
        with av.open(str(src)) as c:
            frames = [f.to_ndarray(format='rgb24')
                      for f in c.decode(c.streams.video[0])]
        mid = frames[len(frames) // 2].astype(np.float32)
        red_px = mid[48, 20]
        green_px = mid[48, 76]
        assert abs(red_px[0] - red_px[1]) < 30
        assert green_px[1] - green_px[0] > 80

    def test_no_curves_rejected(self, clip):
        from ComfyTV.runners.video_color_ops import hue_correct_video
        with pytest.raises(RuntimeError, match="no curves"):
            hue_correct_video(clip, "")


class TestGlowGodRaysPattern:
    def test_glow(self, clip):
        from ComfyTV.runners.video_stylize_ops import glow_video
        glow_video(clip, threshold=0.5, size=3, bloom_count=3)

    def test_god_rays(self, clip):
        from ComfyTV.runners.video_stylize_ops import god_rays_video
        god_rays_video(clip, scale=1.5, steps=3, decay=0.4)

    @pytest.mark.parametrize("kind", ['ramp', 'radial', 'rectangle', 'noise'])
    def test_patterns(self, kind):
        from ComfyTV.runners import media
        from ComfyTV.runners.patterns import generate_pattern_video
        out = generate_pattern_video(kind, width=96, height=96, fps=12,
                                     duration=0.5)
        info = media.get_video_info(out)
        assert (info['width'], info['height']) == (96, 96)

    def test_pattern_bad_kind(self):
        from ComfyTV.runners.patterns import generate_pattern_video
        with pytest.raises(RuntimeError, match="unknown kind"):
            generate_pattern_video('plasma3d')


class TestNewStageDefs:
    ALL = ['STMapStage', 'MaskPropagateStage', 'SubtitleGenStage',
           'HueCorrectStage', 'GlowStage', 'GodRaysStage', 'PatternStage']

    @pytest.mark.parametrize("name", ALL)
    def test_schema(self, name):
        from ComfyTV.nodes import stages
        getattr(stages, name).define_schema()

    def test_meta(self):
        from ComfyTV.nodes.stages.common.meta import STAGE_META
        for name in self.ALL:
            assert name in STAGE_META
