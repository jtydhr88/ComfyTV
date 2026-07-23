"""Symbolic music lane: MusicXML -> rules -> events -> SMF/synth."""
import json
import struct
from pathlib import Path

import pytest

np = pytest.importorskip("numpy")

_SF3 = Path(r'H:\MuseScore\share\sound\FluidR3Mono_GM.sf3')


def _xml(measures_p1, measures_p2=None, tempo=120):
    parts = ['<score-part id="P1"><part-name>A</part-name></score-part>']
    bodies = [f'''<part id="P1">{measures_p1}</part>''']
    if measures_p2 is not None:
        parts.append(
            '<score-part id="P2"><part-name>B</part-name></score-part>')
        bodies.append(f'<part id="P2">{measures_p2}</part>')
    return f'''<?xml version="1.0"?>
<score-partwise version="4.0">
  <part-list>{''.join(parts)}</part-list>
  {''.join(bodies)}
</score-partwise>'''


_ATTRS = '''<attributes><divisions>2</divisions>
  <time><beats>4</beats><beat-type>4</beat-type></time></attributes>
  <direction><sound tempo="120"/></direction>'''


def _note(step, octave, dur=2, ntype='quarter', extra=''):
    return (f'<note><pitch><step>{step}</step><octave>{octave}</octave>'
            f'</pitch><duration>{dur}</duration><type>{ntype}</type>'
            f'{extra}</note>')


class TestParser:
    def test_basic_notes_and_tempo(self):
        from ComfyTV.runners.score_model import parse_musicxml
        xml = _xml(f'<measure number="1">{_ATTRS}'
                   + _note('C', 4) + _note('E', 4) + _note('G', 4)
                   + _note('C', 5) + '</measure>')
        s = parse_musicxml(xml)
        assert s.initial_tempo == 120
        midis = [n.midi for n in s.parts[0].notes]
        assert midis == [60, 64, 67, 72]
        assert s.parts[0].notes[1].onset == 1.0

    def test_chord_and_tie(self):
        from ComfyTV.runners.score_model import parse_musicxml, merge_ties
        xml = _xml(f'<measure number="1">{_ATTRS}'
                   + _note('C', 4, 4, 'half',
                           '<tie type="start"/>')
                   + _note('E', 4, 4, 'half', '<chord/>')
                   + '</measure><measure number="2">'
                   + _note('C', 4, 4, 'half', '<tie type="stop"/>')
                   + '</measure>')
        s = parse_musicxml(xml)
        chord_notes = [n for n in s.parts[0].notes if n.onset == 0.0]
        assert len(chord_notes) == 2
        merged = merge_ties(s.parts[0])
        c4 = [n for n in merged if n.midi == 60]
        assert len(c4) == 1
        assert c4[0].duration == pytest.approx(4.0)

    def test_backup_two_voices(self):
        from ComfyTV.runners.score_model import parse_musicxml
        xml = _xml(f'<measure number="1">{_ATTRS}'
                   + _note('C', 5, 8, 'whole')
                   + '<backup><duration>8</duration></backup>'
                   + _note('C', 3, 8, 'whole')
                   + '</measure>')
        s = parse_musicxml(xml)
        onsets = [n.onset for n in s.parts[0].notes]
        assert onsets == [0.0, 0.0]

    def test_rejects_garbage(self):
        from ComfyTV.runners.score_model import parse_musicxml
        with pytest.raises(RuntimeError, match="parse error|empty"):
            parse_musicxml("<not-xml")

    def test_overfull_measure_aligns_parts_on_shared_grid(self):
        from ComfyTV.runners.score_model import parse_musicxml
        p1 = (f'<measure number="1">{_ATTRS}'
              + _note('C', 5, 8, 'whole') + _note('D', 5, 8, 'whole')
              + '</measure><measure number="2">'
              + _note('E', 5, 8, 'whole') + '</measure>')
        p2 = (f'<measure number="1">{_ATTRS}'
              + _note('C', 3, 8, 'whole')
              + '</measure><measure number="2">'
              + _note('D', 3, 8, 'whole')
              + '</measure><measure number="3">'
              + _note('E', 3, 8, 'whole') + '</measure>')
        s = parse_musicxml(_xml(p1, p2))
        p1_onsets = [n.onset for n in s.parts[0].notes]
        p2_onsets = [n.onset for n in s.parts[1].notes]
        assert p1_onsets == [0.0, 4.0, 8.0]
        assert p2_onsets == [0.0, 8.0, 12.0]

    def test_short_pickup_measure_keeps_content_length(self):
        from ComfyTV.runners.score_model import parse_musicxml
        p1 = (f'<measure number="0">{_ATTRS}'
              + _note('G', 4, 1, 'eighth') + '</measure>'
              + '<measure number="1">'
              + _note('C', 5, 8, 'whole') + '</measure>')
        p2 = (f'<measure number="0">{_ATTRS}'
              + _note('G', 3, 1, 'eighth') + '</measure>'
              + '<measure number="1">'
              + _note('C', 3, 8, 'whole') + '</measure>')
        s = parse_musicxml(_xml(p1, p2))
        assert [n.onset for n in s.parts[0].notes] == [0.0, 0.5]
        assert [n.onset for n in s.parts[1].notes] == [0.0, 0.5]


