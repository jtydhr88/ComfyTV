"""Regression tests for the cross-reference review A-level fixes
(research/video-pro-review.md). Each test pins one verified counterexample."""
import math
from fractions import Fraction
from pathlib import Path

import pytest

av = pytest.importorskip("av")
np = pytest.importorskip("numpy")
torch = pytest.importorskip("torch")

from test_media_concat import _write_clip  # noqa: E402


class TestA1ClipColor:
    def test_pixman_sequential_branches(self):
        """clip_color's x>a branch must read the n<0 branch's output.
        Counterexample verified against a direct pixman port:
        c=(-0.5, 0, 2), a=1 → (0.0363, 0.0659, 0.1842)."""
        from ComfyTV.runners.blend_modes import _clip_color
        out = _clip_color(torch.tensor([[[-0.5, 0.0, 2.0]]]),
                          torch.tensor([[[1.0]]]))[0, 0]
        assert out[0].item() == pytest.approx(0.0363, abs=1e-3)
        assert out[1].item() == pytest.approx(0.0659, abs=1e-3)
        assert out[2].item() == pytest.approx(0.1842, abs=1e-3)
        # sequential double-clip guarantees the result lands in [0, a]
        assert (out >= -1e-6).all() and (out <= 1.0 + 1e-6).all()

    def test_hsl_merge_no_negative_output(self):
        from ComfyTV.runners.blend_modes import merge
        A = torch.tensor([[[1.0, 0.0, 0.0, 1.0]]])   # saturated red
        B = torch.tensor([[[0.02, 0.02, 0.9, 1.0]]])  # bright blue
        for op in ('hue', 'color', 'saturation', 'luminosity'):
            out = merge(A, B, op)
            assert (out[..., :3] >= -1e-5).all(), op


class TestA2MatteAlpha:
    def test_matte_alpha_is_union(self):
        """ofxsMerging.h:1528 forces alpha masking (union) for matte."""
        from ComfyTV.runners.blend_modes import merge
        A = torch.tensor([[[0.3, 0.3, 0.3, 0.5]]])
        B = torch.tensor([[[0.1, 0.1, 0.1, 0.2]]])
        out = merge(A, B, 'matte')
        assert out[0, 0, 3].item() == pytest.approx(0.5 + 0.2 - 0.1)


