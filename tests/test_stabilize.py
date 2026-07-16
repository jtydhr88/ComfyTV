"""Tests for the vid.stab port — unit checks against the ported formulas
plus an end-to-end run on a synthetically shaken checkerboard."""
import math
from fractions import Fraction
from pathlib import Path

import pytest

av = pytest.importorskip("av")
np = pytest.importorskip("numpy")
torch = pytest.importorskip("torch")


class TestPieces:
    def test_cleanmean_drops_outliers(self):
        from ComfyTV.runners.stabilize import _cleanmean
        vals = [1.0] * 8 + [100.0, -100.0]
        assert _cleanmean(vals) == pytest.approx(1.0)

    def test_field_grid(self):
        from ComfyTV.runners.stabilize import _init_fields
        fields, size, shift = _init_fields(640, 480, 6)
        # minDim=480 → fieldSize = max(16, 48) = 48, maxShift = max(16, 68)
        assert size == 48
        assert shift == 68
        assert len(fields) >= 9

    def test_pure_translation(self):
        from ComfyTV.runners.stabilize import _motions_to_transform
        motions = [(x, y, 3.0, -2.0) for x in (100, 300, 500)
                   for y in (100, 300, 500)]
        tx, ty, al = _motions_to_transform(motions, 640, 480, 48)
        assert tx == pytest.approx(3.0, abs=0.01)
        assert ty == pytest.approx(-2.0, abs=0.01)
        assert abs(al) < 1e-6

    def test_pure_rotation(self):
        """Fields displaced tangentially by a small rotation θ around the
        centroid → recovered α ≈ -θ (vsCalcAngle sign convention)."""
        from ComfyTV.runners.stabilize import _motions_to_transform
        theta = 0.02
        cx, cy = 320, 240
        motions = []
        for fx in (80, 320, 560):
            for fy in (60, 240, 420):
                rx, ry = fx - cx, fy - cy
                nx = rx * math.cos(theta) - ry * math.sin(theta)
                ny = rx * math.sin(theta) + ry * math.cos(theta)
                motions.append((fx, fy, nx - rx, ny - ry))
        _, _, al = _motions_to_transform(motions, 640, 480, 48)
        assert al == pytest.approx(-theta, abs=0.005)

    def test_gaussian_smooth_flattens(self):
        from ComfyTV.runners.stabilize import _gaussian_smooth
        jitter = [[math.sin(i), 0.0, 0.0] for i in range(60)]
        sm = _gaussian_smooth(jitter, 10)
        # smoothed path has far less oscillation energy
        raw_e = sum(p[0] ** 2 for p in jitter[15:45])
        sm_e = sum(p[0] ** 2 for p in sm[15:45])
        assert sm_e < raw_e * 0.2

    def test_comp_matrix_identity(self):
        from ComfyTV.runners.stabilize import _comp_matrix
        m = _comp_matrix(0.0, 0.0, 0.0, 0.0, 160, 120)
        assert np.allclose(m, np.eye(3))

    def test_required_zoom(self):
        from ComfyTV.runners.stabilize import _required_zoom
        # transformtype.c:309-313: 100·(2·max(|x|/W,|y|/H) + |sin α|)
        z = _required_zoom(32, 0, 0.0, 640, 480)
        assert z == pytest.approx(100 * 2 * 32 / 640)


def _write_shaky_checker(path: Path, n=36, w=320, h=240):
    """Textured background translated by sinusoidal jitter. The texture is
    smoothed random blobs — aperiodic, so block matching has a unique
    minimum (a checkerboard would alias at the cell period)."""
    rng = np.random.default_rng(42)
    noise = rng.random((h * 2 // 8, w * 2 // 8))
    from PIL import Image
    board = np.asarray(
        Image.fromarray((noise * 255).astype(np.uint8)).resize(
            (w * 2, h * 2), Image.BICUBIC), dtype=np.uint8)
    with av.open(str(path), 'w') as out:
        v = out.add_stream('libx264', rate=24)
        v.width, v.height = w, h
        v.pix_fmt = 'yuv420p'
        for i in range(n):
            jx = int(round(10 * math.sin(i * 1.1)))
            jy = int(round(8 * math.cos(i * 1.7)))
            x0 = w // 2 + jx
            y0 = h // 2 + jy
            crop = board[y0:y0 + h, x0:x0 + w]
            arr = np.repeat(crop[..., None], 3, axis=2)
            f = av.VideoFrame.from_ndarray(
                np.ascontiguousarray(arr), format='rgb24').reformat(format='yuv420p')
            f.pts = i
            f.time_base = Fraction(1, 24)
            for pkt in v.encode(f):
                out.mux(pkt)
        for pkt in v.encode():
            out.mux(pkt)


def _mean_frame_diff(url):
    from ComfyTV.runners import media
    src = media.localize(url)
    diffs = []
    prev = None
    with av.open(str(src)) as c:
        for frame in c.decode(c.streams.video[0]):
            g = frame.to_ndarray(format='gray').astype(np.float32)
            if prev is not None:
                # ignore borders that stabilization may blank
                diffs.append(np.abs(g[30:-30, 40:-40] - prev[30:-30, 40:-40]).mean())
            prev = g
    return float(np.mean(diffs))


class TestEndToEnd:
    def test_stabilizes_synthetic_shake(self):
        import folder_paths
        from ComfyTV.runners import media
        from ComfyTV.runners.stabilize import stabilize_video
        d = Path(folder_paths.get_output_directory()) / 'stab-src'
        d.mkdir(parents=True, exist_ok=True)
        p = d / 'shaky.mp4'
        if not p.exists():
            _write_shaky_checker(p)
        url = media.path_to_view_url(p)
        out = stabilize_video(url, smoothing=12)
        info = media.get_video_info(out)
        assert 1.2 <= info['duration'] <= 1.8
        # compensated result must be dramatically steadier
        assert _mean_frame_diff(out) < _mean_frame_diff(url) * 0.5
