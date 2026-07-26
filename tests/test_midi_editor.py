"""MidiEditorStage: editor state -> SMF export roundtrip."""
import json

import pytest


def _state(events, programs=None, tempo_map=None):
    return json.dumps({
        'tempo_map': tempo_map or [{'beat': 0.0, 't': 0.0, 'bpm': 120.0}],
        'programs': programs or {},
        'events': events,
    })


class TestMidiEditorStage:
    def test_exports_editable_state_to_midi(self):
        from ComfyTV.nodes.stages.score_stages import MidiEditorStage
        from ComfyTV.runners.media import view_url_to_path
        from ComfyTV.runners.midi_import import parse_smf

        state = _state(
            [
                {'t': 0.0, 'dur': 0.5, 'midi': 60, 'vel': 100, 'ch': 0},
                {'t': 0.5, 'dur': 0.5, 'midi': 64, 'vel': 90, 'ch': 0},
                {'t': 0.25, 'dur': 0.05, 'midi': 38, 'vel': 120, 'ch': 9},
            ],
            programs={'0': 33},
        )
        out = MidiEditorStage.execute(project_id='p1', events_json=state)
        url = out.values[0]
        assert url.startswith('/view')

        perf = parse_smf(view_url_to_path(url).read_bytes())
        assert perf['programs'] == {'0': 33}
        got = {(e['ch'], e['midi']): e for e in perf['events']}
        assert got[(0, 60)]['dur'] == pytest.approx(0.5, abs=2e-3)
        assert got[(0, 64)]['t'] == pytest.approx(0.5, abs=2e-3)
        assert got[(0, 64)]['vel'] == 90
        assert (9, 38) in got

    def test_preserves_tempo_map(self):
        from ComfyTV.nodes.stages.score_stages import MidiEditorStage
        from ComfyTV.runners.media import view_url_to_path
        from ComfyTV.runners.midi_import import parse_smf

        state = _state(
            [{'t': 0.0, 'dur': 0.25, 'midi': 60, 'vel': 100, 'ch': 0}],
            tempo_map=[{'beat': 0.0, 't': 0.0, 'bpm': 90.0}],
        )
        out = MidiEditorStage.execute(project_id='p1', events_json=state)
        perf = parse_smf(view_url_to_path(out.values[0]).read_bytes())
        assert perf['tempo_map'][0]['bpm'] == pytest.approx(90.0)
        assert perf['events'][0]['dur'] == pytest.approx(0.25, abs=2e-3)

    def test_rejects_empty_and_invalid(self):
        from ComfyTV.nodes.stages.score_stages import MidiEditorStage
        with pytest.raises(RuntimeError, match='empty'):
            MidiEditorStage.execute(project_id='p1', events_json='')
        with pytest.raises(RuntimeError, match='invalid'):
            MidiEditorStage.execute(project_id='p1', events_json='{nope')
        with pytest.raises(RuntimeError, match='no notes'):
            MidiEditorStage.execute(project_id='p1',
                                    events_json=_state([]))

    def test_drops_zero_duration_events(self):
        from ComfyTV.nodes.stages.score_stages import MidiEditorStage
        from ComfyTV.runners.media import view_url_to_path
        from ComfyTV.runners.midi_import import parse_smf

        state = _state([
            {'t': 0.0, 'dur': 0.5, 'midi': 60, 'vel': 100, 'ch': 0},
            {'t': 1.0, 'dur': 0, 'midi': 62, 'vel': 100, 'ch': 0},
        ])
        out = MidiEditorStage.execute(project_id='p1', events_json=state)
        perf = parse_smf(view_url_to_path(out.values[0]).read_bytes())
        assert [e['midi'] for e in perf['events']] == [60]