class TestPerform:
    def _score(self, extra_first='', dyn=''):
        from ComfyTV.runners.score_model import parse_musicxml
        xml = _xml(f'<measure number="1">{_ATTRS}{dyn}'
                   + _note('C', 4, 1, 'eighth', extra_first)
                   + _note('D', 4, 1, 'eighth') + _note('E', 4, 1, 'eighth')
                   + _note('F', 4, 1, 'eighth') + _note('G', 4, 2)
                   + _note('A', 4, 2) + '</measure>')
        return parse_musicxml(xml)

    def test_staccato_shortens(self):
        from ComfyTV.runners.score_perform import perform_score
        plain = perform_score(self._score())
        stac = perform_score(self._score(
            '<notations><articulations><staccato/></articulations>'
            '</notations>'))
        assert stac['events'][0]['dur'] < plain['events'][0]['dur'] * 0.6

    def test_accent_louder(self):
        from ComfyTV.runners.score_perform import perform_score
        plain = perform_score(self._score())
        acc = perform_score(self._score(
            '<notations><articulations><accent/></articulations>'
            '</notations>'))
        assert acc['events'][0]['vel'] > plain['events'][0]['vel']

    def test_dynamics_mapping(self):
        from ComfyTV.runners.score_perform import perform_score
        loud = perform_score(self._score(
            dyn='<direction><direction-type><dynamics><ff/></dynamics>'
                '</direction-type></direction>'))
        soft = perform_score(self._score(
            dyn='<direction><direction-type><dynamics><pp/></dynamics>'
                '</direction-type></direction>'))
        assert loud['events'][0]['vel'] > soft['events'][0]['vel'] + 20

    def test_swing_shifts_offbeats(self):
        from ComfyTV.runners.score_perform import perform_score
        straight = perform_score(self._score(), swing_ratio=50.0)
        swung = perform_score(self._score(), swing_ratio=66.0)
        assert swung['events'][1]['t'] > straight['events'][1]['t'] + 0.05
        assert swung['events'][0]['t'] == pytest.approx(
            straight['events'][0]['t'])

    def test_trill_expands(self):
        from ComfyTV.runners.score_perform import perform_score
        trilled = perform_score(self._score(
            '<notations><ornaments><trill-mark/></ornaments>'
            '</notations>'))
        plain = perform_score(self._score())
        assert len(trilled['events']) > len(plain['events'])
        midis = {e['midi'] for e in trilled['events'][:4]}
        assert 62 in midis

    def test_tempo_change_maps_time(self):
        from ComfyTV.runners.score_model import parse_musicxml
        from ComfyTV.runners.score_perform import perform_score
        xml = _xml(f'<measure number="1">{_ATTRS}'
                   + _note('C', 4, 8, 'whole')
                   + '</measure><measure number="2">'
                   + '<direction><sound tempo="60"/></direction>'
                   + _note('D', 4, 8, 'whole') + '</measure>'
                   + '<measure number="3">'
                   + _note('E', 4, 8, 'whole') + '</measure>')
        perf = perform_score(parse_musicxml(xml))
        ts = {e['midi']: e['t'] for e in perf['events']}
        assert ts[62] == pytest.approx(2.0, abs=1e-3)
        assert ts[64] == pytest.approx(6.0, abs=1e-3)

    def test_humanize_deterministic(self):
        from ComfyTV.runners.score_perform import perform_score
        a = perform_score(self._score(), humanize=0.5, seed=3)
        b = perform_score(self._score(), humanize=0.5, seed=3)
        c = perform_score(self._score(), humanize=0.5, seed=4)
        assert a == b
        assert a != c


