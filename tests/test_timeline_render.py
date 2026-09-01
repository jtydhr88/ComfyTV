"""Functional tests for runners.timeline_render with real synthesized clips."""
from fractions import Fraction
from pathlib import Path

import pytest

av = pytest.importorskip("av")
np = pytest.importorskip("numpy")

from test_media_concat import _write_clip  # noqa: E402


def _write_gapped_clip(path: Path, *, w=320, h=240, fps=12, seconds=3.0):
    """Video with audio: tone 0-1s, silence 1-2s, tone 2-3s."""
    rate = 44100
    with av.open(str(path), 'w') as out:
        v = out.add_stream('libx264', rate=fps)
        v.width, v.height = w, h
        v.pix_fmt = 'yuv420p'
        a = out.add_stream('aac', rate=rate)
        a.layout = 'stereo'

        for i in range(int(seconds * fps)):
            arr = np.full((h, w, 3), (i * 16) % 255, dtype=np.uint8)
            f = av.VideoFrame.from_ndarray(arr, format='rgb24').reformat(format='yuv420p')
            f.pts = i
            f.time_base = Fraction(1, fps)
            for pkt in v.encode(f):
                out.mux(pkt)
        for pkt in v.encode():
            out.mux(pkt)

        total = int(seconds * rate)
        t = np.arange(total, dtype=np.float32) / rate
        tone = (0.2 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
        tone[int(1.0 * rate):int(2.0 * rate)] = 0.0
        stereo = np.stack([tone, tone])
        written = 0
        while written < total:
            chunk = stereo[:, written:written + 1024]
            af = av.AudioFrame.from_ndarray(
                np.ascontiguousarray(chunk), format='fltp', layout='stereo')
            af.sample_rate = rate
            af.pts = written
            af.time_base = Fraction(1, rate)
            written += chunk.shape[1]
            for pkt in a.encode(af):
                out.mux(pkt)
        for pkt in a.encode():
            out.mux(pkt)


def _src_dir():
    import folder_paths
    d = Path(folder_paths.get_output_directory()) / 'timeline-src'
    d.mkdir(parents=True, exist_ok=True)
    return d


def test_timeline_detects_silence_gap():
    from ComfyTV.runners import media, timeline_render
    from PIL import Image

    p = _src_dir() / 'gapped.mp4'
    if not p.exists():
        _write_gapped_clip(p)

    result = timeline_render.render_timeline_image(media.path_to_view_url(p))
    assert result['start'] == 0.0
    assert 2.5 < result['end'] <= 3.2
    assert result['n_frames'] == 10

    assert any(a <= 1.5 <= b for a, b in result['silences']), result['silences']

    out = media.view_url_to_path(result['url'])
    assert out is not None
    with Image.open(out) as im:
        assert im.width == 1568
        assert im.height > 200


def test_timeline_range_words_and_no_audio():
    from ComfyTV.runners import media, timeline_render

    p = _src_dir() / 'silent.mp4'
    if not p.exists():
        _write_clip(p, w=320, h=240, fps=12, seconds=2.0, with_audio=False)
    url = media.path_to_view_url(p)

    words = [{'text': 'hello', 'start': 0.2, 'end': 0.6},
             {'text': 'world', 'start': 0.9, 'end': 1.3},
             {'bogus': True}, 'junk']
    result = timeline_render.render_timeline_image(
        url, start=0.5, end=1.5, n_frames=4, words=words)
    assert result['silences'] == []
    assert result['start'] == 0.5 and result['end'] == 1.5
    assert media.view_url_to_path(result['url']) is not None

    with pytest.raises(RuntimeError, match='must be >'):
        timeline_render.render_timeline_image(url, start=1.5, end=0.5)
