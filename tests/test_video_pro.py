"""Tests for the Lane B pro stack: blend modes vs ofxsMerging.h formulas,
Transform matrices vs Transform.cpp, roto Bezier vs Bezier.cpp, tracker
convergence, title/subtitle rendering, and stage execute() smoke."""
from fractions import Fraction
from pathlib import Path

import pytest

av = pytest.importorskip("av")
np = pytest.importorskip("numpy")
torch = pytest.importorskip("torch")

from test_media_concat import _write_clip  # noqa: E402


# ---------------------------------------------------------------- blend modes

def _rgba(r, g, b, a=1.0):
    return torch.tensor([[[r, g, b, a]]], dtype=torch.float32)


class TestBlendModes:
    def test_over(self):
        from ComfyTV.runners.blend_modes import merge
        A = _rgba(0.5, 0.0, 0.0, 0.5)   # premultiplied red at 50%
        B = _rgba(0.0, 1.0, 0.0, 1.0)
        out = merge(A, B, 'over')
        # A + B(1-a): r=0.5, g=1*(1-0.5)=0.5, alpha=0.5+1*0.5=1
        assert out[0, 0, 0].item() == pytest.approx(0.5)
        assert out[0, 0, 1].item() == pytest.approx(0.5)
        assert out[0, 0, 3].item() == pytest.approx(1.0)

    def test_screen_multiply_exclusion(self):
        from ComfyTV.runners.blend_modes import merge
        A = _rgba(0.25, 0.25, 0.25)
        B = _rgba(0.5, 0.5, 0.5)
        assert merge(A, B, 'screen')[0, 0, 0].item() == pytest.approx(0.25 + 0.5 - 0.125)
        assert merge(A, B, 'multiply')[0, 0, 0].item() == pytest.approx(0.125)
        assert merge(A, B, 'exclusion')[0, 0, 0].item() == pytest.approx(0.25 + 0.5 - 0.25)

    def test_hard_light_branches(self):
        """ofxsMerging.h:840-850: 2A<1 → multiply(2A,B); else screen(2A-1,B)."""
        from ComfyTV.runners.blend_modes import merge
        lo = merge(_rgba(0.2, 0.2, 0.2), _rgba(0.5, 0.5, 0.5), 'hard-light')
        assert lo[0, 0, 0].item() == pytest.approx(0.4 * 0.5)
        hi = merge(_rgba(0.8, 0.8, 0.8), _rgba(0.5, 0.5, 0.5), 'hard-light')
        assert hi[0, 0, 0].item() == pytest.approx(0.6 + 0.5 - 0.3)

    def test_color_dodge_burn(self):
        """dodge = min(1, B/(1-A)); burn = 1 - min(1, (1-B)/A)."""
        from ComfyTV.runners.blend_modes import merge
        d = merge(_rgba(0.5, 0.5, 0.5), _rgba(0.25, 0.25, 0.25), 'color-dodge')
        assert d[0, 0, 0].item() == pytest.approx(0.5)
        bn = merge(_rgba(0.5, 0.5, 0.5), _rgba(0.25, 0.25, 0.25), 'color-burn')
        assert bn[0, 0, 0].item() == pytest.approx(1 - min(1, 0.75 / 0.5))

    def test_hsl_luminosity_preserves_lum(self):
        """luminosity: SetLum(B, Lum(A)) — output luma equals A's luma."""
        from ComfyTV.runners.blend_modes import merge, _lum
        A = _rgba(0.8, 0.8, 0.8)
        B = _rgba(0.9, 0.1, 0.1)
        out = merge(A, B, 'luminosity')
        lum_a = 0.8 * 0.3 + 0.8 * 0.59 + 0.8 * 0.11
        assert _lum(out[..., :3])[0, 0, 0].item() == pytest.approx(lum_a, abs=1e-3)

    def test_operator_count(self):
        from ComfyTV.runners.blend_modes import MERGE_OPERATORS
        assert len(MERGE_OPERATORS) == 39  # 35 separable + 4 HSL


# ----------------------------------------------------------------- transform

