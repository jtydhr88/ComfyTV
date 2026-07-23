import logging
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field

_log = logging.getLogger('ComfyTV.score')

STEP_SEMIS = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}

DYNAMIC_TAGS = ('pppp', 'ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff',
                'ffff', 'sf', 'sfz', 'fp')

ORNAMENT_TAGS = {
    'trill-mark': 'trill',
    'turn': 'turn',
    'inverted-turn': 'inverted_turn',
    'mordent': 'mordent',
    'inverted-mordent': 'inverted_mordent',
}

ARTICULATION_TAGS = {
    'staccato': 'staccato',
    'staccatissimo': 'staccatissimo',
    'tenuto': 'tenuto',
    'accent': 'accent',
    'strong-accent': 'marcato',
    'detached-legato': 'portato',
}


@dataclass
class ScoreNote:
    onset: float
    duration: float
    midi: int = -1
    voice: int = 1
    tie_start: bool = False
    tie_stop: bool = False
    chord_id: int = -1
    grace: bool = False
    grace_slash: bool = False
    articulations: list = field(default_factory=list)
    ornaments: list = field(default_factory=list)
    arpeggiate: bool = False
    slur_start: bool = False
    slur_stop: bool = False
    tremolo_marks: int = 0

    @property
    def is_rest(self):
        return self.midi < 0


@dataclass
class Direction:
    onset: float
    kind: str
    value: object = None


@dataclass
class ScorePart:
    part_id: str
    name: str
    notes: list = field(default_factory=list)
    directions: list = field(default_factory=list)
    midi_program: int = 0
    midi_channel: int = 0
    is_percussion: bool = False


@dataclass
class Score:
    parts: list
    divisions: float = 480.0
    beats: int = 4
    beat_type: int = 4
    initial_tempo: float = 120.0
    title: str = ''

    def total_beats(self):
        end = 0.0
        for part in self.parts:
            for n in part.notes:
                end = max(end, n.onset + n.duration)
        return end


def _pitch_to_midi(pitch_el):
    step = pitch_el.findtext('step')
    if step is None or step not in STEP_SEMIS:
        return -1
    octave = int(pitch_el.findtext('octave', '4'))
    alter = float(pitch_el.findtext('alter', '0') or 0)
    return int(round((octave + 1) * 12 + STEP_SEMIS[step] + alter))


def _parse_direction(el, beat_pos, divisions, part):
    for dyn in el.iter('dynamics'):
        for child in dyn:
            if child.tag in DYNAMIC_TAGS:
                part.directions.append(
                    Direction(beat_pos, 'dynamic', child.tag))
                break
    for wedge in el.iter('wedge'):
        w_type = wedge.get('type')
        if w_type in ('crescendo', 'diminuendo'):
            part.directions.append(Direction(beat_pos, 'wedge_start', w_type))
        elif w_type == 'stop':
            part.directions.append(Direction(beat_pos, 'wedge_stop', None))
    snd = el.find('sound')
    if snd is not None and snd.get('tempo'):
        try:
            part.directions.append(
                Direction(beat_pos, 'tempo', float(snd.get('tempo'))))
        except ValueError:
            pass
    metro = el.find('.//metronome/per-minute')
    if metro is not None and metro.text:
        try:
            part.directions.append(
                Direction(beat_pos, 'tempo', float(metro.text)))
        except ValueError:
            pass


def _parse_note(el, beat_pos, divisions, chord_seq, unpitched_map=None):
    dur_el = el.findtext('duration')
    is_grace = el.find('grace') is not None
    beats = 0.0
    if dur_el is not None:
        beats = float(dur_el) / divisions
    note = ScoreNote(onset=beat_pos, duration=beats)
    note.grace = is_grace
    if is_grace:
        note.grace_slash = el.find('grace').get('slash') == 'yes'
    pitch = el.find('pitch')
    if pitch is not None and el.find('rest') is None:
        note.midi = _pitch_to_midi(pitch)
    unp = el.find('unpitched')
    if unp is not None:
        inst = el.find('instrument')
        inst_id = inst.get('id') if inst is not None else None
        mapped = (unpitched_map or {}).get(inst_id)
        if mapped is not None:
            note.midi = mapped
        else:
            note.midi = 38
    try:
        note.voice = int(el.findtext('voice', '1'))
    except ValueError:
        note.voice = 1
    for tie in el.findall('tie'):
        if tie.get('type') == 'start':
            note.tie_start = True
        elif tie.get('type') == 'stop':
            note.tie_stop = True
    note.chord_id = chord_seq if el.find('chord') is not None else -1
    for art in el.iter('articulations'):
        for child in art:
            mapped = ARTICULATION_TAGS.get(child.tag)
            if mapped and mapped not in note.articulations:
                note.articulations.append(mapped)
    for orn in el.iter('ornaments'):
        for child in orn:
            mapped = ORNAMENT_TAGS.get(child.tag)
            if mapped and mapped not in note.ornaments:
                note.ornaments.append(mapped)
            if child.tag == 'tremolo':
                try:
                    note.tremolo_marks = int(child.text or '2')
                except ValueError:
                    note.tremolo_marks = 2
    note.arpeggiate = el.find('.//arpeggiate') is not None
    for slur in el.iter('slur'):
        if slur.get('type') == 'start':
            note.slur_start = True
        elif slur.get('type') == 'stop':
            note.slur_stop = True
    return note


