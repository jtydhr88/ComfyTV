import io
import struct

import numpy as np

from .media import _AUDIO_RATE

SR = _AUDIO_RATE

_GEN_START_OFS = 0
_GEN_END_OFS = 1
_GEN_STARTLOOP_OFS = 2
_GEN_ENDLOOP_OFS = 3
_GEN_VIB_LFO_TO_PITCH = 6
_GEN_FILTER_FC = 8
_GEN_FILTER_Q = 9
_GEN_PAN = 17
_GEN_DELAY_VIB_LFO = 23
_GEN_FREQ_VIB_LFO = 24
_GEN_INSTRUMENT = 41
_GEN_KEYRANGE = 43
_GEN_VELRANGE = 44
_GEN_ATTENUATION = 48
_GEN_COARSE_TUNE = 51
_GEN_FINE_TUNE = 52
_GEN_SAMPLE_ID = 53
_GEN_SAMPLE_MODES = 54
_GEN_SCALE_TUNING = 56
_GEN_ROOT_KEY = 58
_GEN_DELAY = 33
_GEN_ATTACK = 34
_GEN_HOLD = 35
_GEN_DECAY = 36
_GEN_SUSTAIN = 37
_GEN_RELEASE = 38

_ENV_GENS = (_GEN_DELAY, _GEN_ATTACK, _GEN_HOLD, _GEN_DECAY, _GEN_RELEASE)

_DEFAULTS = {
    _GEN_PAN: 0, _GEN_ATTENUATION: 0, _GEN_COARSE_TUNE: 0,
    _GEN_FINE_TUNE: 0, _GEN_SCALE_TUNING: 100, _GEN_ROOT_KEY: -1,
    _GEN_SAMPLE_MODES: 0, _GEN_DELAY: -12000, _GEN_ATTACK: -12000,
    _GEN_HOLD: -12000, _GEN_DECAY: -12000, _GEN_SUSTAIN: 0,
    _GEN_RELEASE: -12000,
    _GEN_START_OFS: 0, _GEN_END_OFS: 0, _GEN_STARTLOOP_OFS: 0,
    _GEN_ENDLOOP_OFS: 0,
    _GEN_VIB_LFO_TO_PITCH: 0, _GEN_FILTER_FC: 13500, _GEN_FILTER_Q: 0,
    _GEN_DELAY_VIB_LFO: -12000, _GEN_FREQ_VIB_LFO: 0,
}


def _tc2sec(tc):
    return 0.0 if tc <= -12000 else 2.0 ** (min(8000.0, float(tc)) / 1200.0)


def _cb2amp(cb):
    return 10.0 ** (-max(0.0, float(cb)) / 200.0)


