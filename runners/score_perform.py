import json
import math

from .score_model import Score, merge_ties

_MASK64 = (1 << 64) - 1

DYNAMIC_LEVELS = {
    'pppp': 2750, 'ppp': 3250, 'pp': 3750, 'p': 4250, 'mp': 4750,
    'mf': 5250, 'f': 5750, 'ff': 6250, 'fff': 6750, 'ffff': 7250,
    'sf': 6250, 'sfz': 6750, 'fp': 5750,
}
_NATURAL = 5000

def _art_table(standard, staccato, staccatissimo, tenuto, accent, marcato):
    def entry(pair):
        dur, peak = pair
        return {'dur': dur / 10000.0, 'vel': 1.0 + peak / 24000.0}

    return {
        'standard':      entry(standard),
        'staccato':      entry(staccato),
        'staccatissimo': entry(staccatissimo),
        'tenuto':        entry(tenuto),
        'accent':        entry(accent),
        'marcato':       entry(marcato),
        'portato':       {'dur': 0.75, 'vel': 1.0},
        'legato':        {'dur': 1.0, 'vel': 1.0},
    }


PROFILE_ARTICULATIONS = {
    'keyboard':   _art_table((9500, 0), (5000, 0), (2500, 0), (9900, 5000),
                             (9500, 6000), (9500, 6000)),
    'strings':    _art_table((9900, 0), (5000, 0), (2500, 0), (9900, 5000),
                             (9000, 7000), (9000, 7000)),
    'winds':      _art_table((9900, 0), (5000, 0), (2500, 0), (9900, 5000),
                             (9900, 6000), (9900, 6000)),
    'voice':      _art_table((9900, 0), (5000, 0), (2500, 0), (9900, 5000),
                             (9900, 6000), (9900, 6000)),
    'percussion': _art_table((9500, 0), (5000, 0), (2500, 0), (9900, 5000),
                             (9500, 6000), (6500, 6000)),
}

ARTICULATIONS = PROFILE_ARTICULATIONS['keyboard']

EASINGS = ('normal', 'ease_in', 'ease_out', 'ease_in_out', 'exponential')

PROFILES = ('keyboard', 'strings', 'winds', 'voice', 'percussion')


def _easing(x, method):
    x = max(0.0, min(1.0, x))
    if method == 'ease_in':
        return 1.0 - math.sqrt(max(0.0, 1.0 - x * x))
    if method == 'ease_out':
        return math.sqrt(max(0.0, 1.0 - (x - 1.0) ** 2))
    if method == 'ease_in_out':
        if x < 0.5:
            return (1.0 - math.sqrt(max(0.0, 1.0 - (2 * x) ** 2))) / 2.0
        return (math.sqrt(max(0.0, 1.0 - (-2 * x + 2) ** 2)) + 1.0) / 2.0
    if method == 'exponential':
        return x if x >= 1.0 else 1.0 - 2.0 ** (-10.0 * x)
    return x


def _mix64(z):
    z = (z + 0x9E3779B97F4A7C15) & _MASK64
    z = ((z ^ (z >> 30)) * 0xBF58476D1CE4E5B9) & _MASK64
    z = ((z ^ (z >> 27)) * 0x94D049BB133111EB) & _MASK64
    return (z ^ (z >> 31)) & _MASK64


def _hash01(seed, k):
    return _mix64((seed + 1) * 0x9E3779B97F4A7C15 ^ (k + 1)) \
        / float(_MASK64 + 1)


class _DynamicTrack:

    def __init__(self, directions, total_beats):
        marks = sorted((d.onset, DYNAMIC_LEVELS.get(d.value, _NATURAL))
                       for d in directions if d.kind == 'dynamic')
        wedges = []
        pending = None
        for d in sorted(directions, key=lambda x: x.onset):
            if d.kind == 'wedge_start':
                pending = (d.onset, d.value)
            elif d.kind == 'wedge_stop' and pending is not None:
                wedges.append((pending[0], d.onset, pending[1]))
                pending = None
        if pending is not None:
            wedges.append((pending[0], total_beats, pending[1]))
        self.marks = marks or [(0.0, _NATURAL)]
        self.wedges = wedges

    def _base_at(self, beat):
        level = self.marks[0][1]
        for onset, val in self.marks:
            if onset <= beat + 1e-9:
                level = val
            else:
                break
        return level

    def _next_mark_after(self, beat):
        for onset, val in self.marks:
            if onset > beat + 1e-9:
                return val
        return None

    def level_at(self, beat, easing='normal'):
        level = float(self._base_at(beat))
        for start, end, kind in self.wedges:
            if start - 1e-9 <= beat < end and end > start:
                x = (beat - start) / (end - start)
                target = self._next_mark_after(start)
                if target is None:
                    step = 1000.0
                    target = level + step if kind == 'crescendo' \
                        else level - step
                level = level + (float(target) - level) * _easing(x, easing)
                break
        return level


