import math

import numpy as np

from .media import localize, _decode_audio_to_array, _AUDIO_RATE
from .media_filter import make_progress
from .audio_dsp import _write_wav

SR = _AUDIO_RATE

_DELAYS_8 = (839, 947, 1069, 1213, 1373, 1549, 1753, 1979)
_DELAYS_16 = (839, 887, 947, 1009, 1069, 1151, 1213, 1289,
              1373, 1459, 1549, 1657, 1753, 1861, 1979, 2099)

_ER_TAPS = (
    ((0.0201, 1.0), (0.0382, 0.4), (0.0633, 0.16), (0.0961, 0.064)),
    ((0.0343, 1.0), (0.0548, 0.4), (0.0775, 0.16), (0.1100, 0.064)),
)

_MASK64 = (1 << 64) - 1


def _mix64(z):
    z = (z + 0x9E3779B97F4A7C15) & _MASK64
    z = ((z ^ (z >> 30)) * 0xBF58476D1CE4E5B9) & _MASK64
    z = ((z ^ (z >> 27)) * 0x94D049BB133111EB) & _MASK64
    return (z ^ (z >> 31)) & _MASK64


def _velvet_kernel(seq, length):
    kernel = np.zeros(length, dtype=np.float64)
    positions = set()
    for i in range(15):
        h = _mix64((seq + 1) * 0x9E3779B97F4A7C15 ^ (i + 1))
        pos = h % max(1, length)
        while pos in positions:
            pos = (pos + 17) % length
        positions.add(pos)
        sign = 1.0 if (h >> 33) & 1 else -1.0
        kernel[pos] = sign
    kernel /= math.sqrt(15.0)
    kernel[0] = kernel[0] if kernel[0] != 0 else 0.0
    return kernel


def _db(x):
    return 10.0 ** (x / 20.0)


def _rbj_low_shelf(fc, gain, sr):
    a = math.sqrt(max(1e-9, gain))
    w0 = 2.0 * math.pi * min(0.49 * sr, fc) / sr
    cw, sw = math.cos(w0), math.sin(w0)
    alpha = sw / 2.0 * math.sqrt(2.0)
    b0 = a * ((a + 1) - (a - 1) * cw + 2 * math.sqrt(a) * alpha)
    b1 = 2 * a * ((a - 1) - (a + 1) * cw)
    b2 = a * ((a + 1) - (a - 1) * cw - 2 * math.sqrt(a) * alpha)
    a0 = (a + 1) + (a - 1) * cw + 2 * math.sqrt(a) * alpha
    a1 = -2 * ((a - 1) + (a + 1) * cw)
    a2 = (a + 1) + (a - 1) * cw - 2 * math.sqrt(a) * alpha
    return np.array([b0, b1, b2]) / a0, np.array([1.0, a1 / a0, a2 / a0])


def _rbj_high_shelf(fc, gain, sr):
    a = math.sqrt(max(1e-9, gain))
    w0 = 2.0 * math.pi * min(0.49 * sr, fc) / sr
    cw, sw = math.cos(w0), math.sin(w0)
    alpha = sw / 2.0 * math.sqrt(2.0)
    b0 = a * ((a + 1) + (a - 1) * cw + 2 * math.sqrt(a) * alpha)
    b1 = -2 * a * ((a - 1) + (a + 1) * cw)
    b2 = a * ((a + 1) + (a - 1) * cw - 2 * math.sqrt(a) * alpha)
    a0 = (a + 1) - (a - 1) * cw + 2 * math.sqrt(a) * alpha
    a1 = 2 * ((a - 1) - (a + 1) * cw)
    a2 = (a + 1) - (a - 1) * cw - 2 * math.sqrt(a) * alpha
    return np.array([b0, b1, b2]) / a0, np.array([1.0, a1 / a0, a2 / a0])


def _rbj_peak(fc, q, gain, sr):
    a = math.sqrt(max(1e-9, gain))
    w0 = 2.0 * math.pi * min(0.49 * sr, fc) / sr
    cw, sw = math.cos(w0), math.sin(w0)
    alpha = sw / (2.0 * max(0.05, q))
    b = np.array([1 + alpha * a, -2 * cw, 1 - alpha * a])
    a0 = 1 + alpha / a
    aa = np.array([a0, -2 * cw, 1 - alpha / a])
    return b / a0, aa / a0