class Sf2File:

    def __init__(self, path):
        data = open(path, 'rb').read()
        if data[:4] != b'RIFF' or data[8:12] != b'sfbk':
            raise RuntimeError("soundfont: not a RIFF sfbk file")
        self._chunks = {}
        self._walk(data, 12, len(data))
        self.sample_data = self._decode_samples()
        self.phdr = self._records('phdr', 38)
        self.pbag = self._records('pbag', 4)
        self.pgen = self._records('pgen', 4)
        self.inst = self._records('inst', 22)
        self.ibag = self._records('ibag', 4)
        self.igen = self._records('igen', 4)
        self.shdr = self._records('shdr', 46)
        self._presets = self._build_presets()
        self._sample_cache = {}

    def _walk(self, data, pos, end):
        while pos + 8 <= end:
            cid = data[pos:pos + 4]
            size = struct.unpack('<I', data[pos + 4:pos + 8])[0]
            body = pos + 8
            if cid == b'LIST':
                self._walk(data, body + 4, body + size)
            else:
                self._chunks[cid.decode('ascii', 'ignore').strip()] = \
                    data[body:body + size]
            pos = body + size + (size & 1)

    def _records(self, name, rec_size):
        raw = self._chunks.get(name, b'')
        return [raw[i:i + rec_size] for i in range(0, len(raw) - rec_size + 1,
                                                   rec_size)]

    def _decode_samples(self):
        smpl = self._chunks.get('smpl', b'')
        if not smpl:
            raise RuntimeError("soundfont: no sample data")
        return smpl

    def _bag_gens(self, bags, gens, bag_idx):
        g0 = struct.unpack('<H', bags[bag_idx][0:2])[0]
        g1 = struct.unpack('<H', bags[bag_idx + 1][0:2])[0] \
            if bag_idx + 1 < len(bags) else len(gens)
        out = {}
        for gi in range(g0, min(g1, len(gens))):
            oper = struct.unpack('<H', gens[gi][0:2])[0]
            amount = struct.unpack('<h', gens[gi][2:4])[0]
            if oper in (_GEN_KEYRANGE, _GEN_VELRANGE):
                lo, hi = gens[gi][2], gens[gi][3]
                out[oper] = (lo, hi)
            else:
                out[oper] = amount
        return out

    def _build_presets(self):
        presets = {}
        for i in range(len(self.phdr) - 1):
            rec = self.phdr[i]
            name = rec[0:20].split(b'\0')[0].decode('latin-1')
            program, bank, bag0 = struct.unpack('<HHH', rec[20:26])
            bag1 = struct.unpack('<H', self.phdr[i + 1][24:26])[0]
            zones = []
            global_gens = {}
            for bi in range(bag0, bag1):
                gens = self._bag_gens(self.pbag, self.pgen, bi)
                if _GEN_INSTRUMENT not in gens:
                    if bi == bag0:
                        global_gens = gens
                    continue
                merged = dict(global_gens)
                merged.update(gens)
                zones.append(merged)
            presets[(bank, program)] = {'name': name, 'zones': zones}
        return presets

    def _inst_zones(self, inst_idx):
        rec = self.inst[inst_idx]
        bag0 = struct.unpack('<H', rec[20:22])[0]
        bag1 = struct.unpack('<H', self.inst[inst_idx + 1][20:22])[0] \
            if inst_idx + 1 < len(self.inst) else len(self.ibag) - 1
        zones = []
        global_gens = {}
        for bi in range(bag0, bag1):
            gens = self._bag_gens(self.ibag, self.igen, bi)
            if _GEN_SAMPLE_ID not in gens:
                if bi == bag0:
                    global_gens = gens
                continue
            merged = dict(global_gens)
            merged.update(gens)
            zones.append(merged)
        return zones

    def _sample(self, sample_idx):
        if sample_idx in self._sample_cache:
            return self._sample_cache[sample_idx]
        rec = self.shdr[sample_idx]
        name = rec[0:20].split(b'\0')[0].decode('latin-1')
        start, end, loop_start, loop_end, srate = struct.unpack(
            '<IIIII', rec[20:40])
        pitch, correction = rec[40], struct.unpack('<b', rec[41:42])[0]
        stype = struct.unpack('<H', rec[44:46])[0]
        if stype & 0x10:
            raw = self.sample_data[start:end]
            pcm = _decode_ogg(raw)
            loop_start = min(loop_start, max(0, pcm.size - 1))
            loop_end = min(loop_end, pcm.size)
        else:
            pcm = np.frombuffer(self.sample_data,
                                dtype='<i2')[start:end] \
                .astype(np.float32) / 32768.0
            loop_start = loop_start - start
            loop_end = loop_end - start
        info = {'name': name, 'pcm': pcm, 'srate': max(8000, srate),
                'root': pitch if pitch < 128 else 60,
                'correction': correction,
                'loop_start': int(max(0, loop_start)),
                'loop_end': int(max(0, min(loop_end, pcm.size)))}
        self._sample_cache[sample_idx] = info
        return info

    def voices_for(self, bank, program, key, vel):
        preset = self._presets.get((bank, program))
        if preset is None and bank == 128:
            preset = self._presets.get((128, 0))
        if preset is None:
            preset = self._presets.get((0, program)) \
                or self._presets.get((0, 0))
        if preset is None:
            return []
        out = []
        for pzone in preset['zones']:
            if not _in_range(pzone, key, vel):
                continue
            inst_idx = pzone[_GEN_INSTRUMENT]
            if inst_idx >= len(self.inst) - 1:
                continue
            for izone in self._inst_zones(inst_idx):
                if not _in_range(izone, key, vel):
                    continue
                gens = {}
                for oper, default in _DEFAULTS.items():
                    val = izone.get(oper, default)
                    if oper in pzone and oper not in (_GEN_KEYRANGE,
                                                      _GEN_VELRANGE):
                        val = val + pzone[oper]
                    gens[oper] = val
                sample_idx = izone[_GEN_SAMPLE_ID]
                if sample_idx >= len(self.shdr) - 1:
                    continue
                out.append((gens, self._sample(sample_idx)))
        return out


