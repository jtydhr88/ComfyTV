"""Regression tests for the Natron-alignment pass (review B-level items):
Curve.cpp rules, screen-direction semantics, Merge mix semantics, and
tracker confidence."""
from fractions import Fraction
from pathlib import Path

import pytest

av = pytest.importorskip("av")
np = pytest.importorskip("numpy")


class TestCurveRules:
    """The three hand-computed counterexamples from the review."""

    def test_example_a_neighbor_derivatives(self):
        """linear key next to an inner smooth key consumes its derivative:
        value(1.5) = 2.59375 (was 2.5 with zeroed neighbor derivs)."""
        from ComfyTV.runners.keyframes import KeyframeCurve
        c = KeyframeCurve([
            {'t': 0, 'v': 0, 'interp': 'smooth'},
            {'t': 1, 'v': 2, 'interp': 'smooth'},
            {'t': 2, 'v': 3, 'interp': 'linear'},
            {'t': 3, 'v': 3, 'interp': 'smooth'},
        ])
        assert c.value(1.5) == pytest.approx(2.59375, abs=1e-6)

    def test_example_b_edge_promotion(self):
        """First/last keys count as Linear for the middle key's tangents
        (Curve.cpp:1589-1592): tangents ±1, so value(0.5) = hermite with
        left deriv 1 — the curve enters k1 on the straight line."""
        from ComfyTV.runners.keyframes import KeyframeCurve
        c = KeyframeCurve([
            {'t': 0, 'v': 0, 'interp': 'smooth'},
            {'t': 1, 'v': 1, 'interp': 'linear'},
            {'t': 2, 'v': 0, 'interp': 'smooth'},
        ])
        left, right = c._derivs(1)
        assert left == pytest.approx(1.0)
        assert right == pytest.approx(-1.0)

    def test_example_c_linear_extrapolation(self):
        """Edge catmull-rom key: Natron extrapolates linearly with the edge
        derivative — v(-1) = -1, ∫[-1,0] = -0.5."""
        from ComfyTV.runners.keyframes import KeyframeCurve
        c = KeyframeCurve([
            {'t': 0, 'v': 0, 'interp': 'catmull-rom'},
            {'t': 1, 'v': 1, 'interp': 'catmull-rom'},
        ])
        assert c.value(-1) == pytest.approx(-1.0)
        assert c.integrate(-1, 0) == pytest.approx(-0.5)
        assert c.value(2) == pytest.approx(2.0)

    def test_constant_extrapolation_option(self):
        from ComfyTV.runners.keyframes import KeyframeCurve
        c = KeyframeCurve([
            {'t': 0, 'v': 0, 'interp': 'catmull-rom'},
            {'t': 1, 'v': 1, 'interp': 'catmull-rom'},
        ], extrapolate='constant')
        assert c.value(-1) == 0.0
        assert c.value(5) == 1.0

    def test_speed_curve_stays_clamped(self):
        """media_remap must NOT extrapolate speed linearly (could go ≤ 0)."""
        from ComfyTV.runners.media_remap import _speed_curve
        c = _speed_curve([{'t': 0, 'v': 1.0, 'interp': 'linear'},
                          {'t': 1, 'v': 2.0, 'interp': 'linear'}])
        # ∫0..1 (1+t) dt + ∫1..3 2 dt = 1.5 + 4 = 5.5
        assert c.integrate(0, 3) == pytest.approx(5.5, abs=0.01)
        assert c.value(100) == pytest.approx(2.0)


def _write_dot_clip(path: Path, dot_xy, w=160, h=120, n=8):
    with av.open(str(path), 'w') as out:
        v = out.add_stream('libx264', rate=12)
        v.width, v.height = w, h
        v.pix_fmt = 'yuv420p'
        arr = np.zeros((h, w, 3), dtype=np.uint8)
        x, y = dot_xy
        arr[y - 4:y + 4, x - 4:x + 4] = 255
        for i in range(n):
            f = av.VideoFrame.from_ndarray(arr, format='rgb24').reformat(format='yuv420p')
            f.pts = i
            f.time_base = Fraction(1, 12)
            for pkt in v.encode(f):
                out.mux(pkt)
        for pkt in v.encode():
            out.mux(pkt)