def _tempo_map(score: Score):
    tempos = []
    for part in score.parts:
        for d in part.directions:
            if d.kind == 'tempo':
                tempos.append((d.onset, float(d.value)))
    tempos.sort()
    if not tempos or tempos[0][0] > 1e-9:
        tempos.insert(0, (0.0, score.initial_tempo))
    dedup = []
    for onset, bpm in tempos:
        if dedup and abs(dedup[-1][0] - onset) < 1e-9:
            dedup[-1] = (onset, bpm)
        else:
            dedup.append((onset, bpm))
    return dedup


def _beats_to_seconds_fn(tempo_map):
    anchors = [0.0]
    for i in range(1, len(tempo_map)):
        b0, bpm0 = tempo_map[i - 1]
        b1, _ = tempo_map[i]
        anchors.append(anchors[-1] + (b1 - b0) * 60.0 / bpm0)

    def fn(beat):
        idx = 0
        for i, (b, _bpm) in enumerate(tempo_map):
            if b <= beat + 1e-9:
                idx = i
            else:
                break
        b0, bpm0 = tempo_map[idx]
        return anchors[idx] + (beat - b0) * 60.0 / bpm0

    return fn


def _swing_shift(onset_beats, duration_beats, swing_ratio, swing_unit):
    unit = swing_unit
    beat = unit * 2.0
    if duration_beats + 1e-9 < unit:
        return 0.0, 1.0
    pos = onset_beats % beat
    adjust = beat * ((swing_ratio - 50.0) / 100.0)
    on_shift = 0.0
    dur_mult = 1.0
    if abs(pos - unit) < 1e-6:
        on_shift = adjust
        dur_mult = max(0.1, (duration_beats - adjust) / duration_beats)
    elif abs(pos) < 1e-6 and abs(duration_beats - unit) < 1e-6:
        dur_mult = (duration_beats + adjust) / duration_beats
    return on_shift, dur_mult


def _ornament_notes(note, key_step_up=2, key_step_down=2):
    beats = note.duration
    out = []
    if 'trill' in note.ornaments:
        n_alt = max(4, int(round(beats * 8)))
        seg = beats / n_alt
        for i in range(n_alt):
            midi = note.midi + (key_step_up if i % 2 else 0)
            out.append((note.onset + i * seg, seg, midi))
        return out
    if 'turn' in note.ornaments or 'inverted_turn' in note.ornaments:
        inv = 'inverted_turn' in note.ornaments
        seq = ([-key_step_down, 0, key_step_up, 0] if inv
               else [key_step_up, 0, -key_step_down, 0])
        seg = min(beats / 8.0, 0.125)
        pre = len(seq) * seg
        for i, off in enumerate(seq):
            out.append((note.onset + i * seg, seg, note.midi + off))
        out.append((note.onset + pre, beats - pre, note.midi))
        return out
    if 'mordent' in note.ornaments or 'inverted_mordent' in note.ornaments:
        upper = 'inverted_mordent' in note.ornaments
        off = key_step_up if upper else -key_step_down
        seg = min(beats / 8.0, 0.0625)
        out.append((note.onset, seg, note.midi))
        out.append((note.onset + seg, seg, note.midi + off))
        out.append((note.onset + 2 * seg, beats - 2 * seg, note.midi))
        return out
    if note.tremolo_marks > 0:
        seg = 1.0 / (2 ** note.tremolo_marks)
        n = max(1, int(round(beats / seg)))
        seg = beats / n
        for i in range(n):
            out.append((note.onset + i * seg, seg, note.midi))
        return out
    return [(note.onset, beats, note.midi)]


