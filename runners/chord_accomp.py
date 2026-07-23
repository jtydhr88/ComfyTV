import json
import re

CHORD_QUALITIES = {
    '': (0, 4, 7), 'maj': (0, 4, 7), 'm': (0, 3, 7), 'min': (0, 3, 7),
    '-': (0, 3, 7),
    '7': (0, 4, 7, 10), 'maj7': (0, 4, 7, 11), 'M7': (0, 4, 7, 11),
    'm7': (0, 3, 7, 10), 'min7': (0, 3, 7, 10), '-7': (0, 3, 7, 10),
    'm7b5': (0, 3, 6, 10), 'dim': (0, 3, 6), 'dim7': (0, 3, 6, 9),
    'aug': (0, 4, 8), '+': (0, 4, 8),
    'sus4': (0, 5, 7), 'sus2': (0, 2, 7),
    '6': (0, 4, 7, 9), 'm6': (0, 3, 7, 9),
    '9': (0, 4, 7, 10, 14), 'maj9': (0, 4, 7, 11, 14),
    'm9': (0, 3, 7, 10, 14), 'add9': (0, 4, 7, 14),
    '7sus4': (0, 5, 7, 10), '7b9': (0, 4, 7, 10, 13),
    '13': (0, 4, 7, 10, 14, 21),
}

VOICINGS = ('close', 'drop_2', 'three_note', 'four_note', 'root_only')
PATTERNS = ('block', 'pad', 'broken', 'alberti', 'strum')

_NOTE_SEMIS = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
_CHORD_RE = re.compile(
    r'^([A-G])([#b]?)([A-Za-z0-9+\-]*?)(?:/([A-G])([#b]?))?$')


def parse_chord(symbol):
    m = _CHORD_RE.match(symbol.strip())
    if not m:
        raise RuntimeError(f"chord accomp: cannot parse chord {symbol!r}")
    root_name, acc, quality, bass_name, bass_acc = m.groups()
    root = _NOTE_SEMIS[root_name] + (1 if acc == '#' else
                                     -1 if acc == 'b' else 0)
    if quality not in CHORD_QUALITIES:
        raise RuntimeError(
            f"chord accomp: unknown quality {quality!r} in {symbol!r}")
    intervals = CHORD_QUALITIES[quality]
    bass = None
    if bass_name:
        bass = _NOTE_SEMIS[bass_name] + (1 if bass_acc == '#' else
                                         -1 if bass_acc == 'b' else 0)
    return root % 12, intervals, bass


def _essential(intervals, count):
    ranked = [iv for iv in (10, 11, 3, 4, 13, 14, 21, 5, 2, 6, 8, 9, 7)
              if iv in intervals or (iv - 12) in intervals]
    picked = []
    for iv in ranked:
        val = iv if iv in intervals else iv - 12
        if val not in picked and val != 0:
            picked.append(val)
        if len(picked) >= count:
            break
    for iv in intervals:
        if len(picked) >= count:
            break
        if iv != 0 and iv not in picked:
            picked.append(iv)
    return picked[:count]


def voice_chord(root, intervals, bass=None, *, voicing='close',
                octave_shift=0):
    base = 48 + root % 12
    bass_midi = 36 + (bass if bass is not None else root) % 12
    middle = 60

    def fold(iv):
        return middle + (root + iv) % 12

    notes = [bass_midi]
    if voicing == 'root_only':
        pass
    elif voicing == 'three_note':
        for iv in _essential(intervals, 2):
            notes.append(fold(iv))
    elif voicing == 'four_note':
        for iv in _essential(intervals, 3):
            notes.append(fold(iv))
        notes.append(fold(0))
    elif voicing == 'drop_2':
        close = sorted({fold(iv) for iv in intervals})[:4]
        if len(close) >= 2:
            close = sorted(close)
            dropped = close[-2] - 12
            close = [n for n in close if n != close[-2]] + [dropped]
        notes.extend(close)
    else:
        notes.append(middle + root % 12)
        for iv in intervals:
            if iv != 0:
                notes.append(fold(iv))
    shift = int(octave_shift) * 12
    out = sorted({n + shift for n in notes if 0 <= n + shift <= 127})
    return out