def _butter1(fc, sr, high=False):
    from scipy.signal import butter
    fc = min(0.49 * sr, max(5.0, fc))
    return butter(1, fc / (sr / 2.0), btype='high' if high else 'low')


def muse_reverb(x, *, reverb_time_ms=2200.0, room_scale=0.8,
                predelay_ms=10.0, dry_db=0.0, late_db=-14.0, er_db=-14.0,
                er_to_late_db=-20.0, time_low=100.0, time_mid=100.0,
                time_high=60.0, xover_low_mid=400.0, xover_mid_high=4000.0,
                feedback_top=8000.0, mod_freq=1.0, mod_amp=0.2,
                stereo_spread=100.0, quality=16, velvet_out=True,
                low_cut=10.0, high_cut=22000.0, peak_freq=375.0,
                peak_gain_db=0.0, peak_q=1.0, tail_s=None, report=None):
    from scipy.signal import lfilter, fftconvolve
    from scipy.linalg import hadamard

    n_lines = 16 if int(quality) >= 12 else 8
    delays_ref = _DELAYS_16 if n_lines == 16 else _DELAYS_8
    scale = max(0.5, min(4.0, float(room_scale))) * SR / 44100.0

    if tail_s is None:
        tail_s = min(12.0, float(reverb_time_ms) / 1000.0 + 0.5)
    total = x.shape[1] + int(tail_s * SR)
    src = np.zeros((2, total))
    src[:, :x.shape[1]] = x

    pd = int(max(0.0, min(500.0, float(predelay_ms))) * 0.001 * SR)
    work = np.zeros((2, total))
    work[:, pd:] = src[:, :total - pd] if pd else src[:, :total]
    if pd == 0:
        work = src.copy()

    er = np.zeros((2, total))
    for ch in range(2):
        for t_s, g in _ER_TAPS[ch]:
            off = int(t_s * SR)
            er[ch, off:] += work[ch, :total - off] * g
    er_to_late = _db(float(er_to_late_db))
    feed = work + er * er_to_late

    delays = np.array([max(64, int(round(d * scale))) for d in delays_ref])
    min_delay = int(delays.min())
    depth_smp = float(mod_amp) * max(0.5, min(4.0, float(room_scale))) \
        * 0.001 * SR
    block = max(32, min(256, min_delay - int(depth_smp) - 8))

    log_db60 = math.log(_db(-60.0))
    time_smp = max(1.0, float(reverb_time_ms) * 0.001 * SR)
    dps = log_db60 / time_smp
    dps_l = dps / (max(50.0, min(200.0, time_low)) * 0.01)
    dps_m = dps / (max(50.0, min(200.0, time_mid)) * 0.01)
    dps_h = dps / (max(50.0, min(200.0, time_high)) * 0.01)

    shelf1 = []
    shelf2 = []
    gm_list = []
    ag_list = []
    for i in range(n_lines):
        dt = delays_ref[i] * scale
        gl = math.exp(dt * dps_l)
        gm = math.exp(dt * dps_m)
        gh = math.exp(dt * dps_h)
        shelf1.append(_rbj_low_shelf(xover_low_mid, gl / gm, SR))
        shelf2.append(_rbj_high_shelf(xover_mid_high, gh / gm, SR))
        gm_list.append(gm)
        ag = math.exp(dt * dps_h * 0.5)
        ag_list.append(ag)
    ag_b, ag_a = _butter1(float(feedback_top), SR)

    hmat = hadamard(n_lines).astype(np.float64) / math.sqrt(n_lines)

    buf_len = int(delays.max() + depth_smp + block + 8)
    rings = np.zeros((n_lines, buf_len))
    z1 = [np.zeros(2) for _ in range(n_lines)]
    z2 = [np.zeros(2) for _ in range(n_lines)]
    z_ag = [np.zeros(1) for _ in range(n_lines)]
    delay_out = np.zeros((n_lines, total))

    line_phase = 2.0 * math.pi * np.arange(n_lines) / n_lines
    wp = 0
    n_blocks = (total + block - 1) // block
    for bi in range(n_blocks):
        s0 = bi * block
        n = min(block, total - s0)
        tt = (s0 + np.arange(n)) / SR
        mod_t = np.floor(tt * SR / 32.0) * 32.0 / SR
        outs = np.empty((n_lines, n))
        for i in range(n_lines):
            mod = depth_smp * np.sin(
                2.0 * math.pi * float(mod_freq) * mod_t + line_phase[i])
            pos = (wp + np.arange(n) - delays[i] + mod) % buf_len
            i0 = np.floor(pos).astype(np.int64)
            frac = pos - i0
            i1 = (i0 + 1) % buf_len
            raw = rings[i, i0] * (1.0 - frac) + rings[i, i1] * frac
            lp, z_ag[i] = lfilter(ag_b, ag_a, raw, zi=z_ag[i])
            y = lp + ag_list[i] * (raw - lp)
            b1c, a1c = shelf1[i]
            y, z1[i] = lfilter(b1c, a1c, y, zi=z1[i])
            b2c, a2c = shelf2[i]
            y, z2[i] = lfilter(b2c, a2c, y, zi=z2[i])
            outs[i] = y * gm_list[i]
        delay_out[:, s0:s0 + n] = outs
        mixed = hmat @ outs
        idx = (wp + np.arange(n)) % buf_len
        for i in range(n_lines):
            rings[i, idx] = mixed[i] + feed[i & 1, s0:s0 + n]
        wp = (wp + n) % buf_len
        if report and bi % 64 == 0:
            report(bi)

    if velvet_out:
        for i in range(n_lines):
            kern = _velvet_kernel(i, int(SR * 0.03))
            delay_out[i] = fftconvolve(delay_out[i], kern)[:total]

    late = np.zeros((2, total))
    for j in range(0, n_lines, 4):
        late[0] += delay_out[j] - delay_out[j + 3]
        late[1] += delay_out[j + 2] - delay_out[j + 1]
    left = late[0] + late[1]
    right = late[0] - late[1]

    correction = 1.0 / math.exp(delays_ref[0] * scale * dps)
    late_gain = _db(float(late_db)) * correction / math.sqrt(n_lines)
    out = np.stack([left, right]) * late_gain

    out += er * _db(float(er_db))

    sf = max(0.0, min(1.5, float(stereo_spread) * 0.01))
    s1 = math.sqrt(0.5 * (1 + sf))
    s2 = math.copysign(math.sqrt(abs(0.5 * (1 - sf))), 0.5 * (1 - sf))
    mixed_lr = np.stack([out[0] * s1 + out[1] * s2,
                         out[1] * s1 + out[0] * s2])
    out = mixed_lr

    if float(peak_gain_db) != 0.0:
        b, a = _rbj_peak(peak_freq, peak_q, _db(peak_gain_db), SR)
        out = np.stack([lfilter(b, a, out[0]), lfilter(b, a, out[1])])
    if low_cut > 12.0:
        b, a = _butter1(low_cut, SR, high=True)
        out = np.stack([lfilter(b, a, out[0]), lfilter(b, a, out[1])])
    if high_cut < 21000.0:
        b, a = _butter1(high_cut, SR)
        out = np.stack([lfilter(b, a, out[0]), lfilter(b, a, out[1])])

    out += src * _db(float(dry_db))
    peak = np.abs(out).max()
    if peak > 0.98:
        out = out / peak * 0.98
    return out.astype(np.float32)


def muse_reverb_audio(view_url: str, *, progress=None, **params) -> str:
    arr = _decode_audio_to_array(localize(view_url)).astype(np.float64)
    if arr.shape[1] == 0:
        raise RuntimeError("muse reverb: source has no audio")
    tail = min(12.0, float(params.get('reverb_time_ms', 2200.0)) / 1000.0
               + 0.5)
    n_blocks = (arr.shape[1] + int(tail * SR)) // 256 + 1
    report = make_progress(progress, max(1, n_blocks), "reverberating")
    y = muse_reverb(arr, report=report, **params)
    return _write_wav(y)


__all__ = ['muse_reverb', 'muse_reverb_audio']
