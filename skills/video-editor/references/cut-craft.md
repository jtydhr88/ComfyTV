# Cut craft

Techniques adapted from working editors (and from browser-use/video-use, MIT).
These are worked examples, not mandates — deviate whenever the material calls
for it. The hard rules live in SKILL.md; everything here is taste.

## Picking cut points

- **Audio-first.** Candidate cuts come from silence gaps and speech
  boundaries, not from what a frame looks like. Confirm visually after.
- **Silence gap quality:** ≥400ms is usually the cleanest cut. 150–400ms is a
  phrase boundary — usable with a `media_timeline` check of the narrow range.
  <150ms is mid-phrase; don't cut there.
- **Cut padding worked example:** 50ms before the first kept sound, 80ms after
  the last. Tighter for montage energy, looser for documentary. Stay in the
  30–200ms window.
- **Preserve peaks.** Laughs, punchlines, emphasis beats. Extend past the
  punchline to include the reaction — the laugh IS the beat.
- **Speaker handoffs** want air between utterances: 400–600ms typical. Less
  for fast-paced, more for cinematic.
- **Never reason audio and video independently.** Every cut must work on both
  tracks — a clean audio gap with a visual jump is still a bad cut.
- **Filler and false starts** ("um", "uh", repeated take openings) are the
  first thing to cut in talking-head footage. With only phrase-level SRT you
  can't excise a mid-phrase filler safely — cut whole phrases, or leave it.

## Pacing

- A cut every 2–4s reads as energetic; 6–12s as considered; >15s holds need a
  reason (performance, tension, landscape).
- Speed ramps (`VideoSpeedStage`) buy pacing without losing content — 1.05–1.15×
  on slow conversational stretches is invisible; ≥1.5× reads as a stylistic
  choice; pair extreme ramps with music, not dialogue.
- If the target length forces dropping content, drop whole beats rather than
  shaving every segment thin — ten tight moments beat twenty rushed ones.

## Structural archetypes

When assembling multi-take or multi-scene material, pick a shape, adapt it, or
invent one:

- **Tech launch / demo:** HOOK → PROBLEM → SOLUTION → BENEFIT → EXAMPLE → CTA
- **Tutorial:** INTRO → SETUP → STEPS → GOTCHAS → RECAP
- **Interview:** (QUESTION → ANSWER → FOLLOWUP) repeated
- **Travel / event:** ARRIVAL → HIGHLIGHTS → QUIET MOMENTS → DEPARTURE
- **Documentary:** THESIS → EVIDENCE → COUNTERPOINT → CONCLUSION
- **Music / performance:** INTRO → VERSE → CHORUS → BRIDGE → OUTRO

Assemble chronologically by beat, not by source clip order. When several takes
cover the same beat, pick the cleanest delivery and note why; keep an
unavoidable slip only if no better take exists.

## Grade direction

Reason about the image, don't apply a preset. Mental model is ASC CDL: slope
moves highlights, offset moves shadows, power moves midtones, then global
saturation. Look at a frame (`fx_preview`), change one thing, look again.

- Minimal corrective (contrast bump + gentle S-curve, no hue shift) suits
  almost everything and is hard to get wrong.
- Teal/orange splits and heavy desaturation are genre statements — propose
  before applying.
- Always check skin tones before shipping a grade.
- Grade once on the assembled result (or via one FXChainStage), not per
  segment — segments graded separately drift.

## Subtitle styles

Three dimensions: **chunking** (words per cue), **case**, **placement**.

- **Bold-social:** 1–3 word cues, UPPERCASE, large, high stroke, bottom-anchored
  with generous margin. For short-form, fast-paced content.
- **Natural-sentence:** 4–7 word cues, sentence case, smaller, for narrative
  and educational content.

`SubtitleGenStage` output is phrase-level; re-chunk cues in the text before
burning if the style calls for shorter lines. Verify cue timing against the
final cut's timeline — cues authored against a source clip are wrong after
segments are removed; regenerate subtitles from the assembled video instead
of reusing source-clip cues.

## Self-eval checklist

On the rendered output, at every cut boundary (±1.5s `media_timeline`):

- visual discontinuity, flash, or jump at the cut;
- waveform spike at the boundary (audio pop);
- captions covered by anything composited after them;
- grade consistency across segments (sample first 2s, last 2s, 2–3 midpoints);
- duration matches the plan (`media_probe`).