class TestTransformMatrix:
    def test_identity(self):
        from ComfyTV.runners.media_torch import mat_transform_canonical
        m = mat_transform_canonical(0, 0, 1, 1, 0, 0, 0, 100, 50)
        assert np.allclose(m, np.eye(3))

    def test_translate(self):
        from ComfyTV.runners.media_torch import mat_transform_canonical
        m = mat_transform_canonical(10, 20, 1, 1, 0, 0, 0, 0, 0)
        p = m @ np.array([1.0, 1.0, 1.0])
        assert p[0] == pytest.approx(11) and p[1] == pytest.approx(21)

    def test_scale_around_center(self):
        from ComfyTV.runners.media_torch import mat_transform_canonical
        m = mat_transform_canonical(0, 0, 2, 2, 0, 0, 0, 100, 100)
        # center stays fixed
        p = m @ np.array([100.0, 100.0, 1.0])
        assert p[0] == pytest.approx(100) and p[1] == pytest.approx(100)
        p2 = m @ np.array([110.0, 100.0, 1.0])
        assert p2[0] == pytest.approx(120)

    def test_homography_identity(self):
        from ComfyTV.runners.media_torch import homography_from_points
        pts = [(0, 0), (100, 0), (100, 50), (0, 50)]
        H = homography_from_points(pts, pts)
        assert np.allclose(H / H[2, 2], np.eye(3), atol=1e-6)

    def test_homography_maps_corners(self):
        from ComfyTV.runners.media_torch import homography_from_points
        src = [(0, 0), (100, 0), (100, 100), (0, 100)]
        dst = [(10, 5), (90, 10), (95, 95), (5, 88)]
        H = homography_from_points(src, dst)
        for (x, y), (u, v) in zip(src, dst):
            p = H @ np.array([x, y, 1.0])
            assert p[0] / p[2] == pytest.approx(u, abs=1e-4)
            assert p[1] / p[2] == pytest.approx(v, abs=1e-4)


# ---------------------------------------------------------------------- roto

class TestRoto:
    def test_bezier_eval_endpoints(self):
        from ComfyTV.runners.roto import bezier_eval
        assert bezier_eval(0.0, 1.0, 2.0, 3.0, 0.0) == 0.0
        assert bezier_eval(0.0, 1.0, 2.0, 3.0, 1.0) == 3.0
        # linear control points → linear curve
        assert bezier_eval(0.0, 1.0, 2.0, 3.0, 0.5) == pytest.approx(1.5)

    def test_rasterize_square(self):
        from ComfyTV.runners.roto import rasterize_mask
        pts = [
            {'x': 20, 'y': 20, 'lx': 20, 'ly': 20, 'rx': 20, 'ry': 20},
            {'x': 80, 'y': 20, 'lx': 80, 'ly': 20, 'rx': 80, 'ry': 20},
            {'x': 80, 'y': 80, 'lx': 80, 'ly': 80, 'rx': 80, 'ry': 80},
            {'x': 20, 'y': 80, 'lx': 20, 'ly': 80, 'rx': 20, 'ry': 80},
        ]
        m = rasterize_mask(pts, 100, 100)
        assert m[50, 50] > 0.99
        assert m[5, 5] < 0.01

    def test_feather_ramps(self):
        from ComfyTV.runners.roto import rasterize_mask
        pts = [
            {'x': 20, 'y': 20, 'lx': 20, 'ly': 20, 'rx': 20, 'ry': 20},
            {'x': 80, 'y': 20, 'lx': 80, 'ly': 20, 'rx': 80, 'ry': 20},
            {'x': 80, 'y': 80, 'lx': 80, 'ly': 80, 'rx': 80, 'ry': 80},
            {'x': 20, 'y': 80, 'lx': 20, 'ly': 80, 'rx': 20, 'ry': 80},
        ]
        m = rasterize_mask(pts, 100, 100, feather_px=20)
        # Natron semantics: shape edge stays opaque, falloff goes OUTWARD
        assert m[50, 22] > 0.95          # just inside the edge: opaque
        assert 0.2 < m[50, 10] < 0.8     # 10px outside: mid-falloff
        assert m[50, 1] < 0.15           # ~19px outside: nearly gone
        assert m[50, 50] > 0.9

    def test_invert(self):
        from ComfyTV.runners.roto import rasterize_mask
        pts = [
            {'x': 20, 'y': 20, 'lx': 20, 'ly': 20, 'rx': 20, 'ry': 20},
            {'x': 80, 'y': 20, 'lx': 80, 'ly': 20, 'rx': 80, 'ry': 20},
            {'x': 50, 'y': 80, 'lx': 50, 'ly': 80, 'rx': 50, 'ry': 80},
        ]
        m = rasterize_mask(pts, 100, 100, invert=True)
        assert m[5, 5] > 0.99


# -------------------------------------------------------------------- tracker

def _write_moving_dot(path: Path, n=20):
    """White dot moving +2px/frame on x, on a black background."""
    with av.open(str(path), 'w') as out:
        v = out.add_stream('libx264', rate=24)
        v.width, v.height = 160, 120
        v.pix_fmt = 'yuv420p'
        v.options = {'qp': '0'}
        for i in range(n):
            arr = np.zeros((120, 160, 3), dtype=np.uint8)
            cx, cy = 30 + i * 2, 60
            arr[cy - 4:cy + 4, cx - 4:cx + 4] = 255
            f = av.VideoFrame.from_ndarray(arr, format='rgb24').reformat(format='yuv420p')
            f.pts = i
            f.time_base = Fraction(1, 24)
            for pkt in v.encode(f):
                out.mux(pkt)
        for pkt in v.encode():
            out.mux(pkt)


