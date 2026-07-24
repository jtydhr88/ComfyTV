"""Alpha (yuva) video outputs survive both render lanes.

Note: ffmpeg's native vp9 decoder ignores the alpha side-band; decoding
with the libvpx-vp9 codec is the only way to see it from PyAV.
"""
from fractions import Fraction
from pathlib import Path

import pytest

av = pytest.importorskip("av")
np = pytest.importorskip("numpy")

from conftest import needs_torch  # noqa: E402


def _write_green_clip(p: Path, w=64, h=64, fps=8, n=12):
    with av.open(str(p), 'w') as outp:
        enc = outp.add_stream('libx264', rate=fps)
        enc.width, enc.height = w, h
        enc.pix_fmt = 'yuv420p'
        enc.codec_context.time_base = Fraction(1, fps)
        for i in range(n):
            arr = np.zeros((h, w, 3), np.uint8)
            arr[..., 1] = 200
            arr[8:24, 8:24] = 255
            f = av.VideoFrame.from_ndarray(arr, format='rgb24')
            f = f.reformat(format='yuv420p')
            f.pts = i
            f.time_base = Fraction(1, fps)
            for pkt in enc.encode(f):
                outp.mux(pkt)
        for pkt in enc.encode():
            outp.mux(pkt)


def _transparent_frac(view_url) -> float:
    from ComfyTV.runners.media import localize
    with av.open(str(localize(view_url))) as c:
        s = c.streams.video[0]
        ctx = av.CodecContext.create('libvpx-vp9', 'r')
        if s.codec_context.extradata:
            ctx.extradata = s.codec_context.extradata
        for pkt in c.demux(s):
            for f in ctx.decode(pkt):
                if 'a' not in f.format.name:
                    return 0.0
                a = f.to_ndarray(format='rgba')[..., 3]
                return float((a < 128).mean())
    return 0.0


@pytest.fixture()
def green_clip():
    from ComfyTV.runners import media
    import folder_paths
    p = Path(folder_paths.get_output_directory()) / 'fx-src' / 'green.mp4'
    p.parent.mkdir(parents=True, exist_ok=True)
    if not p.exists():
        _write_green_clip(p)
    return media.path_to_view_url(p)


def test_chroma_key_alpha_survives_filter_lane(green_clip):
    from ComfyTV.runners.media_filter import chroma_key_video
    out = chroma_key_video(green_clip, key_color='#00C800',
                           similarity=0.25, blend=0.05)
    frac = _transparent_frac(out)
    assert 0.3 < frac < 0.99


@needs_torch
def test_keyer_alpha_survives_torch_lane(green_clip):
    from ComfyTV.runners.keying import keyer_video
    out = keyer_video(green_clip, mode='screen', key_color='#00C800',
                      output='alpha')
    frac = _transparent_frac(out)
    assert 0.3 < frac < 0.99
