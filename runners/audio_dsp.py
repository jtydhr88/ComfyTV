import re
from fractions import Fraction

from .media import (
    localize, fresh_output_path, path_to_view_url,
    _decode_audio_to_array, _AUDIO_RATE,
)
from .media_filter import make_progress


def _write_wav(arr, out_codec: str = 'wav', metadata: dict | None = None) -> str:
    import av
    import numpy as np

    if out_codec == 'mp3':
        out = fresh_output_path('.mp3', subfolder='comfytv/audio')
        codec, container = 'libmp3lame', 'mp3'
    else:
        out = fresh_output_path('.wav', subfolder='comfytv/audio')
        codec, container = 'pcm_s16le', 'wav'

    with av.open(str(out), 'w', format=container) as outp:
        if metadata:
            for k, v in metadata.items():
                outp.metadata[k] = str(v)
        out_a = outp.add_stream(codec, rate=_AUDIO_RATE)
        out_a.layout = 'stereo'
        pos = 0
        total = arr.shape[1]
        while pos < total:
            chunk = arr[:, pos:pos + 1024]
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
    arr = _decode_audio_to_array(localize(view_url))
    if arr.shape[1] == 0:
        raise RuntimeError("feedback echo: source has no audio")
    n = int(round(float(delay_s) * _AUDIO_RATE))
    y = feedback_echo_array(arr, n, decay)
    return _write_wav(y, out_codec)


LOUDNESS_PLATFORMS = [
    {'name': 'EBU R128',      'tp': -1.0, 'lufs': -23.0, 'lo': -23.5, 'hi': -22.5},
    {'name': 'ATSC A/85',     'tp': -2.0, 'lufs': -24.0, 'lo': -26.0, 'hi': -22.0},
    {'name': 'AES Streaming', 'tp': -1.0, 'lufs': -18.0, 'lo': -20.0, 'hi': -16.0},
    {'name': 'CD / DVD',      'tp': -0.1, 'lufs': -9.0,  'lo': -200.0, 'hi': -9.0},
    {'name': 'Amazon Music',  'tp': -2.0, 'lufs': -14.0, 'lo': -19.0, 'hi': -9.0},
    {'name': 'Apple Music',   'tp': -1.0, 'lufs': -16.0, 'lo': -17.0, 'hi': -15.0},
    {'name': 'Deezer',        'tp': -1.0, 'lufs': -15.0, 'lo': -16.0, 'hi': -14.0},
    {'name': 'Soundcloud',    'tp': -1.0, 'lufs': -10.0, 'lo': -13.0, 'hi': -8.0},
    {'name': 'Spotify',       'tp': -1.0, 'lufs': -14.0, 'lo': -20.0, 'hi': -8.0},
    {'name': 'Spotify Loud',  'tp': -2.0, 'lufs': -11.0, 'lo': -17.0, 'hi': -5.0},
    {'name': 'YouTube',       'tp': -1.0, 'lufs': -14.0, 'lo': -15.0, 'hi': -13.0},
]


def evaluate_loudness_compliance(integrated_lufs: float, peak_dbfs: float) -> list:
    out = []
    for p in LOUDNESS_PLATFORMS:
        if integrated_lufs > p['hi'] or peak_dbfs > p['tp']:
            verdict = 'over'
        elif integrated_lufs < p['lo']:
            verdict = 'quiet'
        else:
            verdict = 'ok'
        out.append({'name': p['name'], 'target_lufs': p['lufs'],
                    'max_tp': p['tp'], 'verdict': verdict})
    return out


def _pan_gains(pan: float, law: str):
    import math
    pan = min(1.0, max(-1.0, float(pan)))
    if law == 'constant_power':
        scale = -0.831783138
        pr = (pan + 1.0) / 2.0
        pl = 1.0 - pr
        gl = pl * (scale * pl + 1.0 - scale)
        gr = pr * (scale * pr + 1.0 - scale)
        return gl, gr
    return min(1.0, 1.0 - pan), min(1.0, 1.0 + pan)


_LIPSHITZ = (2.033, -2.165, 1.959, -1.590, 0.6149)


def dither_quantize(arr, mode: str = 'none'):
    import numpy as np

    x = np.clip(arr.astype(np.float64), -1.0, 1.0) * 32767.0
    if mode == 'none':
        q = np.rint(x)
    elif mode == 'tpdf':
        rng = np.random.default_rng(0x5EED)
        noise = rng.random(x.shape) - rng.random(x.shape)
        q = np.rint(x + noise)
    elif mode == 'shaped':
        rng = np.random.default_rng(0x5EED)
        noise = rng.random(x.shape) - rng.random(x.shape)
        q = np.empty_like(x)
        for c in range(x.shape[0]):
            err = [0.0] * len(_LIPSHITZ)
            xc = x[c]
            nc = noise[c]
            qc = q[c]
            for i in range(xc.shape[0]):
                shaped = xc[i]
                for k, coef in enumerate(_LIPSHITZ):
                    shaped += coef * err[k]
                v = float(np.rint(shaped + nc[i]))
                err = [shaped - v] + err[:-1]
                qc[i] = v
    else:
        raise RuntimeError(f"dither: unknown mode {mode!r}")
    return (np.clip(q, -32768, 32767) / 32768.0).astype(np.float32)


