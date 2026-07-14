"""Functional tests for runners.media.concat_videos with real synthesized clips."""
from fractions import Fraction
from pathlib import Path

import pytest

av = pytest.importorskip("av")
np = pytest.importorskip("numpy")


def _write_clip(path: Path, *, w: int, h: int, fps: int, seconds: float, with_audio: bool):
    with av.open(str(path), 'w') as out:
        v = out.add_stream('libx264', rate=fps)
        v.width = w
        v.height = h
        v.pix_fmt = 'yuv420p'
        a = None
        if with_audio:
            a = out.add_stream('aac', rate=44100)
            a.layout = 'stereo'

        n_frames = int(round(seconds * fps))
        for i in range(n_frames):
            arr = np.full((h, w, 3), (i * 8) % 255, dtype=np.uint8)
            frame = av.VideoFrame.from_ndarray(arr, format='rgb24').reformat(format='yuv420p')
            frame.pts = i
            frame.time_base = Fraction(1, fps)
            for pkt in v.encode(frame):
                out.mux(pkt)
        for pkt in v.encode():
            out.mux(pkt)

        if a is not None:
            total = int(seconds * 44100)
            t = np.arange(total, dtype=np.float32) / 44100.0
            tone = (0.1 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
            stereo = np.stack([tone, tone])
            written = 0
            while written < total:
                chunk = stereo[:, written:written + 1024]
                af = av.AudioFrame.from_ndarray(
                    np.ascontiguousarray(chunk), format='fltp', layout='stereo')
                af.sample_rate = 44100
                af.pts = written
                af.time_base = Fraction(1, 44100)
                written += chunk.shape[1]
                for pkt in a.encode(af):
                    out.mux(pkt)
            for pkt in a.encode():
                out.mux(pkt)


def test_concat_videos_two_clips():
    """Mixed resolutions/fps, one clip silent — output matches first clip's
    geometry, keeps audio, and durations add up."""
    from ComfyTV.runners import media
    import folder_paths

    src_dir = Path(folder_paths.get_output_directory()) / 'concat-src'
    src_dir.mkdir(parents=True, exist_ok=True)
    c1 = src_dir / 'a.mp4'
    c2 = src_dir / 'b.mp4'
    _write_clip(c1, w=320, h=240, fps=24, seconds=1.0, with_audio=True)
    _write_clip(c2, w=640, h=360, fps=30, seconds=0.5, with_audio=False)

    calls = []
    result = media.concat_videos(
        [media.path_to_view_url(c1), media.path_to_view_url(c2)],
        progress=lambda v, t, s='': calls.append((v, t)),
    )

    info = media.get_video_info(result)
    assert info['width'] == 320 and info['height'] == 240
    assert info['has_audio'] is True
    assert 1.3 <= info['duration'] <= 1.8
    assert calls == [(0, 2), (1, 2)]


def test_concat_videos_needs_two():
    from ComfyTV.runners import media
    with pytest.raises(RuntimeError, match="at least 2"):
        media.concat_videos(["/view?filename=x.mp4"])
    with pytest.raises(RuntimeError, match="at least 2"):
        media.concat_videos(["", None])


@pytest.fixture()
def clip_with_audio():
    from ComfyTV.runners import media
    import folder_paths
    src_dir = Path(folder_paths.get_output_directory()) / 'media-src'
    src_dir.mkdir(parents=True, exist_ok=True)
    p = src_dir / 'clip_av.mp4'
    if not p.exists():
        _write_clip(p, w=320, h=240, fps=24, seconds=2.0, with_audio=True)
    return media.path_to_view_url(p)


class TestSpeedVideo:
    def test_double_speed_halves_duration(self, clip_with_audio):
        from ComfyTV.runners import media
        out = media.speed_video(clip_with_audio, 2.0)
        info = media.get_video_info(out)
        assert 0.8 <= info['duration'] <= 1.3
        assert info['has_audio'] is True

    def test_reverse_keeps_duration(self, clip_with_audio):
        from ComfyTV.runners import media
        out = media.speed_video(clip_with_audio, 1.0, reverse=True)
        info = media.get_video_info(out)
        assert 1.7 <= info['duration'] <= 2.4

    def test_factor_out_of_range(self, clip_with_audio):
        from ComfyTV.runners import media
        with pytest.raises(RuntimeError, match="factor out of range"):
            media.speed_video(clip_with_audio, 100.0)


class TestTransposeVideo:
    def test_rotate_90_swaps_dims(self, clip_with_audio):
        from ComfyTV.runners import media
        out = media.transpose_video(clip_with_audio, rotate_deg=90)
        info = media.get_video_info(out)
        assert (info['width'], info['height']) == (240, 320)
        assert info['has_audio'] is True

    def test_flip_keeps_dims(self, clip_with_audio):
        from ComfyTV.runners import media
        out = media.transpose_video(clip_with_audio, flip_h=True)
        info = media.get_video_info(out)
        assert (info['width'], info['height']) == (320, 240)

    def test_noop_rejected(self, clip_with_audio):
        from ComfyTV.runners import media
        with pytest.raises(RuntimeError, match="nothing to do"):
            media.transpose_video(clip_with_audio)


class TestAdjustVolume:
    def test_gain_and_fades(self, clip_with_audio):
        from ComfyTV.runners import media
        out = media.adjust_volume(clip_with_audio, volume=0.5,
                                  fade_in_s=0.3, fade_out_s=0.3)
        info = media.get_video_info(out)
        assert info['has_audio'] is True
        assert 1.7 <= info['duration'] <= 2.4

    def test_no_audio_rejected(self):
        from ComfyTV.runners import media
        import folder_paths
        src_dir = Path(folder_paths.get_output_directory()) / 'media-src'
        src_dir.mkdir(parents=True, exist_ok=True)
        p = src_dir / 'clip_silent.mp4'
        if not p.exists():
            _write_clip(p, w=320, h=240, fps=24, seconds=1.0, with_audio=False)
        with pytest.raises(RuntimeError, match="no audio track"):
            media.adjust_volume(media.path_to_view_url(p), volume=0.5)


class TestMuxAudio:
    def test_replace_onto_silent_video(self, clip_with_audio):
        from ComfyTV.runners import media
        import folder_paths
        src_dir = Path(folder_paths.get_output_directory()) / 'media-src'
        src_dir.mkdir(parents=True, exist_ok=True)
        silent = src_dir / 'clip_silent2.mp4'
        if not silent.exists():
            _write_clip(silent, w=320, h=240, fps=24, seconds=1.5, with_audio=False)
        out = media.mux_audio(media.path_to_view_url(silent), clip_with_audio,
                              mode='replace', offset_s=0.2)
        info = media.get_video_info(out)
        assert info['has_audio'] is True
        assert 1.2 <= info['duration'] <= 1.9

    def test_mix_mode(self, clip_with_audio):
        from ComfyTV.runners import media
        out = media.mux_audio(clip_with_audio, clip_with_audio, mode='mix')
        assert media.get_video_info(out)['has_audio'] is True

    def test_bad_mode(self, clip_with_audio):
        from ComfyTV.runners import media
        with pytest.raises(RuntimeError, match="unknown mode"):
            media.mux_audio(clip_with_audio, clip_with_audio, mode='overlay')


class TestExtractFramesMulti:
    def test_three_marks(self, clip_with_audio):
        from ComfyTV.runners import media
        import json
        payload = json.loads(media.extract_frames_multi(clip_with_audio, [0.2, 1.0, 1.8]))
        assert len(payload['images']) == 3
        assert payload['images'][0]['index'] == 1
        assert all(img['image_url'].startswith('/view?') for img in payload['images'])

    def test_empty_marks_rejected(self, clip_with_audio):
        from ComfyTV.runners import media
        with pytest.raises(RuntimeError, match="no timestamps"):
            media.extract_frames_multi(clip_with_audio, [])
