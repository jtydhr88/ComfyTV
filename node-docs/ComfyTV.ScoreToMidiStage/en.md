# Score Performer

> Turn a written score into an expressive performance — swing, human feel, per-instrument phrasing — and get a MIDI file out.

## What this node does

**Score Performer** takes a MusicXML score (wired from the **Score** stage) and
"performs" it: it converts the flat, quantized notation into a timed
performance with swing, humanized timing, an interpretive easing curve and an
instrument-specific playing profile. Think of it as the difference between a
MIDI import that sounds robotic and a take played by a musician.

Press **▶ Run** to perform the score on the backend. The node emits two things:
a `performance` payload (the structured, timed performance, used by **Score
Synth** to render audio) and a `midi_url` pointing at a rendered Standard MIDI
File you can download or feed to other MIDI-aware stages.

Both outputs are `COMFYTV_TEXT`. The `performance` is a JSON payload; the
`midi_url` is a URL string for the exported `.mid`.

## When to use it

- You have a clean score from **Score** and want it to breathe before synthesis.
- You need a `.mid` file of the piece to reuse elsewhere.
- You want swing/feel applied consistently across the whole score.

## Parameters

### swing_ratio
How much swing to apply, as a percentage from **50** (straight, the default) to
**75** (hard shuffle). At 50 nothing is swung; higher values lengthen the
on-beat subdivision and shorten the off-beat one.

### swing_unit
Which subdivision the swing acts on: **eighth** (default) or **sixteenth**.
Eighth-note swing is the classic jazz/shuffle feel; sixteenth swing is finer,
for faster grooves.

### humanize
Random timing/velocity looseness from **0.0** (dead-on quantized, the default)
to **1.0** (loosest). Small values (0.1–0.3) add a natural, un-mechanical feel;
high values sound sloppy on purpose.

### easing
The interpretive timing curve applied to the performance. Default **normal**.
The available options come from the performer's easing table; `normal` plays it
straight.

### profile
The instrument playing profile, default **keyboard**. This shapes phrasing and
articulation to suit the instrument family (the options come from the
performer's profile table). Pick the one that matches your part.

### seed
Random seed for the humanization, **0–99999** (default **7**). Same seed +
same settings = the same performance every run, so you can reproduce a take you
liked.

### score (optional input)
The MusicXML to perform, type `COMFYTV_TEXT` — wire this from the **Score**
stage. Running with nothing wired fails with "Score Performer needs a score".

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **performance** | `COMFYTV_TEXT` | The timed, expressive performance (JSON) for Score Synth |
| **midi_url** | `COMFYTV_TEXT` | URL to the exported Standard MIDI File (`.mid`) |

## Tips

- Keep `humanize` modest (around 0.15) for realism; push it only when you want
  an obviously loose, live feel.
- Lock the `seed` once you like a take — otherwise re-running re-rolls the
  human timing.
- The `performance` output is meant for **Score Synth**; the `midi_url` is for
  export or MIDI-aware stages.

## Related nodes

- **Score** — produces the MusicXML this node performs.
- **Score Synth** — renders the `performance` to audio with a SoundFont.
- **MIDI Editor** — open a MIDI file in a piano roll for hands-on editing.
- **Bridge** — convert to/from native ComfyUI types. See
  https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md