class TestSmf:
    def test_writes_valid_smf(self):
        from ComfyTV.runners.midi_file import write_smf
        from ComfyTV.runners.media import localize
        perf = {'tempo_map': [{'beat': 0.0, 't': 0.0, 'bpm': 100.0}],
                'events': [
                    {'t': 0.0, 'dur': 0.5, 'midi': 60, 'vel': 100, 'ch': 0},
                    {'t': 0.6, 'dur': 0.5, 'midi': 64, 'vel': 90, 'ch': 0},
                    {'t': 0.0, 'dur': 0.2, 'midi': 38, 'vel': 110, 'ch': 9},
                ]}
        url = write_smf(perf, programs={0: 0})
        data = Path(localize(url)).read_bytes()
        assert data[:4] == b'MThd'
        fmt, ntrk, ppq = struct.unpack('>HHH', data[8:14])
        assert fmt == 1
        assert ntrk == 3
        assert ppq == 480
        assert data.count(b'MTrk') == 3


class TestSynthFallback:
    def _perf(self):
        return {'tempo_map': [{'beat': 0.0, 't': 0.0, 'bpm': 120.0}],
                'events': [
                    {'t': 0.0, 'dur': 0.5, 'midi': 60, 'vel': 100, 'ch': 0},
                    {'t': 0.5, 'dur': 0.5, 'midi': 67, 'vel': 100, 'ch': 0},
                    {'t': 1.0, 'dur': 0.2, 'midi': 38, 'vel': 110, 'ch': 9},
                ]}

    def test_renders_audio(self):
        from ComfyTV.runners.score_synth import synthesize_events
        buf = synthesize_events(self._perf())
        assert buf.shape[0] == 2
        assert float(np.abs(buf).max()) > 0.1

    def test_click_track(self):
        from ComfyTV.runners.score_synth import click_track_events
        perf = click_track_events(bpm=120.0, beats_per_bar=4, bars=2)
        assert len(perf['events']) == 8
        assert perf['events'][0]['midi'] == 76
        assert perf['events'][1]['midi'] == 77
        assert perf['events'][4]['midi'] == 76

    def test_click_from_labels(self):
        from ComfyTV.runners.score_synth import click_track_from_labels
        labels = json.dumps([{'start': i * 0.5} for i in range(8)])
        perf = click_track_from_labels(labels)
        assert len(perf['events']) == 8
        assert perf['tempo_map'][0]['bpm'] == pytest.approx(120.0, abs=1.0)


@pytest.mark.skipif(not _SF3.exists(), reason="FluidR3 sf3 not on disk")
class TestSf2Engine:
    def test_parses_and_matches(self):
        from ComfyTV.runners.sf2_synth import load_soundfont
        sf = load_soundfont(str(_SF3))
        assert len(sf._presets) > 100
        assert len(sf.voices_for(0, 0, 60, 96)) >= 1
        assert len(sf.voices_for(128, 0, 38, 100)) >= 1

    def test_renders_piano(self):
        from ComfyTV.runners.sf2_synth import render_sf2
        perf = {'events': [
            {'t': 0.0, 'dur': 1.0, 'midi': 60, 'vel': 100, 'ch': 0}]}
        buf = render_sf2(perf, str(_SF3))
        assert float(np.abs(buf).max()) > 0.1
        spec = np.abs(np.fft.rfft(buf[0][:44100]))
        freqs = np.fft.rfftfreq(44100, 1 / 44100)
        peak = freqs[int(np.argmax(spec))]
        assert abs(peak - 261.6) < 8.0 or abs(peak - 523.2) < 12.0

    def test_pitch_tracks_key(self):
        from ComfyTV.runners.sf2_synth import render_sf2
        from ComfyTV.runners.audio_mir import _yin_pitch

        def fundamental(midi):
            perf = {'events': [
                {'t': 0.0, 'dur': 1.0, 'midi': midi, 'vel': 100, 'ch': 0}]}
            buf = render_sf2(perf, str(_SF3))
            seg = buf[0][2205:2205 + 8192].astype(np.float64)
            return _yin_pitch(seg, 44100, fmin=60.0, fmax=1200.0,
                              threshold=0.3)

        f60 = fundamental(60)
        f72 = fundamental(72)
        assert abs(f60 - 261.6) < 12.0
        assert abs(f72 - 523.2) < 20.0


