import hashlib
import os
import struct
from pathlib import Path

_DEFAULT_USEC = 500000
_TWO_DATA = (0x80, 0x90, 0xA0, 0xB0, 0xE0)

MIDI_SUFFIXES = ('.mid', '.midi')
_RENDER_SUBFOLDER = 'comfytv/midi_render'


class _Reader:
    def __init__(self, data):
        self.data = data
        self.pos = 0

    def read(self, n):
        end = self.pos + n
        if end > len(self.data):
            raise RuntimeError('bad midifile: unexpected EOF')
        out = self.data[self.pos:end]
        self.pos = end
        return out

    def u8(self):
        return self.read(1)[0]

    def u16(self):
        return struct.unpack('>H', self.read(2))[0]

    def u32(self):
        return struct.unpack('>I', self.read(4))[0]

    def vlq(self):
        value = 0
        for _ in range(16):
            c = self.u8()
            value += c & 0x7F
            if not c & 0x80:
                return value
            value <<= 7
        return -1


def _read_track(r):
    if bytes(r.read(4)) != b'MTrk':
        raise RuntimeError('bad midifile: MTrk expected')
    end = r.u32() + r.pos
    status = -1
    sstatus = -1
    click = 0
    notes = []
    programs = []
    tempos = []
    while True:
        delta = r.vlq()
        if delta == -1:
            raise RuntimeError('bad midifile: bad varlen')
        click += delta
        while True:
            me = r.u8()
            if 0xF1 <= me <= 0xFE and me != 0xF7:
                continue
            break
        if me in (0xF0, 0xF7):
            status = -1
            ln = r.vlq()
            if ln == -1:
                raise RuntimeError('bad midifile: bad sysex length')
            r.read(ln)
            continue
        if me == 0xFF:
            status = -1
            mtype = r.u8()
            ln = r.vlq()
            if ln == -1:
                raise RuntimeError('bad midifile: bad meta length')
            data = bytes(r.read(ln))
            if mtype == 0x2F:
                break
            if mtype == 0x51 and ln >= 3:
                tempos.append((click,
                               (data[0] << 16) | (data[1] << 8) | data[2]))
            continue
        if me & 0x80:
            status = me
            sstatus = me
            a = r.u8()
        else:
            if status == -1:
                if sstatus == -1:
                    raise RuntimeError('bad midifile: no running status')
                status = sstatus
            a = me
        ch = status & 0x0F
        hi = status & 0xF0
        b = r.u8() if hi in _TWO_DATA else 0
        if hi == 0x90:
            notes.append((click, True, ch, a & 0x7F, b & 0x7F))
        elif hi == 0x80:
            notes.append((click, False, ch, a & 0x7F, b & 0x7F))
        elif hi == 0xC0:
            programs.append((click, ch, a & 0x7F))
        if b & 0x80:
            status = b
            sstatus = b
        elif a & 0x80:
            raise RuntimeError('bad midifile: data byte out of range')
    if r.pos < end:
        r.read(end - r.pos)
    return notes, programs, tempos


def _merge_channel(notes):
    out = []
    used = [False] * len(notes)
    for i, (tick, on, _ch, pitch, velo) in enumerate(notes):
        if used[i] or not on or velo == 0:
            continue
        length = 1
        for k in range(i + 1, len(notes)):
            if used[k]:
                continue
            t2, on2, _c2, p2, v2 = notes[k]
            if (not on2 or v2 == 0) and p2 == pitch:
                length = max(1, t2 - tick)
                used[k] = True
                break
        out.append((tick, length, pitch, velo))
    return out


def _tempo_segments(tempos, division):
    merged = {}
    for click, usec in sorted(tempos):
        merged[click] = max(1, usec)
    if 0 not in merged:
        merged[0] = _DEFAULT_USEC
    segs = []
    t = 0.0
    prev_click = 0
    prev_usec = merged[0]
    for click in sorted(merged):
        t += (click - prev_click) * prev_usec / division / 1e6
        segs.append((click, t, merged[click]))
        prev_click = click
        prev_usec = merged[click]
    return segs


def _sec_at(segs, division, in_tps, click):
    if in_tps:
        return click / division
    seg = segs[0]
    for s in segs:
        if s[0] <= click:
            seg = s
        else:
            break
    return seg[1] + (click - seg[0]) * seg[2] / division / 1e6