class TestA3A8CompositeGeometry:
    def _solid_clip(self, path: Path, w, h, rgb, seconds=0.6):
        with av.open(str(path), 'w') as out:
            v = out.add_stream('libx264', rate=12)
            v.width, v.height = w, h
            v.pix_fmt = 'yuv420p'
            n = int(seconds * 12)
            arr = np.full((h, w, 3), rgb, dtype=np.uint8)
            for i in range(n):
                f = av.VideoFrame.from_ndarray(arr, format='rgb24').reformat(format='yuv420p')
                f.pts = i
                f.time_base = Fraction(1, 12)
                for pkt in v.encode(f):
                    out.mux(pkt)
            for pkt in v.encode():
                out.mux(pkt)

    def _mid_frame(self, url):
        from ComfyTV.runners import media
        src = media.localize(url)
        frames = []
        with av.open(str(src)) as c:
            for f in c.decode(c.streams.video[0]):
                frames.append(f.to_ndarray(format='rgb24'))
        return frames[len(frames) // 2]

    def test_small_fg_centers_on_bg(self):
        """pos=0 must align fg center to bg center (the card UI contract)."""
        import folder_paths
        from ComfyTV.runners import media
        from ComfyTV.runners.media_torch import composite_videos
        d = Path(folder_paths.get_output_directory()) / 'fix-src'
        d.mkdir(parents=True, exist_ok=True)
        bg_p, fg_p = d / 'bg_black.mp4', d / 'fg_white_small.mp4'
        if not bg_p.exists():
            self._solid_clip(bg_p, 160, 120, (0, 0, 0))
        if not fg_p.exists():
            self._solid_clip(fg_p, 64, 48, (255, 255, 255))
        out = composite_videos(media.path_to_view_url(bg_p),
                               media.path_to_view_url(fg_p))
        mid = self._mid_frame(out)
        assert mid[60, 80].mean() > 200      # bg center covered by fg
        assert mid[10, 10].mean() < 40       # bg corner untouched
        assert mid[60, 20].mean() < 40       # left of the centered fg

    def test_large_fg_not_precropped(self):
        """fg larger than bg, scaled down, must show ALL of the fg — the old
        code cropped it to bg size before warping and lost the right half."""
        import folder_paths
        from ComfyTV.runners import media
        from ComfyTV.runners.media_torch import composite_videos
        d = Path(folder_paths.get_output_directory()) / 'fix-src'
        d.mkdir(parents=True, exist_ok=True)
        bg_p = d / 'bg_black2.mp4'
        fg_p = d / 'fg_bicolor_big.mp4'
        if not bg_p.exists():
            self._solid_clip(bg_p, 160, 120, (0, 0, 0))
        if not fg_p.exists():
            # 320x240 fg: left half red, right half green
            with av.open(str(fg_p), 'w') as outc:
                v = outc.add_stream('libx264', rate=12)
                v.width, v.height = 320, 240
                v.pix_fmt = 'yuv420p'
                arr = np.zeros((240, 320, 3), dtype=np.uint8)
                arr[:, :160] = (255, 0, 0)
                arr[:, 160:] = (0, 255, 0)
                for i in range(8):
                    f = av.VideoFrame.from_ndarray(arr, format='rgb24').reformat(format='yuv420p')
                    f.pts = i
                    f.time_base = Fraction(1, 12)
                    for pkt in v.encode(f):
                        outc.mux(pkt)
                for pkt in v.encode():
                    outc.mux(pkt)
        out = composite_videos(media.path_to_view_url(bg_p),
                               media.path_to_view_url(fg_p), scale=0.5)
        mid = self._mid_frame(out)
        # 320x240 at scale .5 → 160x120 exactly covering the bg:
        # left half red AND right half green must both be present
        assert mid[60, 40, 0] > 150 and mid[60, 40, 1] < 100   # red at left
        assert mid[60, 120, 1] > 150 and mid[60, 120, 0] < 100  # green at right


class TestA4AngleRange:
    def test_outlier_pairs_dont_zero_rotation(self):
        """Two wild angle outliers per side must be trimmed by the range
        check (retained-range endpoints), not zero the whole rotation."""
        from ComfyTV.runners.stabilize import _motions_to_transform
        theta = 0.03
        cx, cy = 320, 240
        motions = []
        for fx, fy in [(80, 60), (560, 60), (80, 420), (560, 420),
                       (320, 60), (320, 420)]:
            rx, ry = fx - cx, fy - cy
            nx = rx * math.cos(theta) - ry * math.sin(theta)
            ny = rx * math.sin(theta) + ry * math.cos(theta)
            motions.append((fx, fy, nx - rx, ny - ry))
        # 4 garbage fields: two implying huge +angle, two huge -angle
        motions += [(80, 240, 0.0, 300.0), (560, 240, 0.0, 300.0),
                    (80, 300, 0.0, -300.0), (560, 300, 0.0, -300.0)]
        _, _, alpha = _motions_to_transform(motions, 640, 480, 48)
        assert alpha != 0.0
        assert alpha == pytest.approx(-theta, abs=0.02)


@pytest.fixture()
def clip():
    import folder_paths
    from ComfyTV.runners import media
    d = Path(folder_paths.get_output_directory()) / 'fix-src'
    d.mkdir(parents=True, exist_ok=True)
    p = d / 'plain.mp4'
    if not p.exists():
        _write_clip(p, w=160, h=120, fps=12, seconds=1.0, with_audio=True)
    return media.path_to_view_url(p)


class TestA5A6A7FilterParams:
    def test_estdif_mode_enum(self, clip):
        """estdif uses frame/field, not send_frame/send_field — used to
        raise EINVAL at graph init."""
        from ComfyTV.nodes.stages.video_enhance import VideoDeinterlaceStage
        VideoDeinterlaceStage.execute(project_id='p1', method='estdif',
                                      rate='field', video=clip)

    def test_deshake_rx_snapped_to_16(self, clip):
        """rx=24 used to raise AVERROR_PATCHWELCOME; it must snap to 32."""
        from ComfyTV.nodes.stages.video_enhance import VideoStabilizeStage
        VideoStabilizeStage.execute(project_id='p1', range_x=24, range_y=24,
                                    video=clip)

    def test_alimiter_attack_release_clamped(self, clip):
        """attack below 0.1 ms / release below 1 ms used to fail init."""
        from ComfyTV.nodes.stages.audio_process import AudioDynamicsStage
        AudioDynamicsStage.execute(project_id='p1', mode='limiter',
                                   threshold_db=-3.0, attack_ms=0.01,
                                   release_ms=0.5, video=clip)