def _measure_repeat_info(measure_el):
    info = {'forward': False, 'backward': False, 'times': 2,
            'ending_start': None, 'ending_stop': False}
    for barline in measure_el.findall('barline'):
        rep = barline.find('repeat')
        if rep is not None:
            if rep.get('direction') == 'forward':
                info['forward'] = True
            elif rep.get('direction') == 'backward':
                info['backward'] = True
                try:
                    info['times'] = max(2, int(rep.get('times', '2')))
                except ValueError:
                    info['times'] = 2
        ending = barline.find('ending')
        if ending is not None:
            etype = ending.get('type')
            if etype == 'start':
                nums = set()
                for tok in (ending.get('number') or '1').split(','):
                    try:
                        nums.add(int(tok.strip()))
                    except ValueError:
                        pass
                info['ending_start'] = nums or {1}
            elif etype in ('stop', 'discontinue'):
                info['ending_stop'] = True
    return info


def _expand_repeats(measure_els):
    n = len(measure_els)
    infos = [_measure_repeat_info(m) for m in measure_els]

    ending_nums = [None] * n
    active = None
    for i in range(n):
        if infos[i]['ending_start'] is not None:
            active = infos[i]['ending_start']
        ending_nums[i] = active
        if infos[i]['ending_stop']:
            active = None

    order = []
    i = 0
    start = 0
    passes = {}
    guard = 0
    while i < n and guard < n * 16:
        guard += 1
        info = infos[i]
        if info['forward']:
            start = i
        current_pass = passes.get(start, 1)
        if ending_nums[i] is not None and current_pass not in ending_nums[i]:
            while i < n and not infos[i]['ending_stop']:
                i += 1
            i += 1
            continue
        order.append(i)
        if info['backward']:
            if current_pass < info['times']:
                passes[start] = current_pass + 1
                i = start
                continue
            passes[start] = 1
        i += 1
    return order


def _measure_content_len(measure_el, divisions):
    pos = 0.0
    peak = 0.0
    for el in measure_el:
        if el.tag == 'attributes':
            dv = el.findtext('divisions')
            if dv:
                divisions = float(dv)
        elif el.tag == 'backup':
            pos -= float(el.findtext('duration', '0')) / divisions
        elif el.tag == 'forward':
            pos += float(el.findtext('duration', '0')) / divisions
            peak = max(peak, pos)
        elif el.tag == 'note':
            if el.find('grace') is not None or el.find('chord') is not None:
                continue
            dur = el.findtext('duration')
            if dur is not None:
                pos += float(dur) / divisions
                peak = max(peak, pos)
    return peak, divisions


