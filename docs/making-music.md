**English** | [简体中文](making-music.zh.md)

# Making Music in ComfyTV/ComfyUI

> From a score (or a prompt asking an LLM to write one) to a finished, reverb-polished audio track — all on one canvas, no external software. This page walks through the four stages — **composition → performance → synthesis → mixing** — explaining the musical concepts and every parameter on the way.

The chain at a glance (**ComfyTV / Music** + **ComfyTV / Audio**):

```
Score ──▶ Score Performer ──▶ Score Synth ──▶ Muse Reverb ──▶ finished audio
```

Three words, each owning one part of the chain:

| Stage | What it means in music | Handled by |
|---|---|---|
| **Composition** | The **notes themselves**: melody, harmony, rhythm | the MusicXML score + Score |
| **Arrangement / performance** | **How they're played**: instruments, articulation, dynamics, swing | Score Performer, instrument choice |
| **Mixing** | **How it sounds**: balance, space, frequency shaping | Muse Reverb and the other Audio nodes |

---

## Stop 1: Where scores come from — MusicXML

**MusicXML** is the universal interchange format for sheet music — MuseScore, Finale, and Sibelius all export it. It describes "which notes in which measure, what duration, what articulation" as text. A minimal usable score:

```xml
<?xml version="1.0"?>
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>2</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <direction><sound tempo="100"/></direction>
      <note><pitch><step>C</step><octave>4</octave></pitch>
            <duration>2</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch>
            <duration>2</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>4</octave></pitch>
            <duration>2</duration><type>quarter</type></note>
      <note><pitch><step>C</step><octave>5</octave></pitch>
            <duration>2</duration><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>
```

Three fields are enough to read it:

- `divisions` — how many ticks one quarter note is split into; every `duration` is counted in those ticks (above, `divisions=2`, so `duration=2` is a quarter note);
- `step` + `octave` (+ optional `alter`) — note name + octave + accidental (`alter=1` sharp, `-1` flat);
- `measure` — a bar; multiple staves (left/right hand) are multiple `<part>` elements.

### Route one: ask an LLM

The Score node is **forgiving**: paste the LLM's entire answer as-is — it extracts the `<score-partwise>…</score-partwise>` block out of the surrounding prose automatically. Prompt template:

> Write an 8-bar C-major piano solo in MusicXML (score-partwise 4.0), 4/4 time, tempo 100, right-hand melody plus left-hand block chords, two parts. Only correctness of the notes matters; no layout information needed.

Two voices, a specific chord progression, dynamics (`<dynamics>`), hairpins (`<wedge>`), staccato (`<articulations>`) — just ask for them in the prompt. The parser reads those markings, and the performance stage actually plays them.

### Route two: public downloads

