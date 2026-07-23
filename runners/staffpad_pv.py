import math

import numpy as np

from .media import localize, _decode_audio_to_array
from .media_filter import make_progress
from .audio_dsp import _write_wav

_FFT = 4096
_HOP_A = 512
_TWO_PI = 2.0 * math.pi


def _princarg(p):
    return p - _TWO_PI * np.round(p / _TWO_PI)


def _frame_peaks(norms_last, norms):
    n_bins = norms.shape[-1]
    peaks = []
    troughs = []
    lowest = norms[0]
    trough = 0
    if norms_last[0] >= norms[1]:
        peaks.append(0)
        troughs.append(0)
    for i in range(1, n_bins - 1):
        if norms_last[i] >= norms[i - 1] and norms_last[i] >= norms[i + 1]:
            peaks.append(i)
            troughs.append(trough)
            trough = i
            lowest = norms[i]
        elif norms[i] < lowest:
            lowest = norms[i]
            trough = i
    if norms_last[n_bins - 1] > norms[n_bins - 2]:
        peaks.append(n_bins - 1)
        troughs.append(trough)
    if not peaks:
        peaks = [int(np.argmax(norms_last))]
        troughs = [0]
    return np.asarray(peaks), np.asarray(troughs)


def _propagate_phase(acc, phase, last_phase, norms, norms_last,
                     hop_a, hop_s):
    n_bins = acc.shape[-1]
    alpha = hop_s / hop_a
    exp_per_bin = _TWO_PI / _FFT
    peaks, troughs = _frame_peaks(norms_last, norms)

    fn = peaks.astype(np.float64)
    d = _princarg(phase[:, peaks] - last_phase[:, peaks]
                  - fn * (hop_a * exp_per_bin))
    acc[:, peaks] = acc[:, peaks] + alpha * d + fn * (hop_s * exp_per_bin)

    adj = _princarg(phase[:, 1:] - phase[:, :-1])
    prefix = np.concatenate(
        [np.zeros((acc.shape[0], 1)), np.cumsum(adj, axis=-1)], axis=-1)

    bounds = np.empty(len(peaks) + 1, dtype=np.int64)
    bounds[0] = 0
    bounds[-1] = n_bins
    for i in range(1, len(peaks)):
        mid = troughs[i]
        bounds[i] = max(peaks[i - 1] + 1, min(mid + 1, peaks[i]))
    owner = np.repeat(np.arange(len(peaks)),
                      np.diff(bounds).clip(min=0))
    owner_peak = peaks[owner]
    bins = np.arange(n_bins)
    acc[:, bins] = acc[:, owner_peak] + alpha * (
        prefix[:, bins] - prefix[:, owner_peak])
    return acc


def time_stretch_pv(x, stretch, report=None):
    n_ch, total = x.shape
    stretch = max(0.25, min(4.0, float(stretch)))
    win = np.hanning(_FFT).astype(np.float64)
    exact_hop_s = _HOP_A * stretch
    hop_err = 0.0

    n_frames = max(2, (total - _FFT) // _HOP_A + 1)
    out_len = int(total * stretch) + _FFT
    out = np.zeros((n_ch, out_len))
    norm_buf = np.zeros(out_len)

    acc = np.zeros((n_ch, _FFT // 2 + 1))
    last_phase = np.zeros_like(acc)
    norms_last = np.ones(_FFT // 2 + 1)
    out_pos = 0

    for fi in range(n_frames):
        start = fi * _HOP_A
        frame = x[:, start:start + _FFT]
        if frame.shape[1] < _FFT:
            frame = np.pad(frame, ((0, 0), (0, _FFT - frame.shape[1])))
        spec = np.fft.rfft(frame * win, axis=-1)
        norms = np.abs(spec)
        phase = np.angle(spec)
        mid_norm = norms.mean(axis=0)

        want = exact_hop_s + hop_err
        hop_s = int(round(want))
        hop_err = want - hop_s

        if fi == 0:
            acc[:] = phase
        else:
            acc = _propagate_phase(acc, phase, last_phase, mid_norm,
                                   norms_last, _HOP_A, hop_s)
        last_phase = phase
        norms_last = mid_norm

        synth = np.fft.irfft(norms * np.exp(1j * acc), n=_FFT, axis=-1)
        seg = synth * win
        if out_pos + _FFT <= out_len:
            out[:, out_pos:out_pos + _FFT] += seg
            norm_buf[out_pos:out_pos + _FFT] += win * win
        out_pos += hop_s
        if report and fi % 64 == 0:
            report(fi)

    out = out / np.maximum(norm_buf, 1e-6)
    return np.clip(out[:, :int(total * stretch)], -1.0, 1.0)


def pitch_shift_pv(x, semitones, report=None):
    from scipy.signal import resample_poly
    from fractions import Fraction

    ratio = 2.0 ** (float(semitones) / 12.0)
    stretched = time_stretch_pv(x, ratio, report=report)
    frac = Fraction(ratio).limit_denominator(200)
    y = resample_poly(stretched, frac.denominator, frac.numerator, axis=-1)
    n = min(y.shape[-1], x.shape[-1])
    return np.clip(y[:, :n], -1.0, 1.0)


def pv_process_audio(view_url: str, *, mode='pitch', semitones=0.0,
                     stretch=1.0, progress=None) -> str:
    arr = _decode_audio_to_array(localize(view_url)).astype(np.float64)
    if arr.shape[1] < _FFT:
        raise RuntimeError("time/pitch HQ: source too short")
    n_frames = max(1, (arr.shape[1] - _FFT) // _HOP_A + 1)
    report = make_progress(progress, n_frames, "vocoding")
    if mode == 'stretch':
        y = time_stretch_pv(arr, stretch, report=report)
    else:
        y = pitch_shift_pv(arr, semitones, report=report)
    return _write_wav(y.astype(np.float32))


__all__ = ['time_stretch_pv', 'pitch_shift_pv', 'pv_process_audio']