def _in_range(zone, key, vel):
    kr = zone.get(_GEN_KEYRANGE)
    if kr is not None and not (kr[0] <= key <= kr[1]):
        return False
    vr = zone.get(_GEN_VELRANGE)
    if vr is not None and not (vr[0] <= vel <= vr[1]):
        return False
    return True


def _decode_ogg(raw):
    import av

    buf = io.BytesIO(raw)
    chunks = []
    with av.open(buf) as c:
        for frame in c.decode(c.streams.audio[0]):
            arr = frame.to_ndarray()
            if arr.ndim > 1:
                arr = arr.mean(axis=0)
            chunks.append(arr.astype(np.float32))
    if not chunks:
        return np.zeros(1, dtype=np.float32)
    pcm = np.concatenate(chunks)
    if pcm.dtype != np.float32:
        pcm = pcm.astype(np.float32)
    if np.abs(pcm).max() > 2.0:
        pcm = pcm / 32768.0
    return pcm


def _vel_to_cb(vel):
    v = max(1, min(127, int(vel))) / 127.0
    return -200.0 * np.log10(v * v) if v < 1.0 else 0.0


def _render_voice(gens, sample, key, vel, dur):
    pcm = sample['pcm']
    if pcm.size < 8:
        return None
    root = gens[_GEN_ROOT_KEY] if gens[_GEN_ROOT_KEY] >= 0 \
        else sample['root']
    cents = (key - root) * gens[_GEN_SCALE_TUNING] \
        + gens[_GEN_COARSE_TUNE] * 100 + gens[_GEN_FINE_TUNE] \
        + sample['correction']
    ratio = (2.0 ** (cents / 1200.0)) * sample['srate'] / SR

    attack = _tc2sec(gens[_GEN_ATTACK])
    hold = _tc2sec(gens[_GEN_HOLD])
    decay = _tc2sec(gens[_GEN_DECAY])
    release = max(0.01, _tc2sec(gens[_GEN_RELEASE]))
    delay = _tc2sec(gens[_GEN_DELAY])
    sustain_amp = _cb2amp(min(1440, max(0, gens[_GEN_SUSTAIN])))

    total_s = delay + dur + release + 0.05
    n = int(total_s * SR)
    if n <= 0:
        return None

    loop_mode = gens[_GEN_SAMPLE_MODES] & 3
    loop_start = sample['loop_start'] + gens[_GEN_STARTLOOP_OFS]
    loop_end = sample['loop_end'] + gens[_GEN_ENDLOOP_OFS]
    looped = loop_mode in (1, 3) and loop_end - loop_start >= 4

    vib_cents = float(gens[_GEN_VIB_LFO_TO_PITCH])
    if abs(vib_cents) >= 1.0:
        tv = np.arange(n, dtype=np.float64) / SR
        vib_delay = _tc2sec(gens[_GEN_DELAY_VIB_LFO])
        vib_freq = 8.176 * 2.0 ** (float(gens[_GEN_FREQ_VIB_LFO]) / 1200.0)
        lfo = np.sin(2.0 * np.pi * vib_freq * (tv - vib_delay))
        lfo[tv < vib_delay] = 0.0
        ratio_t = ratio * 2.0 ** (vib_cents * lfo / 1200.0)
        pos = np.concatenate([[0.0], np.cumsum(ratio_t[:-1])])
    else:
        pos = np.arange(n, dtype=np.float64) * ratio
    if looped:
        beyond = pos >= loop_end
        span = loop_end - loop_start
        pos[beyond] = loop_start + np.mod(pos[beyond] - loop_start, span)
    else:
        pos = np.clip(pos, 0, pcm.size - 1.001)
    idx = pos.astype(np.int64)
    frac = (pos - idx).astype(np.float32)
    idx1 = np.minimum(idx + 1, pcm.size - 1)
    sig = pcm[idx] * (1.0 - frac) + pcm[idx1] * frac
    if not looped:
        cutoff = int(min(n, max(1, (pcm.size / ratio))))
        if cutoff < n:
            sig[cutoff:] = 0.0

    fc_hz = 8.176 * 2.0 ** (float(gens[_GEN_FILTER_FC]) / 1200.0)
    if fc_hz < 18000.0:
        from scipy.signal import lfilter
        fc_hz = max(100.0, min(18000.0, fc_hz))
        q = 0.707 * 10.0 ** (max(0, gens[_GEN_FILTER_Q]) / 200.0)
        w0 = 2.0 * np.pi * fc_hz / SR
        alpha = np.sin(w0) / (2.0 * q)
        cw = np.cos(w0)
        b = np.array([(1 - cw) / 2, 1 - cw, (1 - cw) / 2])
        a = np.array([1 + alpha, -2 * cw, 1 - alpha])
        sig = lfilter(b / a[0], a / a[0], sig).astype(np.float32)

    t = np.arange(n, dtype=np.float32) / SR
    env = np.zeros(n, dtype=np.float32)
    t0 = delay
    t1 = t0 + max(1e-4, attack)
    t2 = t1 + hold
    ramp = np.clip((t - t0) / max(1e-4, attack), 0.0, 1.0)
    env = ramp.copy()
    after_hold = t > t2
    if decay > 1e-4 and sustain_amp < 1.0:
        dec = np.power(
            10.0,
            -np.clip((t - t2) / decay, 0.0, 1.0) * 5.0)
        dec = np.maximum(dec, sustain_amp)
        env = np.where(after_hold, ramp * dec, env)
    note_off = delay + dur
    rel_region = t > note_off
    if rel_region.any():
        rel_exp = np.clip(-(t - note_off) / release * 4.8, -300.0, 0.0)
        rel = np.power(10.0, rel_exp)
        env = np.where(rel_region, env * rel, env)

    atten_cb = min(1440.0, max(0.0, gens[_GEN_ATTENUATION] * 0.4)) \
        + _vel_to_cb(vel)
    amp = _cb2amp(atten_cb)
    pan = max(-500, min(500, gens[_GEN_PAN])) / 1000.0 + 0.5
    return sig * env * amp, pan


