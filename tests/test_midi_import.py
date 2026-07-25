"""SMF import: midifile.cpp read semantics + write_smf roundtrip."""
import struct

import pytest


def _vlq(value):
    out = [value & 0x7F]
    value >>= 7
    while value:
        out.append((value & 0x7F) | 0x80)
        value >>= 7
    return bytes(reversed(out))


def _smf(tracks, fmt=1, division=480):
    chunks = b''
    for payload in tracks:
        chunks += b'MTrk' + struct.pack('>I', len(payload)) + payload
    return (b'MThd' + struct.pack('>IHHH', 6, fmt, len(tracks), division)
            + chunks)


_EOT = _vlq(0) + bytes([0xFF, 0x2F, 0x00])


def _tempo_meta(delta, usec):
    return _vlq(delta) + bytes([0xFF, 0x51, 0x03]) + usec.to_bytes(3, 'big')


class TestParse:
    def test_basic_notes(self):
        from ComfyTV.runners.midi_import import parse_smf
        track = (_tempo_meta(0, 500000)
                 + _vlq(0) + bytes([0x90, 60, 100])
                 + _vlq(480) + bytes([0x80, 60, 64])
                 + _vlq(0) + bytes([0x90, 64, 90])
                 + _vlq(480) + bytes([0x80, 64, 64])
                 + _EOT)
        perf = parse_smf(_smf([track]))
        ev = perf['events']
        assert [(e['midi'], e['t'], e['dur'], e['vel']) for e in ev] == [
            (60, 0.0, 0.5, 100), (64, 0.5, 0.5, 90)]
        assert perf['tempo_map'][0]['bpm'] == pytest.approx(120.0)

    def test_running_status_and_vel0_off(self):
        from ComfyTV.runners.midi_import import parse_smf
        track = (_vlq(0) + bytes([0x90, 60, 100])
                 + _vlq(240) + bytes([60, 0])
                 + _vlq(0) + bytes([64, 90])
                 + _vlq(240) + bytes([64, 0])
                 + _EOT)
        perf = parse_smf(_smf([track]))
        assert [(e['midi'], e['t'], e['dur']) for e in perf['events']] == [
            (60, 0.0, 0.25), (64, 0.25, 0.25)]

    def test_running_status_survives_meta(self):
        from ComfyTV.runners.midi_import import parse_smf
        name = b'\xff\x03\x05hello'
        track = (_vlq(0) + bytes([0x90, 60, 100])
                 + _vlq(120) + name
                 + _vlq(120) + bytes([60, 0])
                 + _EOT)
        perf = parse_smf(_smf([track]))
        assert [(e['midi'], e['dur']) for e in perf['events']] == [(60, 0.25)]

    def test_no_running_status_rejected(self):
        from ComfyTV.runners.midi_import import parse_smf
        track = _vlq(0) + bytes([60, 100]) + _EOT
        with pytest.raises(RuntimeError, match='running status'):
            parse_smf(_smf([track]))

    def test_program_change_and_channels(self):
        from ComfyTV.runners.midi_import import parse_smf
        track = (_vlq(0) + bytes([0xC0, 33])
                 + _vlq(0) + bytes([0xC9, 5])
                 + _vlq(0) + bytes([0x90, 40, 80])
                 + _vlq(100) + bytes([0x80, 40, 0])
                 + _vlq(0) + bytes([0x99, 38, 120])
                 + _vlq(10) + bytes([0x89, 38, 0])
                 + _EOT)
        perf = parse_smf(_smf([track]))
        assert perf['programs'] == {'0': 33, '9': 5}
        chans = {e['ch'] for e in perf['events']}
        assert chans == {0, 9}

    def test_first_program_per_channel_wins(self):
        from ComfyTV.runners.midi_import import parse_smf
        track = (_vlq(0) + bytes([0xC0, 10])
                 + _vlq(50) + bytes([0xC0, 20])
                 + _vlq(0) + bytes([0x90, 60, 80])
                 + _vlq(50) + bytes([0x80, 60, 0])
                 + _EOT)
        perf = parse_smf(_smf([track]))
        assert perf['programs'] == {'0': 10}

    def test_tempo_change_mid_file(self):
        from ComfyTV.runners.midi_import import parse_smf
        track = (_tempo_meta(0, 500000)
                 + _vlq(0) + bytes([0x90, 60, 100])
                 + _vlq(480) + bytes([0x80, 60, 0])
                 + _tempo_meta(0, 250000)
                 + _vlq(0) + bytes([0x90, 62, 100])
                 + _vlq(480) + bytes([0x80, 62, 0])
                 + _EOT)
        perf = parse_smf(_smf([track]))
        ev = {e['midi']: e for e in perf['events']}
        assert ev[60]['t'] == pytest.approx(0.0)
        assert ev[60]['dur'] == pytest.approx(0.5)
        assert ev[62]['t'] == pytest.approx(0.5)
        assert ev[62]['dur'] == pytest.approx(0.25)
        assert [m['bpm'] for m in perf['tempo_map']] == [
            pytest.approx(120.0), pytest.approx(240.0)]

    def test_zero_length_note_gets_one_tick(self):
        from ComfyTV.runners.midi_import import parse_smf
        track = (_vlq(0) + bytes([0x90, 60, 100])
                 + _vlq(0) + bytes([0x80, 60, 0])
                 + _EOT)
        perf = parse_smf(_smf([track]))
        assert perf['events'][0]['dur'] > 0

    def test_note_without_off_gets_one_tick(self):
        from ComfyTV.runners.midi_import import parse_smf
        track = _vlq(0) + bytes([0x90, 60, 100]) + _EOT
        perf = parse_smf(_smf([track]))
        assert len(perf['events']) == 1
        assert perf['events'][0]['dur'] > 0

    def test_extra_note_off_dropped(self):
        from ComfyTV.runners.midi_import import parse_smf
        track = (_vlq(0) + bytes([0x80, 60, 0])
                 + _vlq(0) + bytes([0x90, 62, 90])
                 + _vlq(120) + bytes([0x80, 62, 0])
                 + _EOT)
        perf = parse_smf(_smf([track]))
        assert [e['midi'] for e in perf['events']] == [62]

    def test_format0_multichannel(self):
        from ComfyTV.runners.midi_import import parse_smf
        track = (_vlq(0) + bytes([0x90, 60, 100])
                 + _vlq(0) + bytes([0x91, 48, 80])
                 + _vlq(240) + bytes([0x80, 60, 0])
                 + _vlq(0) + bytes([0x81, 48, 0])
                 + _EOT)
        perf = parse_smf(_smf([track], fmt=0))
        by_ch = {e['ch']: e for e in perf['events']}
        assert by_ch[0]['midi'] == 60
        assert by_ch[1]['midi'] == 48

    def test_smpte_division(self):
        from ComfyTV.runners.midi_import import parse_smf
        division = struct.pack('>bB', -25, 40)
        head = b'MThd' + struct.pack('>IHH', 6, 1, 1) + division
        track = (_vlq(0) + bytes([0x90, 60, 100])
                 + _vlq(1000) + bytes([0x80, 60, 0])
                 + _EOT)
        data = head + b'MTrk' + struct.pack('>I', len(track)) + track
        perf = parse_smf(data)
        assert perf['events'][0]['dur'] == pytest.approx(1.0)

    def test_sysex_and_unknown_realtime_skipped(self):
        from ComfyTV.runners.midi_import import parse_smf
        track = (_vlq(0) + bytes([0xF0]) + _vlq(3) + b'\x43\x10\xf7'
                 + _vlq(0) + bytes([0xF8, 0x90, 60, 100])
                 + _vlq(120) + bytes([0x80, 60, 0])
                 + _EOT)
        perf = parse_smf(_smf([track]))
        assert [e['midi'] for e in perf['events']] == [60]

    def test_rejects(self):
        from ComfyTV.runners.midi_import import parse_smf
        with pytest.raises(RuntimeError, match='MThd'):
            parse_smf(b'RIFF' + b'\x00' * 20)
        with pytest.raises(RuntimeError, match='not implemented'):
            parse_smf(_smf([_EOT], fmt=2))
        with pytest.raises(RuntimeError, match='header data size'):
            parse_smf(b'MThd' + struct.pack('>IHHH', 8, 1, 0, 480) + b'\x00\x00')
        with pytest.raises(RuntimeError, match='EOF'):
            parse_smf(_smf([_vlq(0) + bytes([0x90, 60])]))

    def test_duration_field(self):
        from ComfyTV.runners.midi_import import parse_smf
        track = (_vlq(0) + bytes([0x90, 60, 100])
                 + _vlq(480) + bytes([0x80, 60, 0])
                 + _EOT)
        perf = parse_smf(_smf([track]))
        assert perf['duration'] == pytest.approx(1.5)


