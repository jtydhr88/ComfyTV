# Chord Accompaniment

> Type a chord progression and get a played-out backing part — voiced, patterned and exported as MIDI.

## What this node does

**Chord Accompaniment** turns a chord-symbol progression (like
`Am7 | Dm7 | G7 | Cmaj7`) into an actual accompaniment: it realizes each chord
into real notes, applies a voicing, and lays it out with a rhythmic pattern
(block chords, arpeggios, and so on). It's the fast way to get a comping/backing
part without writing out every note.

Press **▶ Run** to generate on the backend. The node emits two outputs: a
`performance` payload (feed it to **Score Synth** to hear it) and a `midi_url`
pointing at an exported Standard MIDI File.

Type the progression in the node's `progression` field, or wire a
`progression_text` input to drive it from upstream. Chords are separated by
spaces; `|` marks bar lines.

## When to use it

- You want an instant backing part under a melody or for practice.
- You have a chord chart and need it realized into playable notes/MIDI.
- You want to audition different voicings and rhythmic feels for a progression.

## Parameters

### progression
The chord progression text, default `Am7 | Dm7 | G7 | Cmaj7`. Chords are
space-separated; `|` marks bars. Used when no `progression_text` input is wired.

### bpm
Tempo in beats per minute, **20–300** (default **100**), in 0.5 steps.

### beats_per_bar
Beats per bar, **1–12** (default **4**).

### pattern
The rhythmic accompaniment pattern, default **block** (all chord tones struck
together). The other options come from the accompaniment pattern set (e.g.
arpeggiated styles).

### voicing
How the chord tones are spaced, default **close** (tones packed tightly). Other
options come from the voicing set (e.g. wider, spread voicings).

### octave_shift
Shift the whole part up or down by octaves, **-2 to +2** (default **0**).

### velocity
Note velocity (loudness/attack), **20–127** (default **88**).

### repeats
How many times to repeat the whole progression, **1–16** (default **1**).

### progression_text (optional input)
An optional text input, type `COMFYTV_TEXT`, carrying the progression. When
wired, it takes priority over the `progression` field. Running with no
progression at all fails with a "needs a progression" message.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **performance** | `COMFYTV_TEXT` | The realized accompaniment (JSON) for Score Synth |
| **midi_url** | `COMFYTV_TEXT` | URL to the exported Standard MIDI File (`.mid`) |

## Tips

- Use `|` to define bars; without them the whole line is read as chords in
  sequence.
- Try `close` vs. a wider voicing and switch `pattern` between block and
  arpeggiated to change the feel without retyping the chords.
- Set `repeats` to loop a short progression into a longer bed.

## Related nodes

- **Score Synth** — renders the `performance` to audio.
- **Score Performer** — the melodic counterpart (performs a written score).
- **Click Track** — pair with a metronome for a full backing bed.
- **Bridge** — convert to/from native ComfyUI types. See
  https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md