def render_sf2(performance: dict, soundfont_path: str, *, programs=None,
               gain=1.0, report=None):
    sf = load_soundfont(soundfont_path)
    events = performance.get('events') or []
    if not events:
        raise RuntimeError("sf2 synth: no events")
    programs = programs or {}
    total = max(e['t'] + e['dur'] for e in events) + 2.0
    buf = np.zeros((2, int(SR * total)), dtype=np.float64)
    for i, e in enumerate(events):
        ch = int(e.get('ch', 0))
        bank = 128 if ch == 9 else 0
        program = 0 if ch == 9 else int(programs.get(ch, 0))
        key = int(e['midi'])
        vel = int(e.get('vel', 96))
        for gens, sample in sf.voices_for(bank, program, key, vel):
            rendered = _render_voice(gens, sample, key, vel,
                                     float(e['dur']))
            if rendered is None:
                continue
            sig, pan = rendered
            i0 = int(float(e['t']) * SR)
            i1 = min(buf.shape[1], i0 + sig.size)
            if i1 <= i0:
                continue
            buf[0, i0:i1] += sig[:i1 - i0] * (1.0 - pan)
            buf[1, i0:i1] += sig[:i1 - i0] * pan
        if report and i % 32 == 0:
            report(i)
    peak = np.abs(buf).max()
    if peak > 1e-9:
        buf = buf / peak * min(0.9, 0.85 * float(gain))
    return buf.astype(np.float32)


_SF_CACHE = {}


def load_soundfont(path):
    key = str(path)
    if key not in _SF_CACHE:
        if len(_SF_CACHE) > 2:
            _SF_CACHE.clear()
        _SF_CACHE[key] = Sf2File(path)
    return _SF_CACHE[key]


__all__ = ['Sf2File', 'load_soundfont', 'render_sf2']
