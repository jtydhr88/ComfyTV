import json
import math

import numpy as np

from .media import _AUDIO_RATE
from .audio_dsp import _write_wav

SR = _AUDIO_RATE


def _midi_hz(midi):
    return 440.0 * 2.0 ** ((midi - 69) / 12.0)


def _additive_note(freq, dur, vel, bright=1.0, decay_rate=2.2):
    ring = dur + 0.5
    n = int(SR * ring)
    t = np.arange(n) / SR
    tone = np.zeros(n)
    harmonics = [1.0, 0.5, 0.28, 0.14, 0.07, 0.03]
    for k, h in enumerate(harmonics):
        f = freq * (k + 1)
        if f > SR / 2 - 200:
            break
        tone += h * (bright ** k) * np.sin(2 * np.pi * f * t) \
            * np.exp(-t * (1.5 + k * 1.2))
    env = np.exp(-t * (decay_rate + freq / 900.0))
    gate = np.clip((dur + 0.3 - t) / 0.3, 0.0, 1.0)
    attack = np.minimum(1.0, t / 0.005)
    return (vel / 127.0) * 0.5 * tone * env * gate * attack


def _perc_hit(midi, vel):
    rng = np.random.default_rng(midi * 7919 + 13)
    if midi in (35, 36):
        n = int(SR * 0.25)
        t = np.arange(n) / SR
        f = 110.0 * np.exp(-t * 18.0) + 45.0
        body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 14.0)
        click = rng.standard_normal(n) * np.exp(-t * 300.0) * 0.4
        sig = body + click
    elif midi in (38, 40):
        n = int(SR * 0.22)
        t = np.arange(n) / SR
        sig = (np.sin(2 * np.pi * 190.0 * t) * 0.5
               + rng.standard_normal(n) * 0.8) * np.exp(-t * 22.0)
    elif midi in (42, 44):
        n = int(SR * 0.09)
        t = np.arange(n) / SR
        sig = rng.standard_normal(n) * np.exp(-t * 70.0)
    elif midi in (46, 49, 57):
        n = int(SR * 0.9)
        t = np.arange(n) / SR
        sig = rng.standard_normal(n) * np.exp(-t * 4.0) * 0.8
    elif midi in (76, 77):
        n = int(SR * 0.09)
        t = np.arange(n) / SR
        f = 900.0 if midi == 76 else 620.0
        sig = np.sin(2 * np.pi * f * t) * np.exp(-t * 60.0)
    else:
        n = int(SR * 0.15)
        t = np.arange(n) / SR
        sig = rng.standard_normal(n) * np.exp(-t * 40.0)
    return (vel / 127.0) * 0.6 * sig


_PROGRAM_TIMBRE = {
    range(0, 8):    (1.00, 2.2),
    range(8, 16):   (0.75, 4.0),
    range(16, 24):  (1.05, 0.6),
    range(24, 32):  (0.85, 3.0),
    range(32, 40):  (0.70, 2.6),
    range(40, 56):  (1.10, 0.8),
    range(56, 64):  (1.15, 0.9),
    range(64, 72):  (1.05, 1.0),
    range(72, 80):  (0.60, 1.1),
    range(80, 96):  (1.20, 0.9),
}


def _timbre_for(program):
    for rng_, timbre in _PROGRAM_TIMBRE.items():
        if program in rng_:
            return timbre
    return (1.0, 2.0)


def synthesize_events(performance: dict, *, soundfont_path='',
                      programs=None, gain=1.0, report=None):
    if (soundfont_path or '').strip():
        from .sf2_synth import render_sf2
        return render_sf2(performance, soundfont_path,
                          programs=programs or {}, gain=gain, report=report)
    events = performance.get('events') or []
    if not events:
        raise RuntimeError("score synth: no events")
    programs = programs or {}
    total = max(e['t'] + e['dur'] for e in events) + 1.2
    buf = np.zeros((2, int(SR * total)))
    for i, e in enumerate(events):
        ch = int(e.get('ch', 0))
        vel = int(e.get('vel', 96))
        if ch == 9:
            sig = _perc_hit(int(e['midi']), vel)
            pan = 0.5
        else:
            bright, decay = _timbre_for(int(programs.get(ch, 0)))
            sig = _additive_note(_midi_hz(int(e['midi'])), float(e['dur']),
                                 vel, bright, decay)
            pan = 0.5 + ((ch % 4) - 1.5) * 0.1
        i0 = int(e['t'] * SR)
        i1 = min(buf.shape[1], i0 + sig.size)
        if i1 <= i0:
            continue
        buf[0, i0:i1] += sig[:i1 - i0] * (1.0 - pan)
        buf[1, i0:i1] += sig[:i1 - i0] * pan
        if report and i % 64 == 0:
            report(i)
    peak = np.abs(buf).max()
    if peak > 1e-9:
        buf = buf / peak * min(0.9, 0.85 * float(gain))
    return buf.astype(np.float32)


def render_performance(perf_json: str, *, soundfont_path='', programs=None,
                       gain=1.0, progress=None) -> str:
    from .media_filter import make_progress

    try:
        perf = json.loads(perf_json) if isinstance(perf_json, str) \
            else perf_json
    except (ValueError, TypeError):
        raise RuntimeError("score synth: invalid performance JSON")
    events = perf.get('events') or []
    report = make_progress(progress, max(1, len(events)), "synthesizing")
    buf = synthesize_events(perf, soundfont_path=soundfont_path,
                            programs=programs, gain=gain, report=report)
    return _write_wav(buf)


def click_track_events(*, bpm=120.0, beats_per_bar=4, bars=8,
                       strong_midi=76, weak_midi=77):
    bpm = max(20.0, min(400.0, float(bpm)))
    spb = 60.0 / bpm
    events = []
    n_beats = max(1, int(beats_per_bar)) * max(1, int(bars))
    for i in range(n_beats):
        strong = i % max(1, int(beats_per_bar)) == 0
        events.append({'t': round(i * spb, 6), 'dur': 0.08,
                       'midi': strong_midi if strong else weak_midi,
                       'vel': 118 if strong else 88, 'ch': 9})
    return {'tempo_map': [{'beat': 0.0, 't': 0.0, 'bpm': bpm}],
            'events': events,
            'duration': round(n_beats * spb + 1.0, 3)}


def click_track_from_labels(labels_json: str, *, strong_every=4):
    try:
        labels = json.loads(labels_json)
    except (ValueError, TypeError):
        raise RuntimeError("click track: invalid labels JSON")
    times = [float(x.get('start', 0.0)) for x in labels
             if isinstance(x, dict)]
    if not times:
        raise RuntimeError("click track: labels contain no times")
    events = []
    for i, t in enumerate(times):
        strong = strong_every > 0 and i % strong_every == 0
        events.append({'t': round(t, 6), 'dur': 0.08,
                       'midi': 76 if strong else 77,
                       'vel': 118 if strong else 88, 'ch': 9})
    gaps = [b - a for a, b in zip(times, times[1:])]
    bpm = 60.0 / (sum(gaps) / len(gaps)) if gaps else 120.0
    return {'tempo_map': [{'beat': 0.0, 't': 0.0, 'bpm': round(bpm, 3)}],
            'events': events, 'duration': round(times[-1] + 1.5, 3)}


__all__ = ['synthesize_events', 'render_performance', 'click_track_events',
           'click_track_from_labels']