class TestStages:
    def _demo_xml(self):
        return _xml(f'<measure number="1">{_ATTRS}'
                    + _note('A', 4) + _note('C', 5) + _note('B', 4)
                    + _note('E', 4) + '</measure>')

    def test_full_chain(self):
        from ComfyTV.nodes.stages.score_stages import (
            ScoreStage, ScoreToMidiStage, SF2SynthStage,
        )
        score_out = ScoreStage.execute(project_id='p1',
                                       musicxml=self._demo_xml())
        score_text = score_out.values[0]
        perf_out = ScoreToMidiStage.execute(project_id='p1',
                                            score=score_text)
        perf_json = perf_out.values[0]
        midi_url = perf_out.values[1]
        assert midi_url.startswith('/view')
        events = json.loads(perf_json)['events']
        assert len(events) == 4
        audio_out = SF2SynthStage.execute(project_id='p1',
                                          performance=perf_json)
        assert audio_out.values[0].startswith('/view')

    def test_click_stage(self):
        from ComfyTV.nodes.stages.score_stages import ClickTrackStage
        out = ClickTrackStage.execute(project_id='p1', bpm=100.0, bars=2)
        assert out.values[0].startswith('/view')
        perf = json.loads(out.values[1])
        assert len(perf['events']) == 8

    def test_score_stage_rejects_empty(self):
        from ComfyTV.nodes.stages.score_stages import ScoreStage
        with pytest.raises(RuntimeError, match="needs MusicXML"):
            ScoreStage.execute(project_id='p1')


class TestUnpitchedDrums:
    def test_midi_from_instrument_map(self):
        from ComfyTV.runners.score_model import parse_musicxml
        xml = """<?xml version="1.0"?>
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Drums</part-name>
      <score-instrument id="P1-I36"><instrument-name>Kick</instrument-name></score-instrument>
      <score-instrument id="P1-I38"><instrument-name>Snare</instrument-name></score-instrument>
      <midi-instrument id="P1-I36"><midi-channel>10</midi-channel><midi-unpitched>37</midi-unpitched></midi-instrument>
      <midi-instrument id="P1-I38"><midi-channel>10</midi-channel><midi-unpitched>39</midi-unpitched></midi-instrument>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions>
        <clef><sign>percussion</sign></clef></attributes>
      <note><unpitched><display-step>F</display-step><display-octave>4</display-octave></unpitched>
        <duration>2</duration><instrument id="P1-I36"/><type>quarter</type></note>
      <note><unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched>
        <duration>2</duration><instrument id="P1-I38"/><type>quarter</type></note>
      <note><unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched>
        <duration>2</duration><type>quarter</type></note>
      <note><unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched>
        <duration>2</duration><instrument id="P1-I38"/><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>"""
        s = parse_musicxml(xml)
        part = s.parts[0]
        assert part.is_percussion
        midis = [n.midi for n in part.notes]
        assert midis == [36, 38, 38, 38]

    def test_percussion_channel_in_perform(self):
        from ComfyTV.runners.score_model import parse_musicxml
        from ComfyTV.runners.score_perform import perform_score
        xml = """<?xml version="1.0"?>
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1">
      <midi-instrument id="P1-I36"><midi-unpitched>37</midi-unpitched></midi-instrument>
    </score-part>
  </part-list>
  <part id="P1"><measure number="1">
    <attributes><divisions>1</divisions></attributes>
    <direction><sound tempo="120"/></direction>
    <note><unpitched><display-step>F</display-step><display-octave>4</display-octave></unpitched>
      <duration>1</duration><instrument id="P1-I36"/><type>quarter</type></note>
  </measure></part>
</score-partwise>"""
        perf = perform_score(parse_musicxml(xml))
        assert perf["events"][0]["ch"] == 9
        assert perf["events"][0]["midi"] == 36


