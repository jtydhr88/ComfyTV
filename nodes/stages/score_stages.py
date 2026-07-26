import json
import os

from ._common import *  # noqa: F401, F403
from ...runners.score_perform import EASINGS, PROFILES
from ...runners.chord_accomp import VOICINGS, PATTERNS

from .common.fx_helpers import (  # noqa: F401
    _need_video, _progress_cb, _f,
    _hidden_float, _hidden_int, _hidden_str, _hidden_combo,
)

from ...runners.gm_programs import GM_PROGRAMS


class ScoreStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.ScoreStage",
            display_name="Score",
            category="ComfyTV/Music",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_str("musicxml", ""),
                COMFYTV_TEXT.Input("text", optional=True),
            ],
            outputs=[COMFYTV_TEXT.Output("score")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                musicxml="", text=""):
        from ...runners.score_model import parse_musicxml, score_summary

        raw = (text or '').strip() or (musicxml or '').strip()
        if not raw:
            raise RuntimeError(
                "Score needs MusicXML — paste it or wire a text input "
                "(e.g. from an LLM Text stage).")
        if '<score-partwise' in raw and not raw.lstrip().startswith('<'):
            start = raw.find('<?xml')
            if start < 0:
                start = raw.find('<score-partwise')
            end = raw.rfind('</score-partwise>')
            if start >= 0 and end > start:
                raw = raw[start:end + len('</score-partwise>')]
        score = parse_musicxml(raw)
        summary = score_summary(score)
        _emit_progress(cls, 1, 1,
                       text=f"{summary['time']} · "
                            f"{sum(p['notes'] for p in summary['parts'])} "
                            f"notes")
        return _stage_emit_auto(cls, project_id=project_id, payload_str=raw,
                                parent_output_id=parent_output_id,
                                extra_outputs=None,
                                params={'summary': summary})


class ScoreEditorStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.ScoreEditorStage",
            display_name="Score Editor",
            category="ComfyTV/Music",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_str("notes_json", ""),
                COMFYTV_TEXT.Input("score", optional=True),
            ],
            outputs=[COMFYTV_TEXT.Output("score")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                notes_json="", score=""):
        from ...runners.score_edit import notes_to_musicxml

        raw = (notes_json or '').strip()
        if not raw:
            raise RuntimeError(
                "Score Editor: the piano roll is empty — draw some notes "
                "(or import the wired score first).")
        xml = notes_to_musicxml(raw)
        return _stage_emit_auto(cls, project_id=project_id, payload_str=xml,
                                parent_output_id=parent_output_id)


class MidiEditorStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.MidiEditorStage",
            display_name="MIDI Editor",
            category="ComfyTV/Music",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_str("events_json", ""),
                COMFYTV_AUDIO.Input("midi", optional=True),
            ],
            outputs=[COMFYTV_AUDIO.Output("midi")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                events_json="", midi=""):
        from ...runners.midi_file import write_smf

        raw = (events_json or '').strip()
        if not raw:
            raise RuntimeError(
                "MIDI Editor: the piano roll is empty — import the wired "
                "MIDI (or draw some notes) first.")
        try:
            state = json.loads(raw)
        except (ValueError, TypeError):
            raise RuntimeError("MIDI Editor: invalid editor state")
        events = [e for e in (state.get('events') or [])
                  if isinstance(e, dict) and e.get('dur', 0) > 0]
        if not events:
            raise RuntimeError("MIDI Editor: no notes to export")
        programs = {}
        for k, v in (state.get('programs') or {}).items():
            try:
                programs[int(k)] = max(0, min(127, int(v)))
            except (TypeError, ValueError):
                pass
        perf = {'tempo_map': state.get('tempo_map') or [], 'events': events}
        url = write_smf(perf, programs=programs)
        _emit_progress(cls, 1, 1, text=f"{len(events)} notes")
        return _stage_emit_auto(cls, project_id=project_id, payload_str=url,
                                parent_output_id=parent_output_id)


class ScoreToMidiStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.ScoreToMidiStage",
            display_name="Score Performer",
            category="ComfyTV/Music",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_float("swing_ratio", 50.0, 50.0, 75.0, step=1.0),
                _hidden_combo("swing_unit", ['eighth', 'sixteenth'],
                              'eighth'),
                _hidden_float("humanize", 0.0, 0.0, 1.0),
                _hidden_combo("easing", list(EASINGS), 'normal'),
                _hidden_combo("profile", list(PROFILES), 'keyboard'),
                _hidden_int("seed", 7, 0, 99999),
                COMFYTV_TEXT.Input("score", optional=True),
            ],
            outputs=[COMFYTV_TEXT.Output("performance"),
                     COMFYTV_TEXT.Output("midi_url")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                swing_ratio=50.0, swing_unit='eighth', humanize=0.0,
                easing='normal', profile='keyboard', seed=7, score=""):
        from ...runners.score_model import parse_musicxml
        from ...runners.score_perform import perform_score
        from ...runners.midi_file import write_smf

        raw = (score or '').strip()
        if not raw:
            raise RuntimeError(
                "Score Performer needs a score — wire the Score stage.")
        parsed = parse_musicxml(raw)
        perf = perform_score(
            parsed,
            swing_ratio=_f(swing_ratio, 50, 75, 50.0),
            swing_unit=0.5 if swing_unit == 'eighth' else 0.25,
            humanize=_f(humanize, 0, 1, 0.0),
            easing=easing if easing in EASINGS else 'normal',
            profile=profile if profile in PROFILES else 'keyboard',
            seed=min(99999, max(0, int(seed or 0))))
        midi_url = write_smf(perf)
        perf['musicxml'] = raw
        return _stage_emit_auto(cls, project_id=project_id,
                                payload_str=json.dumps(perf),
                                parent_output_id=parent_output_id,
                                extra_outputs=(midi_url,))