| Site | Content | Notes |
|---|---|---|
| [MuseScore.com](https://musescore.com) | Community-uploaded scores | Best quality; some need a login |
| [abcnotation.com](https://abcnotation.com) | Folk/classical, machine-converted from ABC | Direct downloads, no login; converted files can be sloppy — the parser follows MuseScore/OSMD semantics and tolerates them |
| [IMSLP](https://imslp.org) | Public-domain classical library | Mostly PDF, some XML |
| [Mutopia](https://www.mutopiaproject.org) | Public-domain classical | LilyPond sources, some XML |

Note: download the **uncompressed** `.musicxml` / `.xml` variant; `.mxl` is a zip archive — extract the XML from it first.

---

## Stop 2: Score

Paste MusicXML into the node (or wire an upstream LLM text node into `text`). It does three things:

1. **Validates and cleans** — parse failures raise a clear error instead of letting a broken score flow downstream;
2. **Engraves the score** — the node card renders the full multi-stave score (percussion staff included), zoomable, with an editable XML panel that re-engraves live;
3. **Outputs the cleaned score text** for the rest of the chain.

There are no performance parameters — **the score is the "facts"**; everything after this changes how it's played, never what's written.

---

## Stop 3: Score Performer

A score says *which* notes; MIDI events say *when and how loudly* they're struck. Playing the score back mechanically is what people call "robotic MIDI"; a human performance differs in **articulation** (actual note lengths), **dynamic curves** (how crescendos travel), and **tiny timing deviations**. This node ports MuseScore's performance rules and applies every staccato / tenuto / accent / dynamic / hairpin / trill / grace-note marking in the score.

| Parameter | Range (default) | What it is musically | What turning it does |
|---|---|---|---|
| `swing_ratio` | 50–75 (50) | **Swing**: how far off-beats are pushed late | 50 = straight (classical/pop); 62–66 ≈ jazz triplet feel; 75 = extreme bounce. Only affects off-beats — a score of nothing but quarter notes won't change at all |
| `swing_unit` | eighth / sixteenth | Which subdivision swings | Standard jazz swing = `eighth`; funk / hip-hop sixteenth swing = `sixteenth` |
| `humanize` | 0–1 (0) | **Humanization**: micro jitter in timing and velocity | 0.2–0.35 sounds natural; above 0.6 sounds drunk. Deterministic — same seed, same take |
| `easing` | 5 curves (normal) | The **shape of hairpin dynamics** | `normal` linear; `ease_in` saves the push for the end; `ease_out` surges immediately; `ease_in_out` gentle both ends; `exponential` most dramatic. Formulas match MuseScore |
| `profile` | 5 profiles (keyboard) | **Instrument performance model** | keyboard / strings / winds / voice / percussion. The same staccato mark produces different actual lengths and accent envelopes on piano vs. violin — constants extracted from MuseScore's performance profiles. Percussion parts force the percussion profile automatically |
| `seed` | 0–99999 (7) | Random seed for humanize | Change it for a different take, keep the one that feels best |

Two outputs: `performance` (performance JSON — tempo map + event stream, wire to Score Synth) and `midi_url` (a **standard .mid file** you can download straight into any DAW).

> 💡 Changing Performer parameters does **not** change the engraved score downstream — the engraving shows the score, not the performance. To *hear* the difference, re-Run the Score Synth.

---

## Stop 4: Score Synth

Performance events need a **sound**. That's a **SoundFont** (`.sf2` / `.sf3`) — a sampled instrument library organized by the General MIDI standard's 128 programs. The free FluidR3_GM covers all of GM; import the file via the sidebar under **Resources → soundfont**.

| Parameter | Range (default) | What it does |
|---|---|---|
| `soundfont` | library file name (empty) | Which sound library. **Empty = built-in basic synthesizer** — the chain always makes sound, but plainly; install a SoundFont for real output |
| `program` | 37 common GM names (piano) | **Main instrument** for every channel not overridden below |
| `channel_programs` | row editor | **Per-track instruments**: each row picks a channel + an instrument. Each MusicXML `<part>` maps to channel 0, 1, 2… in order (drums follow the GM channel-10 convention). E.g. ch 0 = piano, ch 1 = acoustic_bass |
| `gain` | 0.1–2 (1) | Master volume |

The card engraves the full score and, during playback, **the cursor follows the music note by note** — including repeats and first/second endings. The output is standard audio: chain any Audio node after it, or feed it into a Video Stage's `audio` input to drive audio-to-video generation.

---

## Stop 5: Mixing — Muse Reverb (FDN)

Dry synthesized audio sits "right in your face"; **reverb** puts it in a room. Physically there are three layers: **direct sound** (dry) → **early reflections** (the first bounces off the walls — your instinct for "how big is this room") → **late reverb** (the dense tail — "how wet"). This node is the same FDN (feedback delay network) algorithm as MuseScore's reverb.

| Parameter | Range (default) | What it does | Practical guide |
|---|---|---|---|
| `reverb_time_ms` | 100–10000 (2200) | **RT60**: time for the sound to decay 60 dB | Small room 400–800; concert hall 1500–2500; cathedral 4000+ |
| `room_scale` | 0.5–4 (0.8) | Room size (scales internal delay lines) | Bigger = farther, emptier |
| `predelay_ms` | 0–500 (10) | Gap between dry sound and first reflection | 30–80 keeps the soloist "up front" while preserving space |
| `dry_db` | -60–6 (0) | Direct level | Usually 0; pull down only for full-wet effects |
| `er_db` | -60–6 (-14) | Early-reflection level | Raise for a more defined room |
| `late_db` | -60–6 (-14) | Late-reverb level | **The main wetness knob** — up = wetter |
| `time_low` | 50–200% (100) | Low-frequency decay multiplier | >100 longer low tail (warmer, but can get muddy); <100 tighter lows |
| `time_high` | 50–200% (60) | High-frequency decay multiplier | Usually <100 — highs die first in real rooms |
| `xover_low_mid` | 50–500 (400) | Low/mid crossover (Hz) | Works with the two above |
| `xover_mid_high` | 1000–10000 (4000) | Mid/high crossover (Hz) | Same |
| `feedback_top` | 500–20000 (8000) | High-frequency damping cutoff inside the feedback loop | Lower = darker, more vintage |
| `mod_freq` / `mod_amp` | 0–10 / 0–1 (1 / 0.2) | Delay-line modulation | A touch (amp ≈ 0.2) removes metallic ringing; more gives chorus-like shimmer |
| `stereo_spread` | 0–150 (100) | Stereo width | 0 = mono reverb |
| `quality` | 8 / 16 (16) | Number of FDN delay lines | 16 denser and smoother; 8 cheaper |

Three starting points:

| Scene | reverb_time_ms | room_scale | predelay_ms | late_db |
|---|---|---|---|---|
| Room (pop backing) | 700 | 0.7 | 10 | -18 |
| Concert hall (solo piano) | 2200 | 1.2 | 20 | -14 |
| Cathedral (choir/ambient) | 4500 | 2.5 | 40 | -10 |

---

## Stop 6: Beyond — the rest of the audio toolbox

The synth output is a standard audio track; the whole **ComfyTV / Audio** toolbox chains after it:

| Node | One-line purpose |
|---|---|
| **Audio EQ** | Frequency balance |
| **Audio Dynamics** | Compression/limiting — smooth out level swings |
| **Audio Loudness** | Loudness normalization (streaming standard -14 LUFS) |
| **Audio Time / Pitch** | Time-stretch / pitch-shift (`pitch_hq` uses the high-quality phase vocoder) |
| **Audio Echo** | Echo/delay |
| **Audio Modulation** | Chorus, flanger, phaser, tremolo |
| **Audio Stereo** | Widening, Haas effect, panning |
| **Audio Saturate** | Saturation/distortion/bit-crush |
| **Audio Convolve (IR)** | Convolution reverb — impulse responses of real spaces |
| **Muse Reverb (FDN)** | Algorithmic reverb (Stop 5 above) |
| **Audio Stem Split** | Split a full song into vocals/drums/bass/other (HDemucs) |
| **Noise Reduction (Spectral)** | Spectral-gating denoise |
| **Audio Beats & Notes** | Beat/note analysis, outputs beat/note labels |
| **Audio Mix / Crossfade / Duck** | Multi-track mixing / crossfades / ducking (background yields to voice) |

---

## Full example 1: playing Für Elise

1. Download a public-domain MusicXML (e.g. [Für Elise on abcnotation](https://abcnotation.com/tunePage?a=trillian.mit.edu%2F~jc%2Fmusic%2Fabc%2Fmirror%2Fmusicaviva.com%2Fbeethoven-ludwig-van%2Fbe059%2Fbe059-pno2%2F0000)) and paste it into **Score**;
2. **Score Performer**: `profile = keyboard`, `humanize = 0.25`, rest default;
3. **Score Synth**: pick FluidR3 as the soundfont, `program = piano`, hit Run, watch the cursor follow the score during playback;
4. **Muse Reverb**: use the "concert hall" preset above. Done.

## Full example 2: an LLM-written jazz sketch

1. Use the Stop-1 prompt template, asking explicitly for **two parts**: "D minor, swung, 8 bars; Part 1 is the right-hand melody, Part 2 is left-hand accompaniment chords (one or two per bar)". Paste into **Score**;
2. **Score Performer**: `swing_ratio = 63`, `profile = keyboard`, `humanize = 0.3`;
3. **Score Synth**: give the two parts different instruments in channel_programs — ch 0 = piano (melody), ch 1 = e_piano or jazz_guitar (comping);
4. **Muse Reverb** ("room" preset) → done.