class TestRoundtrip:
    def test_write_smf_roundtrip(self, tmp_path, monkeypatch):
        import folder_paths
        from ComfyTV.runners.media import view_url_to_path
        from ComfyTV.runners.midi_file import write_smf
        from ComfyTV.runners.midi_import import parse_smf

        src = {'tempo_map': [{'beat': 0.0, 't': 0.0, 'bpm': 120.0},
                             {'beat': 8.0, 't': 4.0, 'bpm': 240.0}],
               'events': [
                   {'t': 0.0, 'dur': 0.5, 'midi': 60, 'vel': 100, 'ch': 0},
                   {'t': 0.5, 'dur': 1.0, 'midi': 64, 'vel': 90, 'ch': 0},
                   {'t': 0.25, 'dur': 0.05, 'midi': 38, 'vel': 120, 'ch': 9},
                   {'t': 4.0, 'dur': 0.25, 'midi': 72, 'vel': 80, 'ch': 1},
               ]}
        url = write_smf(src, programs={0: 0, 1: 33})
        path = view_url_to_path(url)
        assert path is not None
        perf = parse_smf(path.read_bytes())

        assert perf['programs'] == {'0': 0, '1': 33}
        assert [m['bpm'] for m in perf['tempo_map']] == [
            pytest.approx(120.0), pytest.approx(240.0)]
        got = {(e['ch'], e['midi']): e for e in perf['events']}
        for e in src['events']:
            g = got[(e['ch'], e['midi'])]
            assert g['t'] == pytest.approx(e['t'], abs=2e-3)
            assert g['dur'] == pytest.approx(e['dur'], abs=4e-3)
            assert g['vel'] == e['vel']