class SF2SynthStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.SF2SynthStage",
            display_name="Score Synth",
            category="ComfyTV/Music",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_str("soundfont", "",
                            "file name from the soundfont library"),
                _hidden_combo("program", sorted(GM_PROGRAMS), 'piano'),
                _hidden_str("channel_programs", "",
                            "optional JSON {channel: gm_program}"),
                _hidden_float("gain", 1.0, 0.1, 2.0),
                COMFYTV_TEXT.Input("performance", optional=True),
            ],
            outputs=[COMFYTV_AUDIO.Output("audio")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                soundfont="", program='piano', channel_programs="",
                gain=1.0, performance=""):
        from ...api.resources import resource_file
        from ...runners.score_synth import render_performance

        raw = (performance or '').strip()
        if not raw:
            raise RuntimeError(
                "Score Synth needs a performance — wire Score Performer "
                "(or Click Track).")
        sf_path = ''
        name = os.path.basename((soundfont or '').strip())
        if name:
            p = resource_file('soundfont', name)
            if p is None:
                raise RuntimeError(
                    f"Score Synth: soundfont {name!r} not found in the "
                    "resource library.")
            sf_path = str(p)
        base_prog = GM_PROGRAMS.get(program, 0)
        programs = {}
        try:
            extra = json.loads(channel_programs) if \
                (channel_programs or '').strip() else {}
            for k, v in (extra.items() if isinstance(extra, dict) else []):
                programs[int(k)] = GM_PROGRAMS.get(v, v if
                                                   isinstance(v, int) else 0)
        except (ValueError, TypeError):
            pass
        payload = render_performance(raw, soundfont_path=sf_path,
                                     programs=programs,
                                     gain=_f(gain, 0.1, 2, 1.0),
                                     default_program=base_prog,
                                     progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id,
                                payload_str=payload,
                                parent_output_id=parent_output_id)


class ClickTrackStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.ClickTrackStage",
            display_name="Click Track",
            category="ComfyTV/Music",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_float("bpm", 120.0, 20.0, 400.0, step=0.5),
                _hidden_int("beats_per_bar", 4, 1, 12),
                _hidden_int("bars", 8, 1, 256),
                _hidden_str("soundfont", ""),
                COMFYTV_TEXT.Input("labels", optional=True),
            ],
            outputs=[COMFYTV_AUDIO.Output("audio"),
                     COMFYTV_TEXT.Output("performance")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                bpm=120.0, beats_per_bar=4, bars=8, soundfont="",
                labels=""):
        from ...api.resources import resource_file
        from ...runners.score_synth import (
            click_track_events, click_track_from_labels,
            render_performance,
        )

        if (labels or '').strip():
            perf = click_track_from_labels(labels)
        else:
            perf = click_track_events(
                bpm=_f(bpm, 20, 400, 120.0),
                beats_per_bar=min(12, max(1, int(beats_per_bar or 4))),
                bars=min(256, max(1, int(bars or 8))))
        sf_path = ''
        name = os.path.basename((soundfont or '').strip())
        if name:
            p = resource_file('soundfont', name)
            if p is not None:
                sf_path = str(p)
        payload = render_performance(json.dumps(perf),
                                     soundfont_path=sf_path,
                                     progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id,
                                payload_str=payload,
                                parent_output_id=parent_output_id,
                                extra_outputs=(json.dumps(perf),))


class ChordAccompStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.ChordAccompStage",
            display_name="Chord Accompaniment",
            category="ComfyTV/Music",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_str("progression", "Am7 | Dm7 | G7 | Cmaj7"),
                _hidden_float("bpm", 100.0, 20.0, 300.0, step=0.5),
                _hidden_int("beats_per_bar", 4, 1, 12),
                _hidden_combo("pattern", list(PATTERNS), 'block'),
                _hidden_combo("voicing", list(VOICINGS), 'close'),
                _hidden_int("octave_shift", 0, -2, 2),
                _hidden_int("velocity", 88, 20, 127),
                _hidden_int("repeats", 1, 1, 16),
                COMFYTV_TEXT.Input("progression_text", optional=True),
            ],
            outputs=[COMFYTV_TEXT.Output("performance"),
                     COMFYTV_TEXT.Output("midi_url")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                progression="Am7 | Dm7 | G7 | Cmaj7", bpm=100.0,
                beats_per_bar=4, pattern='block', voicing='close',
                octave_shift=0, velocity=88, repeats=1,
                progression_text=""):
        from ...runners.chord_accomp import chord_accompaniment
        from ...runners.midi_file import write_smf

        text = (progression_text or '').strip() or (progression or '').strip()
        if not text:
            raise RuntimeError(
                "Chord Accompaniment needs a progression - e.g. "
                "'Am7 Dm7 | G7 | Cmaj7'.")
        perf = chord_accompaniment(
            text, bpm=_f(bpm, 20, 300, 100.0),
            beats_per_bar=min(12, max(1, int(beats_per_bar or 4))),
            pattern=pattern if pattern in PATTERNS else 'block',
            voicing=voicing if voicing in VOICINGS else 'close',
            octave_shift=min(2, max(-2, int(octave_shift or 0))),
            velocity=min(127, max(20, int(velocity or 88))),
            repeats=min(16, max(1, int(repeats or 1))))
        midi_url = write_smf(perf)
        return _stage_emit_auto(cls, project_id=project_id,
                                payload_str=json.dumps(perf),
                                parent_output_id=parent_output_id,
                                extra_outputs=(midi_url,))