def parse_smf(data: bytes) -> dict:
    r = _Reader(data)
    if bytes(r.read(4)) != b'MThd':
        raise RuntimeError('bad midifile: MThd expected')
    hlen = r.u32()
    if hlen < 6:
        raise RuntimeError('bad midifile: MThd expected')
    if hlen > 6:
        raise RuntimeError(
            f'unsupported MIDI header data size: {hlen} instead of 6')
    fmt = r.u16()
    ntracks = r.u16()
    hi = r.u8()
    lo = r.u8()
    if hi & 0x80:
        fps = 256 - hi
        division = round(29.97 * lo) if fps == 29 else fps * lo
        in_tps = True
    else:
        division = (hi << 8) | lo
        in_tps = False
    if division <= 0:
        raise RuntimeError('bad midifile: bad division')
    if fmt not in (0, 1):
        raise RuntimeError(f'midi file format {fmt} not implemented')

    tracks = []
    all_programs = []
    all_tempos = []
    for _ in range(ntracks if fmt == 1 else 1):
        notes, programs, tempos = _read_track(r)
        tracks.append(notes)
        all_programs += programs
        all_tempos += tempos

    segs = _tempo_segments(all_tempos, division)

    events = []
    for notes in tracks:
        by_channel = {}
        for n in notes:
            by_channel.setdefault(n[2], []).append(n)
        for ch in sorted(by_channel):
            for tick, length, pitch, velo in _merge_channel(by_channel[ch]):
                t0 = _sec_at(segs, division, in_tps, tick)
                t1 = _sec_at(segs, division, in_tps, tick + length)
                events.append({'t': round(t0, 6),
                               'dur': round(t1 - t0, 6),
                               'midi': pitch, 'vel': velo, 'ch': ch})
    events.sort(key=lambda e: (e['t'], e['ch'], e['midi']))

    programs = {}
    for _click, ch, value in sorted(all_programs, key=lambda p: p[0]):
        if ch not in programs:
            programs[ch] = value

    if in_tps:
        tempo_map = [{'beat': 0.0, 't': 0.0, 'bpm': 120.0}]
    else:
        tempo_map = [{'beat': round(click / division, 6), 't': round(t, 6),
                      'bpm': round(60000000.0 / usec, 6)}
                     for click, t, usec in segs]

    duration = max((e['t'] + e['dur'] for e in events), default=0.0) + 1.0
    return {'tempo_map': tempo_map, 'events': events,
            'programs': {str(ch): v for ch, v in programs.items()},
            'duration': round(duration, 3)}


def _default_soundfont() -> str:
    try:
        from ..api.resources import resource_dir
        files = [p for p in sorted(resource_dir('soundfont').iterdir())
                 if p.suffix.lower() in ('.sf2', '.sf3')]
    except Exception:
        return ''
    for p in files:
        if 'fluid' in p.name.lower():
            return str(p)
    return str(files[0]) if files else ''


def midi_wav_path(src: Path) -> Path:
    import folder_paths
    d = Path(folder_paths.get_output_directory()) / _RENDER_SUBFOLDER
    d.mkdir(parents=True, exist_ok=True)
    st = src.stat()
    key = hashlib.sha1(
        f'{src}|{st.st_size}|{st.st_mtime_ns}'.encode()).hexdigest()[:16]
    return d / f'mr_{key}.wav'


def render_midi_to_wav(src: Path) -> Path:
    dest = midi_wav_path(src)
    if dest.is_file():
        return dest
    from .media import localize
    from .score_synth import render_performance
    url = render_performance(parse_smf(src.read_bytes()),
                             soundfont_path=_default_soundfont())
    os.replace(localize(url), dest)
    return dest


def ensure_midi_wav(view_url: str) -> dict:
    from .media import path_to_view_url, view_url_to_path
    src = view_url_to_path(view_url)
    if src is None or src.suffix.lower() not in MIDI_SUFFIXES:
        return {'status': 'original'}
    return {'status': 'ready',
            'url': path_to_view_url(render_midi_to_wav(src))}


__all__ = ['parse_smf', 'ensure_midi_wav', 'render_midi_to_wav',
           'midi_wav_path', 'MIDI_SUFFIXES']