class TestTracker:
    def test_tracks_moving_dot(self):
        import json
        import folder_paths
        from ComfyTV.runners import media
        from ComfyTV.runners.tracker import track_point
        src_dir = Path(folder_paths.get_output_directory()) / 'track-src'
        src_dir.mkdir(parents=True, exist_ok=True)
        p = src_dir / 'dot.mp4'
        if not p.exists():
            _write_moving_dot(p)
        track = json.loads(track_point(media.path_to_view_url(p), 30, 60,
                                       pattern_half=8, search_radius=12))
        xs = track['x']
        assert len(xs) > 10
        # dot moves +2 px/frame → final x ≈ 30 + 2*(n-1); allow tolerance
        assert xs[-1]['v'] > xs[0]['v'] + 20
        assert abs(track['y'][-1]['v'] - 60) < 6


# ---------------------------------------------------------------- text/subs

class TestText:
    def test_render_text(self):
        from ComfyTV.runners.text_overlay import render_text_rgba
        arr = render_text_rgba('Hello 世界', size=32)
        assert arr.ndim == 3 and arr.shape[2] == 4
        assert arr[..., 3].max() > 200  # something was drawn

    def test_parse_srt(self):
        from ComfyTV.runners.text_overlay import parse_subtitles
        srt = """1
00:00:00,500 --> 00:00:02,000
Hello there

2
00:00:03,000 --> 00:00:04,500
Second <i>line</i>
continues"""
        cues = parse_subtitles(srt)
        assert len(cues) == 2
        assert cues[0]['start'] == pytest.approx(0.5)
        assert cues[1]['text'] == 'Second line\ncontinues'

    def test_parse_vtt(self):
        from ComfyTV.runners.text_overlay import parse_subtitles
        vtt = """WEBVTT

00:01.000 --> 00:02.500
VTT cue"""
        cues = parse_subtitles(vtt)
        assert len(cues) == 1
        assert cues[0]['start'] == pytest.approx(1.0)
        assert cues[0]['end'] == pytest.approx(2.5)


# ------------------------------------------------------------ execute smoke

@pytest.fixture()
def clip():
    import folder_paths
    from ComfyTV.runners import media
    src_dir = Path(folder_paths.get_output_directory()) / 'pro-src'
    src_dir.mkdir(parents=True, exist_ok=True)
    p = src_dir / 'pro_clip.mp4'
    if not p.exists():
        _write_clip(p, w=160, h=120, fps=12, seconds=1.0, with_audio=True)
    return media.path_to_view_url(p)


def _cls(name):
    from ComfyTV.nodes.stages import video_pro
    return getattr(video_pro, name)


class TestExecute:
    def test_transform(self, clip):
        _cls('VideoTransformStage').execute(
            project_id='p1', pos_x=10, rotation=15, video=clip)

    def test_transform_keyframed(self, clip):
        _cls('VideoTransformStage').execute(
            project_id='p1',
            keyframes='[{"t":0,"x":0,"y":0,"scale":1,"rotation":0},'
                      '{"t":1,"x":40,"y":0,"scale":1.2,"rotation":90}]',
            video=clip)

    def test_composite(self, clip):
        _cls('VideoCompositeStage').execute(
            project_id='p1', operator='screen', scale=0.5,
            background=clip, foreground=clip)

    def test_corner_pin(self, clip):
        _cls('CornerPinStage').execute(
            project_id='p1',
            corners='[[10,10],[150,5],[155,110],[5,115]]', video=clip)

    def test_roto(self, clip):
        _cls('RotoMaskStage').execute(
            project_id='p1', feather=10,
            shape_keys='[{"t":0,"points":['
                       '{"x":40,"y":30,"lx":40,"ly":30,"rx":40,"ry":30},'
                       '{"x":120,"y":30,"lx":120,"ly":30,"rx":120,"ry":30},'
                       '{"x":80,"y":100,"lx":80,"ly":100,"rx":80,"ry":100}]}]',
            video=clip)

    def test_title(self, clip):
        _cls('TitleStage').execute(
            project_id='p1', text='Test 标题', size=24, fade_s=0.2, video=clip)

    def test_subtitles(self, clip):
        _cls('SubtitleStage').execute(
            project_id='p1',
            subs='1\n00:00:00,100 --> 00:00:00,800\nhi there\n', video=clip)

    def test_schemas(self):
        for name in ('VideoCompositeStage', 'VideoTransformStage',
                     'CornerPinStage', 'RotoMaskStage', 'MotionTrackStage',
                     'TitleStage', 'SubtitleStage'):
            _cls(name).define_schema()