def mix_audios(sources: list, pan_law: str = 'audacity',
               dither: str = 'none', out_codec: str = 'wav') -> str:
    import numpy as np

    if not sources:
        raise RuntimeError("mix: no inputs")
    if pan_law not in ('audacity', 'constant_power'):
        raise RuntimeError(f"mix: unknown pan law {pan_law!r}")

    arrs = []
    for s in sources:
        arr = _decode_audio_to_array(localize(s['url']))
        if arr.shape[1] == 0:
            continue
        gain = 10.0 ** (float(s.get('gain_db', 0.0)) / 20.0)
        gl, gr = _pan_gains(s.get('pan', 0.0), pan_law)
        arr = arr.astype(np.float32, copy=True)
        arr[0] *= gain * gl
        arr[1] *= gain * gr
        arrs.append(arr)
    if not arrs:
        raise RuntimeError("mix: all inputs empty")

    total = max(a.shape[1] for a in arrs)
    mixed = np.zeros((2, total), dtype=np.float32)
    for a in arrs:
        mixed[:, :a.shape[1]] += a
    mixed = np.clip(mixed, -1.0, 1.0)
    if dither != 'none':
        mixed = dither_quantize(mixed, dither)
    return _write_wav(mixed, out_codec)


def audible_segments(arr, threshold_db: float = -60.0,
                     min_silence_s: float = 0.0227,
                     min_segment_s: float = 0.1,
                     block_s: float = 0.01) -> list:
    import numpy as np

    if arr.shape[1] == 0:
        return []
    thr = 10.0 ** (float(threshold_db) / 20.0)
    block = max(1, int(round(block_s * _AUDIO_RATE)))
    n = arr.shape[1]
    nblocks = (n + block - 1) // block
    padded = np.zeros((arr.shape[0], nblocks * block), dtype=np.float32)
    padded[:, :n] = np.abs(arr)
    peaks = padded.reshape(arr.shape[0], nblocks, block).max(axis=(0, 2))
    active = peaks > thr

    segs = []
    start = None
    for i, a in enumerate(active):
        if a and start is None:
            start = i
        elif not a and start is not None:
            segs.append([start * block, i * block])
            start = None
    if start is not None:
        segs.append([start * block, n])

    min_sil = int(round(min_silence_s * _AUDIO_RATE))
    merged = []
    for s in segs:
        if merged and s[0] - merged[-1][1] < min_sil:
            merged[-1][1] = s[1]
        else:
            merged.append(s)

    min_seg = int(round(min_segment_s * _AUDIO_RATE))
    return [
        {'start': round(a / _AUDIO_RATE, 4), 'end': round(min(b, n) / _AUDIO_RATE, 4)}
        for a, b in merged if (b - a) >= min_seg
    ]


def _segment_name(naming: str, prefix: str, index: int) -> str:
    prefix = re.sub(r'[\\/:*?"<>|]', '_', prefix or 'segment').strip() or 'segment'
    if naming == 'name':
        return f'{prefix}' if index == 0 else f'{prefix}_{index + 1}'
    if naming == 'num_and_name':
        return f'{index + 1:02d}-{prefix}'
    return f'{prefix}-{index + 1:02d}'


def segment_export(view_url: str, segments: list | None = None,
                   threshold_db: float = -60.0, min_silence_s: float = 0.5,
                   min_segment_s: float = 0.1, fade_ms: float = 1.45,
                   naming: str = 'num_and_prefix', prefix: str = 'segment',
                   out_codec: str = 'wav', progress=None) -> dict:
    import numpy as np

    arr = _decode_audio_to_array(localize(view_url))
    if arr.shape[1] == 0:
        raise RuntimeError("segment export: source has no audio")
    if segments is None:
        segments = audible_segments(arr, threshold_db=threshold_db,
                                    min_silence_s=min_silence_s,
                                    min_segment_s=min_segment_s)
    if not segments:
        raise RuntimeError(
            "segment export: no segments found — lower the threshold.")

    fade = max(0, int(round(float(fade_ms) * _AUDIO_RATE / 1000.0)))
    report = make_progress(progress, len(segments), "segments")
    files = []
    for i, seg in enumerate(segments):
        a = max(0, int(round(float(seg['start']) * _AUDIO_RATE)))
        b = min(arr.shape[1], int(round(float(seg['end']) * _AUDIO_RATE)))
        if b <= a:
            continue
        piece = arr[:, a:b].astype(np.float32, copy=True)
        f = min(fade, piece.shape[1] // 2)
        if f > 0:
            ramp = np.linspace(0.0, 1.0, f, dtype=np.float32)
            piece[:, :f] *= ramp
            piece[:, -f:] *= ramp[::-1]
        name = _segment_name(naming, prefix, i)
        url = _write_wav(piece, out_codec,
                         metadata={'title': name, 'track': i + 1})
        files.append({'index': i, 'name': name, 'url': url,
                      'start': seg['start'], 'end': seg['end']})
        report(i + 1, text=f"segment {i + 1}/{len(segments)}")
    if not files:
        raise RuntimeError("segment export: no non-empty segments")
    return {'files': files, 'count': len(files)}


from .audio_render import *  # noqa: F401,F403
from .audio_ir import *  # noqa: F401,F403


__all__ = [
    'feedback_echo_array', 'echo_feedback',
    'LOUDNESS_PLATFORMS', 'evaluate_loudness_compliance',
    'mix_audios', 'dither_quantize',
    'audible_segments', 'segment_export',
    'render_waveform_image', 'render_spectrogram_image',
    'convolve_ir', 'ess_sweep', 'deconvolve_ir',
]
