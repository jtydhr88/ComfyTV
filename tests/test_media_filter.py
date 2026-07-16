"""Functional tests for runners.media_filter (Lane A: libavfilter graphs)."""
from pathlib import Path

import pytest

av = pytest.importorskip("av")
np = pytest.importorskip("numpy")

from test_media_concat import _write_clip  # noqa: E402


@pytest.fixture()
def clip_av():
    from ComfyTV.runners import media
    import folder_paths
    src_dir = Path(folder_paths.get_output_directory()) / 'filter-src'
    src_dir.mkdir(parents=True, exist_ok=True)
    p = src_dir / 'clip_av.mp4'
    if not p.exists():
        _write_clip(p, w=320, h=240, fps=24, seconds=2.0, with_audio=True)
    return media.path_to_view_url(p)


@pytest.fixture()
def clip_b():
    from ComfyTV.runners import media
    import folder_paths
    src_dir = Path(folder_paths.get_output_directory()) / 'filter-src'
    src_dir.mkdir(parents=True, exist_ok=True)
    p = src_dir / 'clip_b.mp4'
    if not p.exists():
        _write_clip(p, w=640, h=360, fps=30, seconds=1.5, with_audio=True)
    return media.path_to_view_url(p)


class TestAvailability:
    def test_core_filters_present(self):
        from ComfyTV.runners import media_filter as mf
        for name in ('gblur', 'curves', 'xfade', 'select', 'chromakey',
                     'loudnorm', 'acompressor', 'scale', 'format'):
            assert mf.has_filter(name), name

    def test_require_raises_on_unknown(self):
        from ComfyTV.runners import media_filter as mf
        with pytest.raises(RuntimeError, match="no_such_filter"):
            mf.require_filters('no_such_filter')


class TestFilterVideo:
    def test_video_only_chain(self, clip_av):
        from ComfyTV.runners import media, media_filter as mf
        calls = []
        out = mf.filter_video(clip_av, video_specs=[('gblur', 'sigma=2')],
                              progress=lambda v, t, s='': calls.append(v))
        info = media.get_video_info(out)
        assert (info['width'], info['height']) == (320, 240)
        assert info['has_audio'] is True
        assert 1.7 <= info['duration'] <= 2.4
        assert calls  # progress fired

    def test_audio_only_chain(self, clip_av):
        from ComfyTV.runners import media, media_filter as mf
        out = mf.filter_video(clip_av, audio_specs=[('atempo', '1.0')])
        info = media.get_video_info(out)
        assert info['has_audio'] is True
        assert 1.7 <= info['duration'] <= 2.4

    def test_both_chains(self, clip_av):
        from ComfyTV.runners import media, media_filter as mf
        out = mf.filter_video(
            clip_av,
            video_specs=[('vignette', None), ('unsharp', None)],
            audio_specs=[('acompressor', 'threshold=0.5')],
        )
        info = media.get_video_info(out)
        assert info['has_audio'] is True

    def test_geometry_changing_filter(self, clip_av):
        from ComfyTV.runners import media, media_filter as mf
        out = mf.filter_video(clip_av, video_specs=[('scale', '160:120')])
        info = media.get_video_info(out)
        assert (info['width'], info['height']) == (160, 120)

    def test_no_filters_rejected(self, clip_av):
        from ComfyTV.runners import media_filter as mf
        with pytest.raises(RuntimeError, match="no filters"):
            mf.filter_video(clip_av)


class TestFilterAudio:
    def test_wav_out(self, clip_av):
        from ComfyTV.runners import media_filter as mf
        out = mf.filter_audio(clip_av, [('afade', 't=in:d=0.3')])
        assert out.startswith('/view?')
        assert 'wav' in out


class TestXfade:
    def test_fade_two_clips(self, clip_av, clip_b):
        from ComfyTV.runners import media, media_filter as mf
        out = mf.xfade_videos(clip_av, clip_b, transition='fade', duration=0.5)
        info = media.get_video_info(out)
        # duration ≈ dur_a + dur_b - overlap = 2.0 + 1.5 - 0.5 = 3.0
        assert 2.6 <= info['duration'] <= 3.4
        assert (info['width'], info['height']) == (320, 240)
        assert info['has_audio'] is True

    def test_unknown_transition(self, clip_av, clip_b):
        from ComfyTV.runners import media_filter as mf
        with pytest.raises(RuntimeError, match="unknown transition"):
            mf.xfade_videos(clip_av, clip_b, transition='sparkle')


class TestSceneDetect:
    def test_hard_cut_found(self):
        """Two visually distinct halves welded packet-wise → one cut ≈ 1.0s."""
        from ComfyTV.runners import media, media_filter as mf
        import folder_paths
        src_dir = Path(folder_paths.get_output_directory()) / 'filter-src'
        src_dir.mkdir(parents=True, exist_ok=True)
        p = src_dir / 'cutclip.mp4'
        if not p.exists():
            from fractions import Fraction
            with av.open(str(p), 'w') as out:
                v = out.add_stream('libx264', rate=24)
                v.width, v.height = 320, 240
                v.pix_fmt = 'yuv420p'
                rng = np.random.default_rng(7)
                noise_a = rng.integers(0, 60, (240, 320, 3), dtype=np.uint8)
                noise_b = rng.integers(180, 255, (240, 320, 3), dtype=np.uint8)
                for i in range(48):
                    arr = noise_a if i < 24 else noise_b
                    f = av.VideoFrame.from_ndarray(arr, format='rgb24').reformat(format='yuv420p')
                    f.pts = i
                    f.time_base = Fraction(1, 24)
                    for pkt in v.encode(f):
                        out.mux(pkt)
                for pkt in v.encode():
                    out.mux(pkt)
        cuts = mf.scene_detect(media.path_to_view_url(p), threshold=0.3)
        assert len(cuts) >= 1
        assert any(0.8 <= t <= 1.2 for t in cuts)


class TestScopes:
    def test_waveform_image(self, clip_av):
        from ComfyTV.runners import media_filter as mf
        out = mf.filter_frame_image(clip_av, 'middle', [('waveform', None)])
        assert out.startswith('/view?')
