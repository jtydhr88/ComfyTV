import json
import math

import numpy as np

from .media import localize, _decode_audio_to_array, _AUDIO_RATE

_FFT = 1024
_HOP = 512

MIR_MODES = ('beats', 'onsets', 'notes')


def _princarg(p):
    return p - 2.0 * np.pi * np.round(p / (2.0 * np.pi))


def _detection_function(x):
    win = np.hanning(_FFT)
    n_frames = max(1, (x.shape[-1] - _FFT) // _HOP + 1)
    mono = x.mean(axis=0)
    df = np.zeros(n_frames)
    mag_hist = np.zeros(_FFT // 2 + 1)
    ph_hist = np.zeros(_FFT // 2 + 1)
    ph_hist_old = np.zeros(_FFT // 2 + 1)
    for i in range(n_frames):
        frame = mono[i * _HOP:i * _HOP + _FFT]
        if frame.shape[0] < _FFT:
            frame = np.pad(frame, (0, _FFT - frame.shape[0]))
        spec = np.fft.rfft(frame * win)
        mag = np.abs(spec)
        ph = np.angle(spec)
        dev = _princarg(ph - 2.0 * ph_hist + ph_hist_old)
        meas = mag_hist - mag * np.exp(1j * dev)
        df[i] = np.sqrt(meas.real ** 2 + meas.imag ** 2).sum()
        ph_hist_old = ph_hist
        ph_hist = ph
        mag_hist = mag
    return df


def _adaptive_df(df, window=16):
    if df.size == 0:
        return df
    pad = np.pad(df, (window, window), mode='edge')
    med = np.array([np.median(pad[i:i + 2 * window + 1])
                    for i in range(df.size)])
    out = df - med
    out[out < 0] = 0.0
    m = out.max()
    return out / m if m > 1e-12 else out

def _frame_time(i):
    return i * _HOP / _AUDIO_RATE


def onset_times(df, threshold=0.3, min_gap_s=0.05):
    gap = max(1, int(min_gap_s * _AUDIO_RATE / _HOP))
    times = []
    last = -gap
    for i in range(1, df.size - 1):
        if df[i] >= threshold and df[i] >= df[i - 1] \
                and df[i] >= df[i + 1] and i - last >= gap:
            times.append(_frame_time(i))
            last = i
    return times


def _estimate_period(df):
    n = df.size
    if n < 32:
        return 0.0
    acf = np.correlate(df, df, mode='full')[n - 1:]
    acf = acf / max(1e-12, acf[0])
    rayparam = 43.0 * (512.0 / _HOP) * (_AUDIO_RATE / 44100.0)
    lags = np.arange(n, dtype=np.float64)
    wv = (lags / rayparam ** 2) * np.exp(-(lags ** 2)
                                         / (2.0 * rayparam ** 2))
    lo = max(2, int(0.23 * _AUDIO_RATE / _HOP))
    hi = min(n - 1, int(1.6 * _AUDIO_RATE / _HOP))
    if hi <= lo:
        return 0.0
    score = acf[:n] * wv
    period = float(np.argmax(score[lo:hi]) + lo)
    return period


def beat_track(df, alpha=0.9, tightness=4.0):
    period = _estimate_period(df)
    if period <= 0:
        return [], 0.0
    n = df.size
    cumscore = np.zeros(n)
    backlink = np.full(n, -1, dtype=np.int64)
    for i in range(n):
        prange_min = int(-2 * period)
        prange_max = int(round(-0.5 * period))
        best_v = 0.0
        best_j = -1
        for j in range(prange_max - prange_min + 1):
            idx = i + prange_min + j
            if idx < 0:
                continue
            lag = round(2 * period) - j
            if lag <= 0:
                continue
            txwt = math.exp(-0.5 * (tightness
                                    * math.log(lag / period)) ** 2)
            v = txwt * cumscore[idx]
            if v > best_v:
                best_v = v
                best_j = idx
        cumscore[i] = alpha * best_v + (1.0 - alpha) * df[i]
        backlink[i] = best_j
    tail = max(1, int(period))
    start = int(np.argmax(cumscore[-tail:])) + n - tail
    beats_idx = [start]
    while backlink[beats_idx[-1]] > 0:
        b = backlink[beats_idx[-1]]
        if b == beats_idx[-1]:
            break
        beats_idx.append(int(b))
    beats_idx.reverse()
    bpm = 60.0 * _AUDIO_RATE / (_HOP * period)
    return [_frame_time(i) for i in beats_idx], bpm


def _yin_pitch(frame, sr, fmin=60.0, fmax=1200.0, threshold=0.12):
    n = frame.shape[0]
    tau_max = min(n - 1, int(sr / fmin))
    tau_min = max(2, int(sr / fmax))
    if tau_max <= tau_min:
        return 0.0
    f = np.fft.rfft(frame, 2 * n)
    acf = np.fft.irfft(f * np.conj(f))[:tau_max + 1]
    cum = np.cumsum(frame ** 2)
    energy = cum[-1] - np.concatenate([[0.0], cum[:-1]])[:tau_max + 1]
    d = energy[0] + energy - 2.0 * acf
    d = d[:tau_max + 1]
    cmnd = np.ones_like(d)
    running = np.cumsum(d[1:])
    cmnd[1:] = d[1:] * np.arange(1, d.size) / np.maximum(running, 1e-12)
    for tau in range(tau_min, tau_max):
        if cmnd[tau] < threshold and cmnd[tau] <= cmnd[tau + 1]:
            if 0 < tau < d.size - 1:
                a, b, c = cmnd[tau - 1], cmnd[tau], cmnd[tau + 1]
                denom = a + c - 2 * b
                shift = 0.5 * (a - c) / denom if abs(denom) > 1e-12 else 0.0
                return sr / (tau + max(-0.5, min(0.5, shift)))
            return sr / tau
    return 0.0


def extract_notes(x, *, min_note_s=0.1, median_frames=5):
    mono = x.mean(axis=0)
    frame_len = 2048
    hop = 512
    n_frames = max(0, (mono.shape[0] - frame_len) // hop + 1)
    pitches = np.zeros(n_frames)
    for i in range(n_frames):
        pitches[i] = _yin_pitch(mono[i * hop:i * hop + frame_len],
                                _AUDIO_RATE)
    k = max(1, int(median_frames))
    smooth = np.array([
        np.median(pitches[max(0, i - k // 2):i + k // 2 + 1])
        for i in range(n_frames)])
    midi = np.where(smooth > 0,
                    69.0 + 12.0 * np.log2(np.maximum(smooth, 1e-6) / 440.0),
                    -1.0)
    notes = []
    cur = None
    for i in range(n_frames):
        t = i * hop / _AUDIO_RATE
        m = round(float(midi[i])) if midi[i] > 0 else -1
        if cur is not None and (m != cur['midi']):
            cur['end'] = t
            if cur['midi'] >= 0 and cur['end'] - cur['start'] >= min_note_s:
                notes.append(cur)
            cur = None
        if cur is None and m >= 0:
            cur = {'start': t, 'end': t, 'midi': m}
    if cur is not None:
        cur['end'] = n_frames * hop / _AUDIO_RATE
        if cur['midi'] >= 0 and cur['end'] - cur['start'] >= min_note_s:
            notes.append(cur)
    names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#',
             'B']
    out = []
    for nt in notes:
        octave = nt['midi'] // 12 - 1
        out.append({'start': round(nt['start'], 4),
                    'end': round(nt['end'], 4),
                    'text': f"{names[nt['midi'] % 12]}{octave}",
                    'midi': int(nt['midi'])})
    return out


def _pulse_keyframes(times, field='v', pulse_s=0.09):
    keys = []
    for t in times:
        keys.append({'t': round(t, 4), field: 1.0, 'interp': 'linear'})
        keys.append({'t': round(t + pulse_s, 4), field: 0.0,
                     'interp': 'linear'})
    return keys


def mir_analyze(view_url: str, *, mode='beats', threshold=0.3,
                min_gap_s=0.05, field='v', progress=None):
    if mode not in MIR_MODES:
        raise RuntimeError(f"audio mir: unknown mode {mode!r}")
    x = _decode_audio_to_array(localize(view_url)).astype(np.float64)
    if x.shape[1] < _FFT * 2:
        raise RuntimeError("audio mir: source has no (or too little) audio")

    if mode == 'notes':
        labels = extract_notes(x)
        keys = [{'t': nt['start'], field: (nt['midi'] - 60) / 12.0,
                 'interp': 'hold'} for nt in labels]
        return {'labels': json.dumps(labels),
                'keyframes': json.dumps(keys), 'bpm': 0.0}

    df = _adaptive_df(_detection_function(x))
    if mode == 'onsets':
        times = onset_times(df, threshold=threshold, min_gap_s=min_gap_s)
        labels = [{'start': round(t, 4), 'end': round(t, 4),
                   'text': f'onset {i + 1}'} for i, t in enumerate(times)]
        return {'labels': json.dumps(labels),
                'keyframes': json.dumps(_pulse_keyframes(times, field)),
                'bpm': 0.0}

    times, bpm = beat_track(df)
    labels = [{'start': round(t, 4), 'end': round(t, 4),
               'text': f'beat {i + 1}'} for i, t in enumerate(times)]
    return {'labels': json.dumps(labels),
            'keyframes': json.dumps(_pulse_keyframes(times, field)),
            'bpm': round(bpm, 2)}


__all__ = ['mir_analyze', 'onset_times', 'beat_track', 'extract_notes',
           'MIR_MODES']
