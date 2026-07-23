import json
import math

DIVISIONS = 480

_STEP_FOR_SEMI = {0: ('C', 0), 1: ('C', 1), 2: ('D', 0), 3: ('D', 1),
                  4: ('E', 0), 5: ('F', 0), 6: ('F', 1), 7: ('G', 0),
                  8: ('G', 1), 9: ('A', 0), 10: ('A', 1), 11: ('B', 0)}

_TYPE_BEATS = [(4.0, 'whole'), (2.0, 'half'), (1.0, 'quarter'),
               (0.5, 'eighth'), (0.25, '16th'), (0.125, '32nd'),
               (0.0625, '64th')]


def _pitch_xml(midi):
    midi = max(0, min(127, int(midi)))
    step, alter = _STEP_FOR_SEMI[midi % 12]
    octave = midi // 12 - 1
    alter_el = '<alter>1</alter>' if alter else ''
    return (f'<pitch><step>{step}</step>{alter_el}'
            f'<octave>{octave}</octave></pitch>')


def _type_xml(beats):
    for base, name in _TYPE_BEATS:
        if abs(beats - base) < 1e-6:
            return f'<type>{name}</type>'
        if abs(beats - base * 1.5) < 1e-6:
            return f'<type>{name}</type><dot/>'
    return ''


def _ticks(beats):
    return max(1, int(round(beats * DIVISIONS)))


def _clean_notes(raw_notes):
    out = []
    for n in raw_notes or []:
        try:
            midi = int(n['midi'])
            start = float(n['start'])
            dur = float(n['dur'])
        except (KeyError, TypeError, ValueError):
            continue
        if not (0 <= midi <= 127) or dur <= 0 or start < 0:
            continue
        vel = None
        raw_vel = n.get('vel')
        if raw_vel is not None:
            try:
                vel = max(0.0, min(1.0, float(raw_vel)))
            except (TypeError, ValueError):
                vel = None
        out.append({'midi': midi, 'start': round(start, 6),
                    'dur': round(dur, 6), 'vel': vel})
    out.sort(key=lambda n: (n['start'], -n['dur'], n['midi']))
    return out


def _assign_voices(notes):
    voices = []
    for n in notes:
        entry = (n['midi'], n.get('vel'))
        placed = False
        for voice in voices:
            last = voice[-1]
            if abs(last['start'] - n['start']) < 1e-6 and \
                    abs(last['dur'] - n['dur']) < 1e-6:
                last['heads'].append(entry)
                placed = True
                break
            if last['start'] + last['dur'] <= n['start'] + 1e-6:
                voice.append({'start': n['start'], 'dur': n['dur'],
                              'heads': [entry]})
                placed = True
                break
        if not placed:
            voices.append([{'start': n['start'], 'dur': n['dur'],
                            'heads': [entry]}])
    return voices


def _split_at_bars(event, bar_len):
    segs = []
    start = event['start']
    remaining = event['dur']
    while remaining > 1e-6:
        bar_end = (math.floor(start / bar_len + 1e-6) + 1) * bar_len
        piece = min(remaining, bar_end - start)
        segs.append({'start': start, 'dur': piece,
                     'heads': event['heads']})
        start += piece
        remaining -= piece
    for i, seg in enumerate(segs):
        seg['tie_start'] = i < len(segs) - 1
        seg['tie_stop'] = i > 0
    return segs


def _rest_xml(beats):
    return (f'<note><rest/><duration>{_ticks(beats)}</duration>'
            f'{_type_xml(beats)}<voice>1</voice></note>')


def _event_xml(seg, voice_num, percussion_pid=None):
    ties = ''
    notations = ''
    if seg.get('tie_start'):
        ties += '<tie type="start"/>'
        notations += '<tied type="start"/>'
    if seg.get('tie_stop'):
        ties += '<tie type="stop"/>'
        notations += '<tied type="stop"/>'
    notations_el = f'<notations>{notations}</notations>' if notations else ''
    dur = f'<duration>{_ticks(seg["dur"])}</duration>'
    typ = _type_xml(seg['dur'])
    body = ''
    for i, (midi, vel) in enumerate(sorted(seg['heads'])):
        chord = '<chord/>' if i else ''
        dyn_attr = ''
        if vel is not None:
            dyn_attr = f' dynamics="{vel * 127.0 / 0.9:.1f}"'
        if percussion_pid:
            body += (f'<note{dyn_attr}>{chord}<unpitched><display-step>C'
                     '</display-step><display-octave>4</display-octave>'
                     f'</unpitched>{dur}{ties}'
                     f'<instrument id="{percussion_pid}-I{midi}"/>'
                     f'<voice>{voice_num}</voice>{typ}{notations_el}</note>')
        else:
            body += (f'<note{dyn_attr}>{chord}{_pitch_xml(midi)}{dur}{ties}'
                     f'{typ}<voice>{voice_num}</voice>{notations_el}</note>')
    return body


def _voice_measure_xml(segs, m_index, bar_len, voice_num,
                       percussion_pid=None):
    m_start = m_index * bar_len
    m_end = m_start + bar_len
    pos = m_start
    body = ''
    for seg in segs:
        if seg['start'] >= m_end - 1e-6 or \
                seg['start'] + seg['dur'] <= m_start + 1e-6:
            continue
        if seg['start'] > pos + 1e-6:
            body += _rest_xml(seg['start'] - pos)
        body += _event_xml(seg, voice_num, percussion_pid)
        pos = seg['start'] + seg['dur']
    if pos < m_end - 1e-6:
        body += _rest_xml(m_end - pos)
    return body


