from pathlib import Path


_AUDIO_RATE = 44100


_AAC_FRAME = 1024


def _new_aac_stream(outp):
    out_a = outp.add_stream('aac', rate=_AUDIO_RATE)
    out_a.layout = 'stereo'
    return out_a


def _decode_audio_to_array(path):
    import av
    import numpy as np
    if str(path).lower().endswith(('.mid', '.midi')):
        from .midi_import import render_midi_to_wav
        path = render_midi_to_wav(Path(path))
    chunks = []
    with av.open(str(path)) as inp:
        if not inp.streams.audio:
            return np.zeros((2, 0), dtype=np.float32)
        in_a = inp.streams.audio[0]
        resampler = av.AudioResampler(format='fltp', layout='stereo', rate=_AUDIO_RATE)
        for frame in inp.decode(in_a):
            for rf in resampler.resample(frame):
                chunks.append(rf.to_ndarray().astype(np.float32, copy=False))
        for rf in resampler.resample(None):
            chunks.append(rf.to_ndarray().astype(np.float32, copy=False))
    return np.concatenate(chunks, axis=1) if chunks else np.zeros((2, 0), dtype=np.float32)


def _encode_audio_array(outp, out_a, arr):
    import av
    import numpy as np
    from fractions import Fraction
    pos = 0
    total = arr.shape[1]
    while pos < total:
        chunk = arr[:, pos:pos + _AAC_FRAME]
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