class TestEnsureAndLocalize:
    def _write_mid(self, input_dir, name='song.mid'):
        track = (_tempo_meta(0, 500000)
                 + _vlq(0) + bytes([0xC0, 0])
                 + _vlq(0) + bytes([0x90, 60, 100])
                 + _vlq(480) + bytes([0x80, 60, 0])
                 + _EOT)
        p = input_dir / name
        p.write_bytes(_smf([track]))
        return p

    def test_ensure_midi_wav_renders_and_caches(self):
        from pathlib import Path

        import folder_paths
        from ComfyTV.runners.media import view_url_to_path
        from ComfyTV.runners.midi_import import ensure_midi_wav

        input_dir = Path(folder_paths.get_input_directory())
        input_dir.mkdir(parents=True, exist_ok=True)
        self._write_mid(input_dir)

        res = ensure_midi_wav('/view?filename=song.mid&type=input')
        assert res['status'] == 'ready'
        assert 'type=output' in res['url']
        wav = view_url_to_path(res['url'])
        assert wav is not None and wav.suffix == '.wav'
        assert wav.stat().st_size > 1000

        mtime = wav.stat().st_mtime_ns
        res2 = ensure_midi_wav('/view?filename=song.mid&type=input')
        assert res2['url'] == res['url']
        assert view_url_to_path(res2['url']).stat().st_mtime_ns == mtime

    def test_ensure_non_midi_is_original(self):
        from ComfyTV.runners.midi_import import ensure_midi_wav
        assert ensure_midi_wav('') == {'status': 'original'}
        assert ensure_midi_wav('/view?filename=nope.wav&type=input') == {
            'status': 'original'}

    def test_localize_keeps_midi_raw(self):
        from pathlib import Path

        import folder_paths
        from ComfyTV.runners.media import localize

        input_dir = Path(folder_paths.get_input_directory())
        input_dir.mkdir(parents=True, exist_ok=True)
        self._write_mid(input_dir, name='loc.mid')

        p = localize('/view?filename=loc.mid&type=input')
        assert p.suffix == '.mid'
        assert p.read_bytes()[:4] == b'MThd'

    def test_decode_audio_transparently_renders_midi(self):
        from pathlib import Path

        import folder_paths
        from ComfyTV.runners.media import _decode_audio_to_array, localize

        input_dir = Path(folder_paths.get_input_directory())
        input_dir.mkdir(parents=True, exist_ok=True)
        self._write_mid(input_dir, name='dec.mid')

        arr = _decode_audio_to_array(localize('/view?filename=dec.mid&type=input'))
        assert arr.shape[0] == 2
        assert arr.shape[1] > 1000
        assert abs(arr).max() > 0.01