def parse_progression(text):
    bars = [b.strip() for b in (text or '').replace('\n', '|').split('|')]
    bars = [b for b in bars if b]
    if not bars:
        raise RuntimeError(
            "chord accomp: empty progression — e.g. 'Am7 Dm7 | G7 | Cmaj7'")
    out = []
    for bar in bars:
        symbols = bar.split()
        out.append([parse_chord(s) for s in symbols])
    return out


def _pattern_events(chord_notes, start_beat, beats, pattern, velocity):
    events = []

    def ev(beat, dur, midi, vel):
        events.append((beat, dur, midi, vel))

    if pattern == 'pad':
        for n in chord_notes:
            ev(start_beat, beats, n, velocity - 8)
    elif pattern == 'broken':
        seq = chord_notes + chord_notes[-2:0:-1]
        step = 0.5
        i = 0
        b = 0.0
        while b < beats - 1e-6:
            ev(start_beat + b, step * 1.1, seq[i % len(seq)], velocity - 6)
            b += step
            i += 1
    elif pattern == 'alberti':
        if len(chord_notes) >= 3:
            lo, hi, mid = chord_notes[0], chord_notes[-1], \
                chord_notes[len(chord_notes) // 2]
            seq = [lo, hi, mid, hi]
        else:
            seq = chord_notes * 2
        step = 0.5
        i = 0
        b = 0.0
        while b < beats - 1e-6:
            ev(start_beat + b, step * 1.05, seq[i % len(seq)], velocity - 6)
            b += step
            i += 1
    elif pattern == 'strum':
        half = beats / 2.0
        for rep in range(2):
            for i, n in enumerate(chord_notes):
                ev(start_beat + rep * half + i * 0.04, half - i * 0.04, n,
                   velocity - 4 - i * 2)
    else:
        half = beats / 2.0
        for rep in range(2):
            for n in chord_notes:
                ev(start_beat + rep * half, half * 0.95, n, velocity - 6)
    return events


def chord_accompaniment(progression: str, *, bpm=100.0, beats_per_bar=4,
                        pattern='block', voicing='close', octave_shift=0,
                        velocity=88, repeats=1):
    if pattern not in PATTERNS:
        raise RuntimeError(f"chord accomp: unknown pattern {pattern!r}")
    if voicing not in VOICINGS:
        raise RuntimeError(f"chord accomp: unknown voicing {voicing!r}")
    bars = parse_progression(progression)
    bpm = max(20.0, min(300.0, float(bpm)))
    bpb = max(1, min(12, int(beats_per_bar)))
    vel = max(20, min(127, int(velocity)))

    events_b = []
    beat = 0.0
    for _ in range(max(1, min(16, int(repeats)))):
        for bar in bars:
            n_chords = max(1, len(bar))
            span = bpb / n_chords
            for ci, (root, intervals, bass) in enumerate(bar):
                notes = voice_chord(root, intervals, bass,
                                    voicing=voicing,
                                    octave_shift=octave_shift)
                events_b.extend(_pattern_events(
                    notes, beat + ci * span, span, pattern, vel))
            beat += bpb

    spb = 60.0 / bpm
    events = [{'t': round(b * spb, 6), 'dur': round(d * spb, 6),
               'midi': int(m), 'vel': int(v), 'ch': 0}
              for b, d, m, v in sorted(events_b)]
    return {'tempo_map': [{'beat': 0.0, 't': 0.0, 'bpm': bpm}],
            'events': events,
            'duration': round(beat * spb + 1.5, 3)}


def chord_accompaniment_json(progression: str, **kwargs) -> str:
    return json.dumps(chord_accompaniment(progression, **kwargs))


__all__ = ['chord_accompaniment', 'chord_accompaniment_json',
           'parse_chord', 'parse_progression', 'voice_chord',
           'VOICINGS', 'PATTERNS', 'CHORD_QUALITIES']