class TestPerformanceCarriesScore:
    def test_musicxml_embedded(self):
        import json as _json
        from ComfyTV.nodes.stages.score_stages import ScoreToMidiStage
        xml = _xml('<measure number="1">' + _ATTRS
                   + _note('C', 4, 8, 'whole') + '</measure>')
        out = ScoreToMidiStage.execute(project_id='p1', score=xml)
        perf = _json.loads(out.values[0])
        assert '<score-partwise' in perf.get('musicxml', '')
        assert perf['events']


class TestMuseReverb:
    def _impulse(self, seconds=1.0):
        x = np.zeros((2, int(44100 * seconds)))
        x[:, 100] = 0.9
        return x

    def test_tail_decays_stably(self):
        from ComfyTV.runners.muse_reverb import muse_reverb
        y = muse_reverb(self._impulse(), reverb_time_ms=1500.0,
                        dry_db=-60.0, late_db=0.0, er_db=-20.0)
        assert np.isfinite(y).all()
        env = np.abs(y).mean(axis=0)

        def rms_db(t):
            seg = env[int(t * 44100):int(t * 44100) + 4410]
            return 20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-12)

        assert rms_db(0.4) > rms_db(1.0) > rms_db(1.8)
        assert rms_db(0.4) - rms_db(1.8) > 15

    def test_longer_time_longer_tail(self):
        from ComfyTV.runners.muse_reverb import muse_reverb
        short = muse_reverb(self._impulse(), reverb_time_ms=600.0,
                            dry_db=-60.0, late_db=0.0, er_db=-60.0,
                            tail_s=2.5)
        long = muse_reverb(self._impulse(), reverb_time_ms=3000.0,
                           dry_db=-60.0, late_db=0.0, er_db=-60.0,
                           tail_s=2.5)
        e_short = float((short[:, 44100:] ** 2).sum())
        e_long = float((long[:, 44100:] ** 2).sum())
        assert e_long > e_short * 3

    def test_quality8_runs(self):
        from ComfyTV.runners.muse_reverb import muse_reverb
        y = muse_reverb(self._impulse(0.5), quality=8, tail_s=1.0)
        assert y.shape[0] == 2
        assert np.isfinite(y).all()


class TestChordAccomp:
    def test_parse_chords(self):
        from ComfyTV.runners.chord_accomp import parse_chord
        root, iv, bass = parse_chord('Am7')
        assert root == 9
        assert iv == (0, 3, 7, 10)
        root, iv, bass = parse_chord('C/E')
        assert root == 0
        assert bass == 4
        root, iv, _ = parse_chord('F#m7b5')
        assert root == 6
        assert iv == (0, 3, 6, 10)

    def test_voicing_close_range(self):
        from ComfyTV.runners.chord_accomp import voice_chord
        notes = voice_chord(9, (0, 3, 7, 10), voicing='close')
        assert notes[0] < 60
        assert all(60 <= n < 72 for n in notes[1:])

    def test_accompaniment_events(self):
        from ComfyTV.runners.chord_accomp import chord_accompaniment
        perf = chord_accompaniment('Am7 | Dm7 | G7 | Cmaj7', bpm=120.0,
                                   pattern='block')
        assert perf['events']
        last = max(e['t'] + e['dur'] for e in perf['events'])
        assert abs(last - 8.0) < 0.5
        perf2 = chord_accompaniment('Am7', pattern='broken')
        assert len(perf2['events']) >= 8

    def test_bad_chord_raises(self):
        from ComfyTV.runners.chord_accomp import chord_accompaniment
        with pytest.raises(RuntimeError, match="cannot parse|unknown"):
            chord_accompaniment('Hm7')

    def test_stage(self):
        import json as _json
        from ComfyTV.nodes.stages.score_stages import ChordAccompStage
        out = ChordAccompStage.execute(project_id='p1',
                                       progression='Am | F | C | G',
                                       pattern='alberti')
        perf = _json.loads(out.values[0])
        assert perf['events']
        assert out.values[1].startswith('/view')


class TestProfiles:
    def test_profile_changes_articulation(self):
        from ComfyTV.runners.score_perform import PROFILE_ARTICULATIONS
        kb = PROFILE_ARTICULATIONS['keyboard']
        st = PROFILE_ARTICULATIONS['strings']
        assert kb['standard']['dur'] == pytest.approx(0.95)
        assert st['standard']['dur'] == pytest.approx(0.99)
        assert st['accent']['vel'] > kb['accent']['vel']

    def test_perform_uses_profile(self):
        from ComfyTV.runners.score_model import parse_musicxml
        from ComfyTV.runners.score_perform import perform_score
        xml = _xml('<measure number="1">' + _ATTRS
                   + _note('C', 4, 2) + _note('D', 4, 2)
                   + _note('E', 4, 2) + _note('F', 4, 2) + '</measure>')
        kb = perform_score(parse_musicxml(xml), profile='keyboard')
        st = perform_score(parse_musicxml(xml), profile='strings')
        assert st['events'][0]['dur'] > kb['events'][0]['dur']