def perform_score(score: Score, *, swing_ratio=50.0, swing_unit=0.5,
                  humanize=0.0, easing='normal', seed=7,
                  profile='keyboard'):
    tempo_map = _tempo_map(score)
    to_sec = _beats_to_seconds_fn(tempo_map)
    total_beats = score.total_beats()

    events = []
    for pi, part in enumerate(score.parts):
        arts = PROFILE_ARTICULATIONS['percussion'] if part.is_percussion \
            else PROFILE_ARTICULATIONS.get(profile, ARTICULATIONS)
        dyn = _DynamicTrack(part.directions, total_beats)
        notes = merge_ties(part)
        channel = 9 if part.is_percussion else min(15, pi if pi < 9
                                                   else pi + 1)
        in_slur = False
        hk = 0

        chord_groups = {}
        for n in notes:
            if n.arpeggiate and n.chord_id >= 0:
                chord_groups.setdefault(n.chord_id, []).append(n)

        grace_queue = []
        for n in sorted(notes, key=lambda x: (x.onset, x.midi)):
            if n.grace:
                grace_queue.append(n)
                continue
            if n.slur_start:
                in_slur = True

            dur_f = arts['standard']['dur']
            vel_f = 1.0
            for art in n.articulations:
                spec = arts.get(art)
                if spec:
                    dur_f = min(dur_f, spec['dur']) if art in (
                        'staccato', 'staccatissimo', 'portato') \
                        else max(dur_f, spec['dur'])
                    vel_f = max(vel_f, spec['vel'])
            if in_slur:
                dur_f = max(dur_f, arts['legato']['dur'])

            onset_b = n.onset
            dur_b = n.duration
            if swing_ratio > 50.0:
                shift, mult = _swing_shift(onset_b, dur_b, swing_ratio,
                                           swing_unit)
                onset_b += shift
                dur_b *= mult

            if grace_queue:
                steal = min(dur_b * 0.25, 0.125 * len(grace_queue))
                seg = steal / len(grace_queue)
                for gi, g in enumerate(grace_queue):
                    g_on = onset_b + gi * seg
                    events.append(_event(to_sec, g_on, seg * 0.9, g.midi,
                                         dyn, easing, 0.9, channel,
                                         humanize, seed, hk))
                    hk += 1
                onset_b += steal
                dur_b -= steal
                grace_queue = []

            arp = chord_groups.get(n.chord_id) if n.chord_id >= 0 else None
            arp_shift = 0.0
            if arp and len(arp) > 1 and n.arpeggiate:
                order = sorted(arp, key=lambda x: x.midi)
                idx = order.index(n)
                arp_shift = idx * min(0.0625, dur_b / (2 * len(order)))

            sub = _ornament_notes(n)
            for s_on, s_dur, s_midi in sub:
                rel_on = onset_b + (s_on - n.onset) + arp_shift
                rel_dur = min(s_dur, dur_b) * dur_f
                events.append(_event(to_sec, rel_on, rel_dur, s_midi, dyn,
                                     easing, vel_f, channel, humanize,
                                     seed, hk))
                hk += 1
            if n.slur_stop:
                in_slur = False

    events.sort(key=lambda e: (e['t'], e['midi']))
    tempo_sec = [{'beat': b, 't': round(to_sec(b), 6), 'bpm': bpm}
                 for b, bpm in tempo_map]
    return {'tempo_map': tempo_sec, 'events': events,
            'duration': round(to_sec(total_beats) + 1.0, 3)}


def _event(to_sec, onset_b, dur_b, midi, dyn, easing, vel_f, channel,
           humanize, seed, hk):
    t0 = to_sec(onset_b)
    t1 = to_sec(onset_b + max(0.01, dur_b))
    level = dyn.level_at(onset_b, easing)
    vel = int(round(level / 10000.0 * 127.0 * vel_f))
    if humanize > 0:
        t0 += (_hash01(seed, hk * 2) - 0.5) * 0.02 * humanize
        vel = int(round(vel * (1.0 + (_hash01(seed, hk * 2 + 1) - 0.5)
                               * 0.25 * humanize)))
    return {'t': round(max(0.0, t0), 6),
            'dur': round(max(0.02, t1 - t0), 6),
            'midi': int(max(0, min(127, midi))),
            'vel': int(max(1, min(127, vel))),
            'ch': int(channel)}


def perform_to_json(score: Score, **kwargs) -> str:
    return json.dumps(perform_score(score, **kwargs))


__all__ = ['perform_score', 'perform_to_json', 'ARTICULATIONS',
           'PROFILE_ARTICULATIONS', 'DYNAMIC_LEVELS', 'EASINGS', 'PROFILES']
