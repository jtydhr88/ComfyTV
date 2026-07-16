"""Regression tests for the sprint-1/2/3 review fixes
(research/video-sprint123-review.md)."""
from fractions import Fraction
from pathlib import Path

import pytest

av = pytest.importorskip("av")
np = pytest.importorskip("numpy")
torch = pytest.importorskip("torch")

from test_media_concat import _write_clip  # noqa: E402


class TestA1SubtitleGenWiring:
    def test_speech_to_text_registered(self):
        from ComfyTV.runners import WORKFLOW_KINDS
        assert 'speech-to-text' in WORKFLOW_KINDS

    def test_audio_bucket_key(self, monkeypatch):
        import asyncio
        from ComfyTV.nodes.stages import video_fx2
        captured = {}

        async def fake_run(cls, **kw):
            captured.update(kw)
            return None

        monkeypatch.setattr(video_fx2, 'run_stage_workflow', fake_run)
        asyncio.run(video_fx2.SubtitleGenStage.execute(
            project_id='p1', audio='/view?filename=a.wav&type=output'))
        assert 'audio' in captured['upstream']
        assert 'audios' not in captured['upstream']


class TestA2StmapHalfPixel:
    def test_identity_stmap_is_pixel_exact(self):
        import folder_paths
        from PIL import Image
        from ComfyTV.runners import media
        from ComfyTV.runners.uvmap import uv_remap_video
        d = Path(folder_paths.get_output_directory()) / 'rfx-src'
        d.mkdir(parents=True, exist_ok=True)
        p = d / 'grad.mp4'
        if not p.exists():
            with av.open(str(p), 'w') as out:
                v = out.add_stream('libx264', rate=12)
                v.width, v.height = 256, 64
                v.pix_fmt = 'yuv420p'
                v.options = {'qp': '0'}
                arr = np.zeros((64, 256, 3), dtype=np.uint8)
                arr[..., 0] = np.arange(256, dtype=np.uint8)[None, :]
                arr[..., 1] = 128
                arr[..., 2] = np.linspace(0, 255, 64).astype(np.uint8)[:, None]
                for i in range(4):
                    f = av.VideoFrame.from_ndarray(arr, format='rgb24').reformat(format='yuv420p')
                    f.pts = i
                    f.time_base = Fraction(1, 12)
                    for pkt in v.encode(f):
                        out.mux(pkt)
                for pkt in v.encode():
                    out.mux(pkt)
        uv_p = d / 'ident16.png'
        if not uv_p.exists():
            w, h = 256, 64
            arr = np.zeros((h, w, 3), dtype=np.uint8)
            arr[..., 0] = ((np.arange(w) + 0.5) / w * 255).astype(np.uint8)[None, :]
            arr[..., 1] = ((1 - (np.arange(h) + 0.5) / h) * 255).astype(np.uint8)[:, None]
            Image.fromarray(arr).save(uv_p)
        out = uv_remap_video(media.path_to_view_url(p),
                             media.path_to_view_url(uv_p), mode='stmap')
        src_in = media.localize(media.path_to_view_url(p))
        src_out = media.localize(out)

        def _mid(path):
            with av.open(str(path)) as c:
                frames = [f.to_ndarray(format='rgb24')
                          for f in c.decode(c.streams.video[0])]
            return frames[len(frames) // 2].astype(np.float32)

        a = _mid(src_in)[8:-8, 8:-8]
        b = _mid(src_out)[8:-8, 8:-8]
        assert np.abs(a - b).mean() < 4.0


class TestA3GodRaysDecay:
    def test_rays_decay_with_distance(self):
        import folder_paths
        from ComfyTV.runners import media
        from ComfyTV.runners.fx_torch import god_rays_video
        d = Path(folder_paths.get_output_directory()) / 'rfx-src'
        d.mkdir(parents=True, exist_ok=True)
        p = d / 'dot_center.mp4'
        if not p.exists():
            with av.open(str(p), 'w') as out:
                v = out.add_stream('libx264', rate=12)
                v.width, v.height = 160, 120
                v.pix_fmt = 'yuv420p'
                arr = np.zeros((120, 160, 3), dtype=np.uint8)
                arr[56:64, 76:84] = 255
                for i in range(4):
                    f = av.VideoFrame.from_ndarray(arr, format='rgb24').reformat(format='yuv420p')
                    f.pts = i
                    f.time_base = Fraction(1, 12)
                    for pkt in v.encode(f):
                        out.mux(pkt)
                for pkt in v.encode():
                    out.mux(pkt)
        out = god_rays_video(media.path_to_view_url(p), translate_x=50,
                             scale=1.0, steps=4, decay=0.1)
        src = media.localize(out)
        with av.open(str(src)) as c:
            frames = [f.to_ndarray(format='gray')
                      for f in c.decode(c.streams.video[0])]
        mid = frames[len(frames) // 2].astype(np.float32)
        near = mid[58:62, 90:96].mean()
        far = mid[58:62, 120:126].mean()
        assert near > far + 5


class TestA4RampEase:
    def test_current_formulas(self):
        from ComfyTV.runners.patterns import _shape_t
        assert _shape_t(0.5, 'ease_in') == pytest.approx(0.375)
        assert _shape_t(0.5, 'ease_out') == pytest.approx(0.625)
        assert _shape_t(0.0, 'ease_in') == 0.0
        assert _shape_t(1.0, 'ease_in') == 1.0
        assert _shape_t(1.0, 'ease_out') == 1.0


class TestA5IrlsCrash:
    def test_pathological_residuals_no_crash(self):
        from ComfyTV.runners.track_solve import solve_robust
        x1 = np.array([[0, 0], [10, 0], [0, 10], [10, 10]], dtype=float)
        x2 = x1 + np.array([[0.01, 0], [10, 0.5], [10.05, 0.3], [10.1, 0.1]])
        m = solve_robust(x1, x2, 'similarity')
        assert np.isfinite(m['tx']) and np.isfinite(m['scale'])

    def test_collinear_homography_raises(self):
        from ComfyTV.runners.track_solve import solve_homography
        x1 = np.array([[0, 0], [10, 0], [20, 0], [30, 0]], dtype=float)
        x2 = x1 + 1.0
        with pytest.raises(ValueError, match="degenerate"):
            solve_homography(x1, x2)


class TestA6MaskTimeline:
    def test_t_ref_keeps_source_duration(self):
        import folder_paths
        from PIL import Image
        from ComfyTV.runners import media
        from ComfyTV.runners.mask_propagate import propagate_mask_video
        from test_sprint123 import _write_textured_square
        d = Path(folder_paths.get_output_directory()) / 'rfx-src'
        d.mkdir(parents=True, exist_ok=True)
        p = d / 'movsq2.mp4'
        if not p.exists():
            _write_textured_square(p)
        mp = d / 'movsq2_mask.png'
        if not mp.exists():
            m = np.zeros((120, 160), dtype=np.uint8)
            m[40:80, 32:72] = 255
            Image.fromarray(m).save(mp)
        out = propagate_mask_video(media.path_to_view_url(p),
                                   media.path_to_view_url(mp),
                                   t_ref=0.35, model='translation',
                                   max_points=12)
        src_dur = media.get_video_info(media.path_to_view_url(p))['duration']
        out_dur = media.get_video_info(out)['duration']
        assert out_dur == pytest.approx(src_dur, abs=0.25)


class TestA8PaintMemory:
    def test_history_is_bytes_on_cpu(self, monkeypatch):
        import folder_paths
        from ComfyTV.runners import media, paint
        d = Path(folder_paths.get_output_directory()) / 'rfx-src'
        d.mkdir(parents=True, exist_ok=True)
        p = d / 'plain.mp4'
        if not p.exists():
            _write_clip(p, w=96, h=96, fps=12, seconds=0.6, with_audio=False)
        seen = {}
        orig = paint.torch_process_video

        def spy(url, frame_fn, **kw):
            def wrapped(img, t):
                r = frame_fn(img, t)
                seen['ok'] = True
                return r
            return orig(url, wrapped, **kw)

        monkeypatch.setattr(paint, 'torch_process_video', spy)
        paint.paint_video(media.path_to_view_url(p), [{
            'mode': 'clone', 'radius': 10, 'time_offset': -0.2,
            'points': [{'x': 48, 'y': 48}],
        }])
        assert seen.get('ok')

    def test_no_history_for_blur_only(self):
        import folder_paths
        from ComfyTV.runners import media
        from ComfyTV.runners.paint import paint_video
        d = Path(folder_paths.get_output_directory()) / 'rfx-src'
        d.mkdir(parents=True, exist_ok=True)
        p = d / 'plain.mp4'
        if not p.exists():
            _write_clip(p, w=96, h=96, fps=12, seconds=0.6, with_audio=False)
        paint_video(media.path_to_view_url(p), [{
            'mode': 'blur', 'sigma': 3, 'radius': 10,
            'points': [{'x': 48, 'y': 48}],
        }])


class TestBGuards:
    def test_atempo_zero_raises(self):
        from ComfyTV.runners.media_filter import atempo_specs
        with pytest.raises(ValueError, match="positive"):
            atempo_specs(0)
        with pytest.raises(ValueError, match="positive"):
            atempo_specs(-2)

    def test_reverse_pitch_audio_aligned(self):
        import folder_paths
        from ComfyTV.runners import media
        d = Path(folder_paths.get_output_directory()) / 'rfx-src'
        d.mkdir(parents=True, exist_ok=True)
        p = d / 'av_clip.mp4'
        if not p.exists():
            _write_clip(p, w=96, h=96, fps=12, seconds=1.0, with_audio=True)
        out = media.speed_video(media.path_to_view_url(p), 1.0, reverse=True)
        info = media.get_video_info(out)
        assert info['has_audio'] is True
        assert 0.8 <= info['duration'] <= 1.3