@pytest.mark.skipif(not _SF3.exists(), reason="FluidR3 sf3 not on disk")
class TestSf2FilterVibrato:
    def test_render_still_correct_pitch(self):
        from ComfyTV.runners.sf2_synth import render_sf2
        from ComfyTV.runners.audio_mir import _yin_pitch
        perf = {'events': [
            {'t': 0.0, 'dur': 1.0, 'midi': 60, 'vel': 100, 'ch': 0}]}
        buf = render_sf2(perf, str(_SF3))
        seg = buf[0][2205:2205 + 8192].astype(np.float64)
        f = _yin_pitch(seg, 44100, threshold=0.3)
        assert abs(f - 261.6) < 12.0

    def test_strings_program_renders(self):
        from ComfyTV.runners.sf2_synth import render_sf2
        perf = {'events': [
            {'t': 0.0, 'dur': 1.5, 'midi': 64, 'vel': 100, 'ch': 0}]}
        buf = render_sf2(perf, str(_SF3), programs={0: 48})
        assert float(np.abs(buf).max()) > 0.05


class TestRepeats:
    def _bar(self, num, note, extra=''):
        return (f'<measure number="{num}">{extra}'
                + _note(note, 4, 8, 'whole') + '</measure>')

    def test_simple_repeat_doubles(self):
        from ComfyTV.runners.score_model import parse_musicxml
        xml = _xml(
            f'<measure number="1">{_ATTRS}'
            '<barline location="left"><repeat direction="forward"/></barline>'
            + _note('C', 4, 8, 'whole') + '</measure>'
            + '<measure number="2">'
            '<barline location="right"><repeat direction="backward"/></barline>'
            + _note('D', 4, 8, 'whole') + '</measure>'
            + self._bar(3, 'E'))
        s = parse_musicxml(xml)
        midis = [n.midi for n in s.parts[0].notes]
        assert midis == [60, 62, 60, 62, 64]
        assert s.total_beats() == pytest.approx(20.0)

    def test_voltas_first_then_second(self):
        from ComfyTV.runners.score_model import parse_musicxml
        xml = _xml(
            f'<measure number="1">{_ATTRS}'
            + _note('C', 4, 8, 'whole') + '</measure>'
            + '<measure number="2">'
            '<barline location="left"><ending number="1" type="start"/></barline>'
            + _note('D', 4, 8, 'whole')
            + '<barline location="right"><ending number="1" type="stop"/>'
            '<repeat direction="backward"/></barline></measure>'
            + '<measure number="3">'
            '<barline location="left"><ending number="2" type="start"/></barline>'
            + _note('E', 4, 8, 'whole')
            + '<barline location="right"><ending number="2" type="stop"/>'
            '</barline></measure>'
            + self._bar(4, 'F'))
        s = parse_musicxml(xml)
        midis = [n.midi for n in s.parts[0].notes]
        assert midis == [60, 62, 60, 64, 65]

    def test_no_repeats_unchanged(self):
        from ComfyTV.runners.score_model import parse_musicxml
        xml = _xml(f'<measure number="1">{_ATTRS}'
                   + _note('C', 4, 8, 'whole') + '</measure>'
                   + self._bar(2, 'D'))
        s = parse_musicxml(xml)
        assert [n.midi for n in s.parts[0].notes] == [60, 62]

    def test_repeat_times_three(self):
        from ComfyTV.runners.score_model import parse_musicxml
        xml = _xml(
            f'<measure number="1">{_ATTRS}'
            '<barline location="left"><repeat direction="forward"/></barline>'
            + _note('C', 4, 8, 'whole')
            + '<barline location="right">'
            '<repeat direction="backward" times="3"/></barline></measure>')
        s = parse_musicxml(xml)
        assert [n.midi for n in s.parts[0].notes] == [60, 60, 60]