def notes_to_musicxml(state_json):
    try:
        state = json.loads(state_json) if isinstance(state_json, str) \
            else dict(state_json or {})
    except (TypeError, ValueError):
        raise RuntimeError('Score Editor: invalid notes JSON')
    tempo = min(400.0, max(20.0, float(state.get('tempo') or 120)))
    beats_per_bar = min(12, max(1, int(state.get('beats_per_bar') or 4)))
    beat_type = int(state.get('beat_type') or 4)
    if beat_type not in (1, 2, 4, 8, 16):
        beat_type = 4
    from .gm_programs import GM_PROGRAMS

    parts_in = state.get('parts') or []
    parts = []
    for i, p in enumerate(parts_in):
        notes = _clean_notes((p or {}).get('notes'))
        name = str((p or {}).get('name') or f'Part {i + 1}')[:40]
        raw_prog = (p or {}).get('program')
        program = -1
        if isinstance(raw_prog, str) and raw_prog in GM_PROGRAMS:
            program = GM_PROGRAMS[raw_prog]
        elif isinstance(raw_prog, (int, float)):
            program = max(0, min(127, int(raw_prog)))
        parts.append({'name': name, 'notes': notes,
                      'percussion': bool((p or {}).get('percussion')),
                      'program': program})
    parts = [p for p in parts if p['notes']]
    if not parts:
        raise RuntimeError('Score Editor: no notes to export')

    bar_len = float(beats_per_bar)
    total_bars = 1
    for p in parts:
        for n in p['notes']:
            total_bars = max(total_bars,
                             math.ceil((n['start'] + n['dur'] - 1e-6)
                                       / bar_len))

    def _score_part_xml(i, p):
        pid = f'P{i + 1}'
        if not p['percussion']:
            inst = ''
            if p['program'] >= 0:
                inst = (f'<score-instrument id="{pid}-I1">'
                        f'<instrument-name>{p["name"]}</instrument-name>'
                        '</score-instrument>'
                        f'<midi-instrument id="{pid}-I1">'
                        f'<midi-program>{p["program"] + 1}</midi-program>'
                        '</midi-instrument>')
            return (f'<score-part id="{pid}"><part-name>{p["name"]}'
                    f'</part-name>{inst}</score-part>')
        keys = sorted({n['midi'] for n in p['notes']})
        insts = ''.join(
            f'<score-instrument id="{pid}-I{k}"><instrument-name>'
            f'Drum {k}</instrument-name></score-instrument>' for k in keys)
        maps = ''.join(
            f'<midi-instrument id="{pid}-I{k}"><midi-unpitched>{k + 1}'
            '</midi-unpitched></midi-instrument>' for k in keys)
        return (f'<score-part id="{pid}"><part-name>{p["name"]}'
                f'</part-name>{insts}{maps}</score-part>')

    part_list = ''.join(_score_part_xml(i, p) for i, p in enumerate(parts))

    bodies = ''
    for pi, part in enumerate(parts):
        pid = f'P{pi + 1}'
        perc_pid = pid if part['percussion'] else None
        voices = _assign_voices(part['notes'])
        voice_segs = [
            [seg for ev in voice for seg in _split_at_bars(ev, bar_len)]
            for voice in voices]
        measures = ''
        for m in range(total_bars):
            body = ''
            if m == 0:
                clef = '<clef><sign>percussion</sign></clef>' \
                    if part['percussion'] else ''
                body += (f'<attributes><divisions>{DIVISIONS}</divisions>'
                         '<key><fifths>0</fifths></key>'
                         f'<time><beats>{beats_per_bar}</beats>'
                         f'<beat-type>{beat_type}</beat-type></time>'
                         f'{clef}</attributes>')
                if pi == 0:
                    body += (f'<direction><sound tempo="{tempo:g}"/>'
                             '</direction>')
            for vi, segs in enumerate(voice_segs):
                if vi > 0:
                    body += (f'<backup><duration>'
                             f'{_ticks(bar_len)}</duration></backup>')
                body += _voice_measure_xml(segs, m, bar_len, vi + 1,
                                           perc_pid)
            measures += f'<measure number="{m + 1}">{body}</measure>'
        bodies += f'<part id="{pid}">{measures}</part>'

    return ('<?xml version="1.0" encoding="UTF-8"?>'
            '<score-partwise version="4.0">'
            f'<part-list>{part_list}</part-list>{bodies}</score-partwise>')


def musicxml_to_editor(xml_text):
    from .score_model import parse_musicxml, merge_ties

    from .gm_programs import GM_NAME_BY_PROGRAM

    score = parse_musicxml(xml_text)
    parts = []
    for part in score.parts:
        merged = merge_ties(part)
        notes = []
        for n in merged:
            if n.midi < 0 or n.duration <= 0:
                continue
            note = {'midi': n.midi, 'start': round(n.onset, 6),
                    'dur': round(n.duration, 6)}
            if n.velocity >= 0:
                note['vel'] = round(n.velocity, 4)
            notes.append(note)
        if notes:
            entry = {'name': part.name or part.part_id,
                     'notes': notes,
                     'percussion': part.is_percussion}
            prog_name = GM_NAME_BY_PROGRAM.get(part.midi_program)
            if prog_name and not part.is_percussion:
                entry['program'] = prog_name
            parts.append(entry)
    if not parts:
        raise RuntimeError('Score Editor: nothing importable')
    return {
        'tempo': score.initial_tempo,
        'beats_per_bar': score.beats,
        'beat_type': score.beat_type,
        'parts': parts,
        'skipped_percussion': 0,
    }
