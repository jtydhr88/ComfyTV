import re
from fractions import Fraction

from .media import (
    localize, fresh_output_path, path_to_view_url,
    _decode_audio_to_array, _AUDIO_RATE,
)
from .media_filter import make_progress
from .roseus_lut import ROSEUS_LUT


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


_GRAY_LUT = tuple((v, v, v) for v in range(256))


def _lut(colormap: str):
    return ROSEUS_LUT if colormap == 'roseus' else _GRAY_LUT


def render_waveform_image(view_url: str, width: int = 1200, height: int = 480,
                          show_rms: bool = True, show_clipping: bool = True,
                          db_axis: bool = False) -> str:
    import numpy as np
    from PIL import Image

    arr = _decode_audio_to_array(localize(view_url))
    if arr.shape[1] == 0:
        raise RuntimeError("waveform: source has no audio")
    width = min(4096, max(240, int(width)))
    height = min(2048, max(120, int(height)))

    mono = arr.mean(axis=0)
    n = mono.shape[0]
    block = max(1, n // width)
    ncols = min(width, (n + block - 1) // block)
    padded = np.zeros(ncols * block, dtype=np.float32)
    padded[:n] = mono[:ncols * block]
    cols = padded.reshape(ncols, block)
    vmax = cols.max(axis=1)
    vmin = cols.min(axis=1)
    rms = np.sqrt((cols ** 2).mean(axis=1))
    clip_cols = (np.abs(arr[:, :ncols * block])
                 .reshape(2, ncols, block).max(axis=(0, 2))) >= (32766.0 / 32768.0)

    def to_y(v):
        if db_axis:
            db = 20.0 * np.log10(np.maximum(np.abs(v), 1e-6))
            mag = np.clip((db + 60.0) / 60.0, 0.0, 1.0) * np.sign(v)
        else:
            mag = np.clip(v, -1.0, 1.0)
        return ((1.0 - mag) * 0.5 * (height - 1)).astype(int)

    img = np.zeros((height, width, 3), dtype=np.uint8)
    img[:, :] = (20, 20, 32)
    mid = height // 2
    img[mid, :ncols] = (60, 60, 90)

    y_hi, y_lo = to_y(vmax), to_y(vmin)
    yr_hi, yr_lo = to_y(rms), to_y(-rms)
    for x in range(ncols):
        img[min(y_hi[x], y_lo[x]):max(y_hi[x], y_lo[x]) + 1, x] = (86, 86, 149)
        if show_rms:
            img[min(yr_hi[x], yr_lo[x]):max(yr_hi[x], yr_lo[x]) + 1, x] = (130, 130, 200)
        if show_clipping and clip_cols[x]:
            img[:, x] = (255, 40, 40)

    out = fresh_output_path('.png', subfolder='comfytv/audio')
    Image.fromarray(img, 'RGB').save(str(out), 'PNG')
    return path_to_view_url(out)


def render_spectrogram_image(view_url: str, width: int = 1200,
                             height: int = 480, scale: str = 'log',
                             colormap: str = 'roseus', range_db: float = 80.0,
                             gain_db: float = 20.0,
                             freq_gain_dbpoct: float = 0.0) -> str:
    import numpy as np
    from PIL import Image

    if scale not in ('linear', 'log', 'mel'):
        raise RuntimeError(f"spectrogram: unknown scale {scale!r}")
    arr = _decode_audio_to_array(localize(view_url))
    if arr.shape[1] == 0:
        raise RuntimeError("spectrogram: source has no audio")
    width = min(4096, max(240, int(width)))
    height = min(2048, max(120, int(height)))

    mono = arr.mean(axis=0)
    nfft = 2048
    hop = max(1, (mono.shape[0] - nfft) // width)
    nframes = min(width, max(1, 1 + (mono.shape[0] - nfft) // hop))
    win = np.hanning(nfft).astype(np.float32)
    idx = (np.arange(nframes)[:, None] * hop + np.arange(nfft)[None, :])
    frames = mono[np.clip(idx, 0, mono.shape[0] - 1)] * win
    power = np.abs(np.fft.rfft(frames, axis=1)) ** 2
    wss = 4.0 / (win.sum() ** 2)
    db = 10.0 * np.log10(np.maximum(power * wss, 1e-12))

    freqs = np.fft.rfftfreq(nfft, 1.0 / _AUDIO_RATE)
    if freq_gain_dbpoct:
        db = db + freq_gain_dbpoct * np.log2(np.maximum(freqs, 1.0) / 1000.0)[None, :]

    fmin, fmax = 20.0, _AUDIO_RATE / 2.0
    rows = np.arange(height)
    frac = 1.0 - rows / (height - 1)
    if scale == 'linear':
        target = frac * fmax
    elif scale == 'log':
        target = fmin * (fmax / fmin) ** frac
    else:
        def to_mel(f):
            return 2595.0 * np.log10(1.0 + f / 700.0)

        def from_mel(m):
            return 700.0 * (10.0 ** (m / 2595.0) - 1.0)
        target = from_mel(frac * to_mel(fmax))
    bins = np.clip(np.searchsorted(freqs, target), 0, freqs.shape[0] - 1)

    grid = db[:, bins].T
    bright = np.clip((grid + float(gain_db) + float(range_db)) / float(range_db),
                     0.0, 1.0)
    lut = np.array(_lut(colormap), dtype=np.uint8)
    img = lut[(bright * 255).astype(np.uint8)]
    if nframes < width:
        pad = np.zeros((height, width - nframes, 3), dtype=np.uint8)
        pad[:, :] = lut[0]
        img = np.concatenate([img, pad], axis=1)

    out = fresh_output_path('.png', subfolder='comfytv/audio')
    Image.fromarray(img, 'RGB').save(str(out), 'PNG')
    return path_to_view_url(out)


def convolve_ir(view_url: str, ir_url: str, wet: float = 1.0,
                dry: float = 0.0, normalize: bool = True,
                out_codec: str = 'wav', progress=None) -> str:
    import numpy as np
    from scipy.signal import fftconvolve

    x = _decode_audio_to_array(localize(view_url))
    ir = _decode_audio_to_array(localize(ir_url))
    if x.shape[1] == 0:
        raise RuntimeError("convolve: source has no audio")
    if ir.shape[1] == 0:
        raise RuntimeError("convolve: IR has no audio")

    total = x.shape[1] + ir.shape[1] - 1
    report = make_progress(progress, 2, "convolve")
    out = np.zeros((2, total), dtype=np.float32)
    for c in range(2):
        out[c] = fftconvolve(x[c], ir[c], mode='full').astype(np.float32)
        report(c + 1, text=f"convolve {c + 1}/2")
    out *= float(wet)
    if float(dry):
        out[:, :x.shape[1]] += float(dry) * x
    if normalize:
        peak = float(np.abs(out).max())
        if peak > 0.99:
            out *= 0.99 / peak
    return _write_wav(np.clip(out, -1.0, 1.0), out_codec)


def _ess_signals(duration_s: float, fmin: float, fmax: float, amp: float,
                 fade_in_s: float = 0.1, fade_out_s: float = 0.03):
    import numpy as np

    rate = _AUDIO_RATE
    n_pre = int(rate * fade_in_s)
    n_sin = int(rate * duration_s)
    n_end = int(rate * fade_out_s)
    n = n_pre + n_sin + n_end

    a = np.log(fmax / fmin) / n_sin
    b = fmin / (a * rate)
    r = 4.0 * a * a / amp

    i = np.arange(n, dtype=np.float64)
    j = n - i - 1
    gain = np.ones(n)
    if n_pre > 0:
        gain[:n_pre] = np.sin(0.5 * np.pi * i[:n_pre] / n_pre)
    if n_end > 0:
        tail = j < n_end
        gain[tail] = np.sin(0.5 * np.pi * j[tail] / n_end)

    d = b * np.exp(a * (i - n_pre))
    p = d - b
    x = gain * np.sin(2.0 * np.pi * (p - np.floor(p)))

    sweep = (x * amp).astype(np.float32)
    inverse = (x * d * r)[::-1].astype(np.float32)
    return sweep, inverse


def ess_sweep(duration_s: float = 5.0, fmin: float = 20.0,
              fmax: float = 20000.0, amp: float = 0.5,
              tail_s: float = 5.0, out_codec: str = 'wav') -> str:
    import numpy as np

    fmax = min(float(fmax), _AUDIO_RATE * 0.47)
    sweep, _ = _ess_signals(duration_s, fmin, fmax, amp)
    tail = np.zeros(int(round(tail_s * _AUDIO_RATE)), dtype=np.float32)
    mono = np.concatenate([sweep, tail])
    return _write_wav(np.stack([mono, mono]), out_codec)


def deconvolve_ir(recorded_url: str, duration_s: float = 5.0,
                  fmin: float = 20.0, fmax: float = 20000.0,
                  amp: float = 0.5, ir_len_s: float = 2.0,
                  out_codec: str = 'wav') -> str:
    import numpy as np
    from scipy.signal import fftconvolve

    rec = _decode_audio_to_array(localize(recorded_url))
    if rec.shape[1] == 0:
        raise RuntimeError("deconvolve: recording has no audio")
    fmax = min(float(fmax), _AUDIO_RATE * 0.47)
    _, inverse = _ess_signals(duration_s, fmin, fmax, amp)

    ir = np.stack([
        fftconvolve(rec[c], inverse, mode='full').astype(np.float32)
        for c in range(2)
    ])
    onset = int(np.argmax(np.abs(ir).max(axis=0)))
    end = min(ir.shape[1], onset + int(round(ir_len_s * _AUDIO_RATE)))
    ir = ir[:, onset:end]
    peak = float(np.abs(ir).max())
    if peak > 0:
        ir *= 0.99 / peak
    return _write_wav(ir, out_codec)


__all__ = [
    'feedback_echo_array', 'echo_feedback',
    'LOUDNESS_PLATFORMS', 'evaluate_loudness_compliance',
    'mix_audios', 'dither_quantize',
    'audible_segments', 'segment_export',
    'render_waveform_image', 'render_spectrogram_image',
    'convolve_ir', 'ess_sweep', 'deconvolve_ir',
]
