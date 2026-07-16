from fractions import Fraction

from .media import (
    localize, fresh_output_path, path_to_view_url,
    _decode_audio_to_array, _AUDIO_RATE,
)


def feedback_echo_array(arr, delay_samples: int, decay: float):
    import numpy as np

    n = int(delay_samples)
    if n <= 0:
        raise RuntimeError("feedback echo: delay must be at least 1 sample")
    y = arr.astype(np.float32, copy=True)
    total = y.shape[1]
    for start in range(n, total, n):
        end = min(start + n, total)
        y[:, start:end] += float(decay) * y[:, start - n:start - n + (end - start)]
    return np.clip(y, -1.0, 1.0)


def echo_feedback(view_url: str, delay_s: float, decay: float,
                  out_codec: str = 'wav') -> str:
    import av
    import numpy as np

    src_path = localize(view_url)
    arr = _decode_audio_to_array(src_path)
    if arr.shape[1] == 0:
        raise RuntimeError("feedback echo: source has no audio")
    n = int(round(float(delay_s) * _AUDIO_RATE))
    y = feedback_echo_array(arr, n, decay)

    if out_codec == 'mp3':
        out = fresh_output_path('.mp3', subfolder='comfytv-audio')
        codec, container = 'libmp3lame', 'mp3'
    else:
        out = fresh_output_path('.wav', subfolder='comfytv-audio')
        codec, container = 'pcm_s16le', 'wav'

    with av.open(str(out), 'w', format=container) as outp:
        out_a = outp.add_stream(codec, rate=_AUDIO_RATE)
        out_a.layout = 'stereo'
        pos = 0
        total = y.shape[1]
        while pos < total:
            chunk = y[:, pos:pos + 1024]
            af = av.AudioFrame.from_ndarray(
                np.ascontiguousarray(chunk), format='fltp', layout='stereo')
            af.sample_rate = _AUDIO_RATE
            af.pts = pos
            af.time_base = Fraction(1, _AUDIO_RATE)
            pos += chunk.shape[1]
            for pkt in out_a.encode(af):
                outp.mux(pkt)
        for pkt in out_a.encode():
            outp.mux(pkt)

    return path_to_view_url(out)


__all__ = ['feedback_echo_array', 'echo_feedback']
