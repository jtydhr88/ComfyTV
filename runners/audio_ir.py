from .media import (
    localize,
    _decode_audio_to_array,
    _AUDIO_RATE,
)
from .media_filter import make_progress
from .audio_dsp import _write_wav


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


__all__ = ['convolve_ir', 'ess_sweep', 'deconvolve_ir']