def _bright_centroid(url):
    from ComfyTV.runners import media
    src = media.localize(url)
    with av.open(str(src)) as c:
        frames = [f.to_ndarray(format='gray') for f in c.decode(c.streams.video[0])]
    g = frames[len(frames) // 2].astype(np.float32)
    ys, xs = np.nonzero(g > 128)
    assert len(xs), "no bright pixels found"
    return float(xs.mean()), float(ys.mean())


class TestScreenDirections:
    def test_translate_y_positive_moves_up(self):
        import folder_paths
        from ComfyTV.runners import media
        from ComfyTV.runners.media_torch import transform_video
        d = Path(folder_paths.get_output_directory()) / 'natron-src'
        d.mkdir(parents=True, exist_ok=True)
        p = d / 'dot_center.mp4'
        if not p.exists():
            _write_dot_clip(p, (80, 60))
        out = transform_video(media.path_to_view_url(p), translate_y=20.0)
        x, y = _bright_centroid(out)
        assert y == pytest.approx(40, abs=3)   # 60 - 20 → moved UP
        assert x == pytest.approx(80, abs=3)

    def test_rotation_positive_is_ccw(self):
        """+90°: a dot right of center must end ABOVE the center (CCW)."""
        import folder_paths
        from ComfyTV.runners import media
        from ComfyTV.runners.media_torch import transform_video
        d = Path(folder_paths.get_output_directory()) / 'natron-src'
        d.mkdir(parents=True, exist_ok=True)
        p = d / 'dot_right.mp4'
        if not p.exists():
            _write_dot_clip(p, (110, 60))   # 30px right of center
        out = transform_video(media.path_to_view_url(p), rotation_deg=90.0)
        x, y = _bright_centroid(out)
        assert x == pytest.approx(80, abs=3)
        assert y == pytest.approx(30, abs=3)   # 60 - 30 → above center


class TestMergeMixSemantics:
    def _solid(self, path: Path, w, h, val):
        with av.open(str(path), 'w') as out:
            v = out.add_stream('libx264', rate=12)
            v.width, v.height = w, h
            v.pix_fmt = 'yuv420p'
            arr = np.full((h, w, 3), val, dtype=np.uint8)
            for i in range(8):
                f = av.VideoFrame.from_ndarray(arr, format='rgb24').reformat(format='yuv420p')
                f.pts = i
                f.time_base = Fraction(1, 12)
                for pkt in v.encode(f):
                    out.mux(pkt)
            for pkt in v.encode():
                out.mux(pkt)

    def test_multiply_with_half_opacity_lerps(self):
        """Natron mix: out = lerp(B, multiply(A,B), 0.5).
        gray-0.5 fg × white bg = 0.5; lerp(1.0, 0.5, 0.5) = 0.75 (~191).
        The old premultiplied-attenuation gave ~0.25 (~64)."""
        import folder_paths
        from ComfyTV.runners import media
        from ComfyTV.runners.media_torch import composite_videos
        d = Path(folder_paths.get_output_directory()) / 'natron-src'
        d.mkdir(parents=True, exist_ok=True)
        bg_p, fg_p = d / 'white.mp4', d / 'gray.mp4'
        if not bg_p.exists():
            self._solid(bg_p, 160, 120, 255)
        if not fg_p.exists():
            self._solid(fg_p, 160, 120, 128)
        out = composite_videos(media.path_to_view_url(bg_p),
                               media.path_to_view_url(fg_p),
                               operator='multiply', opacity=0.5)
        src = media.localize(out)
        with av.open(str(src)) as c:
            frames = [f.to_ndarray(format='rgb24')
                      for f in c.decode(c.streams.video[0])]
        mid = frames[len(frames) // 2]
        assert mid[60, 80].mean() == pytest.approx(191, abs=12)


class TestTrackerConfidence:
    def test_confidence_reported_and_blank_holds(self):
        """A featureless black clip yields near-zero confidence and the
        track HOLDS its position instead of wandering."""
        import json
        import folder_paths
        from ComfyTV.runners import media
        from ComfyTV.runners.tracker import track_point
        d = Path(folder_paths.get_output_directory()) / 'natron-src'
        d.mkdir(parents=True, exist_ok=True)
        p = d / 'blank.mp4'
        if not p.exists():
            with av.open(str(p), 'w') as out:
                v = out.add_stream('libx264', rate=12)
                v.width, v.height = 160, 120
                v.pix_fmt = 'yuv420p'
                arr = np.zeros((120, 160, 3), dtype=np.uint8)
                for i in range(10):
                    f = av.VideoFrame.from_ndarray(arr, format='rgb24').reformat(format='yuv420p')
                    f.pts = i
                    f.time_base = Fraction(1, 12)
                    for pkt in v.encode(f):
                        out.mux(pkt)
                for pkt in v.encode():
                    out.mux(pkt)
        track = json.loads(track_point(media.path_to_view_url(p), 80, 60,
                                       pattern_half=8, search_radius=12))
        assert 'confidence' in track
        # position held at the origin the whole way
        assert all(abs(k['v'] - 80) < 1e-6 for k in track['x'])
        assert all(abs(k['v'] - 60) < 1e-6 for k in track['y'])
        assert all(k['v'] < 0.5 for k in track['confidence'][1:])

    def test_good_track_high_confidence(self):
        import json
        import folder_paths
        from ComfyTV.runners import media
        from ComfyTV.runners.tracker import track_point
        from test_video_pro import _write_moving_dot
        d = Path(folder_paths.get_output_directory()) / 'natron-src'
        d.mkdir(parents=True, exist_ok=True)
        p = d / 'dot_move.mp4'
        if not p.exists():
            _write_moving_dot(p)
        track = json.loads(track_point(media.path_to_view_url(p), 30, 60,
                                       pattern_half=8, search_radius=12))
        # still tracks (confidence gate must not block a clean feature)
        assert track['x'][-1]['v'] > track['x'][0]['v'] + 20
        assert sum(k['v'] for k in track['confidence'][1:]) / \
            max(1, len(track['confidence']) - 1) > 0.5


class TestTrackYNegation:
    def test_track_offsets_flip_y(self):
        from ComfyTV.nodes.stages.video_pro import _track_to_keyframes
        import json
        track = json.dumps({
            'origin': [100, 50],
            'x': [{'t': 0, 'v': 100}, {'t': 1, 'v': 110}],
            'y': [{'t': 0, 'v': 50}, {'t': 1, 'v': 70}],  # moved DOWN 20px
        })
        keys = _track_to_keyframes(track, [])
        assert keys[1]['x'] == pytest.approx(10)
        # +20px down on screen → -20 in Natron (+y up) coordinates
        assert keys[1]['y'] == pytest.approx(-20)