def parse_musicxml(text: str) -> Score:
    text = (text or '').strip()
    if not text:
        raise RuntimeError("score: empty MusicXML")
    if text.startswith('﻿'):
        text = text.lstrip('﻿')
    try:
        root = ET.fromstring(text)
    except ET.ParseError as exc:
        raise RuntimeError(f"score: MusicXML parse error: {exc}")
    if root.tag == 'score-timewise':
        raise RuntimeError(
            "score: score-timewise is not supported — export score-partwise")
    if root.tag != 'score-partwise':
        raise RuntimeError(f"score: unexpected root element <{root.tag}>")

    title = root.findtext('work/work-title', '') or \
        root.findtext('movement-title', '') or ''
    part_names = {}
    part_percussion = {}
    part_unpitched = {}
    for sp in root.findall('.//score-part'):
        pid = sp.get('id') or ''
        part_names[pid] = sp.findtext('part-name', pid) or pid
        umap = {}
        for mi in sp.findall('midi-instrument'):
            uv = mi.findtext('midi-unpitched')
            if uv:
                try:
                    umap[mi.get('id')] = max(0, min(127, int(uv) - 1))
                except ValueError:
                    pass
        part_unpitched[pid] = umap
        part_percussion[pid] = bool(umap)

    score = Score(parts=[], title=title)
    first_attrs_seen = False

    part_els = root.findall('part')

    measure_lens = {}
    for part_el in part_els:
        divisions = 480.0
        for k, measure in enumerate(part_el.findall('measure')):
            length, divisions = _measure_content_len(measure, divisions)
            measure_lens[k] = max(measure_lens.get(k, 0.0), length)

    for part_el in part_els:
        pid = part_el.get('id') or f'P{len(score.parts) + 1}'
        part = ScorePart(part_id=pid, name=part_names.get(pid, pid),
                         midi_channel=len(score.parts))
        divisions = score.divisions if first_attrs_seen else 480.0
        beat_pos = 0.0
        chord_seq = 0
        measure_start = 0.0

        measures = part_el.findall('measure')
        expansion = _expand_repeats(measures)
        if len(expansion) != len(measures):
            _log.info(
                '[ComfyTV/score] part %s: repeats expanded %d -> %d '
                'measures', pid, len(measures), len(expansion))
        else:
            _log.info(
                '[ComfyTV/score] part %s: no repeats found (%d measures)',
                pid, len(measures))

        for midx in expansion:
            measure = measures[midx]
            measure_start = beat_pos
            prev_note = None
            for el in measure:
                if el.tag == 'attributes':
                    dv = el.findtext('divisions')
                    if dv:
                        divisions = float(dv)
                        if not first_attrs_seen:
                            score.divisions = divisions
                            first_attrs_seen = True
                    bt = el.findtext('time/beats')
                    btt = el.findtext('time/beat-type')
                    if bt and btt:
                        score.beats = int(bt)
                        score.beat_type = int(btt)
                    clef = el.findtext('clef/sign')
                    if clef == 'percussion':
                        part.is_percussion = True
                elif el.tag == 'direction':
                    _parse_direction(el, beat_pos, divisions, part)
                elif el.tag == 'backup':
                    beat_pos -= float(el.findtext('duration', '0')) / divisions
                elif el.tag == 'forward':
                    beat_pos += float(el.findtext('duration', '0')) / divisions
                elif el.tag == 'note':
                    umap = part_unpitched.get(pid) or {}
                    is_chord = el.find('chord') is not None
                    if is_chord and prev_note is not None:
                        note = _parse_note(el, prev_note.onset, divisions,
                                           chord_seq, umap)
                        note.duration = prev_note.duration
                        note.chord_id = prev_note.chord_id \
                            if prev_note.chord_id >= 0 else chord_seq
                        if prev_note.chord_id < 0:
                            prev_note.chord_id = chord_seq
                    else:
                        chord_seq += 1
                        note = _parse_note(el, beat_pos, divisions,
                                           chord_seq, umap)
                        note.chord_id = -1
                        if not note.grace:
                            beat_pos += note.duration
                        prev_note = note
                    if not (note.is_rest and note.grace):
                        part.notes.append(note)
            beat_pos = measure_start + max(
                measure_lens.get(midx, 0.0), beat_pos - measure_start)
        if part_percussion.get(pid):
            part.is_percussion = True
        score.parts.append(part)

    tempo_dirs = [d for p in score.parts for d in p.directions
                  if d.kind == 'tempo']
    if tempo_dirs:
        score.initial_tempo = float(
            min(tempo_dirs, key=lambda d: d.onset).value)
    if not any(p.notes for p in score.parts):
        raise RuntimeError("score: no notes found")
    return score


def merge_ties(part: ScorePart):
    out = []
    open_ties = {}
    for n in sorted(part.notes, key=lambda x: (x.onset, x.midi)):
        if n.is_rest:
            continue
        if n.tie_stop and n.midi in open_ties:
            held = open_ties[n.midi]
            held.duration = (n.onset + n.duration) - held.onset
            if not n.tie_start:
                del open_ties[n.midi]
            continue
        out.append(n)
        if n.tie_start:
            open_ties[n.midi] = n
    return out


def score_summary(score: Score) -> dict:
    return {
        'title': score.title,
        'parts': [{'id': p.part_id, 'name': p.name,
                   'notes': len([n for n in p.notes if not n.is_rest]),
                   'percussion': p.is_percussion} for p in score.parts],
        'time': f'{score.beats}/{score.beat_type}',
        'tempo': score.initial_tempo,
        'beats_total': round(score.total_beats(), 3),
    }


__all__ = ['Score', 'ScorePart', 'ScoreNote', 'Direction',
           'parse_musicxml', 'merge_ties', 'score_summary',
           'DYNAMIC_TAGS']
