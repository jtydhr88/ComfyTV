# MiniMax H3 Output Formats

Use this reference when generating the final H3 prompt. Do not rename fields or reorder sections.

## Base mode selection

- T2VA: no alignment line.
- I2VA: one first-frame image at 0.00 seconds.
- FL2VA: first and last images aligned to 0.00 and the exact final time.
- L2VA: one last-frame image aligned to the exact final time.

## Required alignment instructions

I2VA:

```text
For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.
```

FL2VA:

```text
How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot N) aligns with the S.SS-second mark of the target video.
```

L2VA:

```text
How the reference pictures align with the target video — <Picture 1> (from [Shot N]) aligns with the S.SS-second mark of the target video.
```

Replace `N` with the actual final shot and `S.SS` with the effective duration to two decimal places.

## Base mode schema

```text
[alignment instruction when applicable]

integrated_multimodal_description: [Shot 1] ...

overall_soundscape: ...

non_diegetic_music: ...
```

### integrated_multimodal_description

- Establish style, framing, subjects, scene anchors, and active state at `[Shot 1]`.
- Do not timestamp Shot 1.
- Start later shots with `[Shot N] At 00:SS.mmm, the camera cuts to...`.
- A cut must add information, viewpoint, space, state, or time. Otherwise use a motivated camera move.
- For FL2VA, describe the observable path from the opening frame to the final frame. Do not merely restate both images.
- For L2VA, infer a plausible earlier state and progressively converge on the supplied final frame.

### Camera wording

Write camera motion naturally with type, direction, amplitude, speed, and target when relevant:

```text
The camera trucks right with small amplitude at slow speed, keeping the character in the left third while focus shifts from the foreground object to the hand in the midground.
```

Use `push in`, `pull out`, `pan`, `truck`, `tilt`, `pedestal`, `arc`, `tracking`, `static`, `POV`, or `roll`. Distinguish camera translation from focal-length zoom.

### Dialogue and voice

- Assign stable speaker IDs `(S1)`, `(S2)` only to vocal sources.
- Keep the same ID across shots.
- Write dialogue as `<d>[Language] exact dialogue</d>`.
- Preserve user-provided words and punctuation.
- For voiceover, write `says in an off-screen voiceover` and then state that the on-screen character's lips remain completely closed.
- Use `<scenetrans>` when speech crosses a cut and `<cutoff>` when the video truncates it.

### Sound fields

`overall_soundscape` uses 1–4 English sentences for ambience, physical sounds, foley, and non-verbal vocal sounds. Do not repeat dialogue or music. Use `N/A` only for explicit total silence.

`non_diegetic_music` uses 1–3 English sentences for audience-only score, with instrumentation, tempo, rhythm, and dynamics. Use `N/A` when absent.

## Ref2VA schema

```text
subject_definitions:
<Subject 1> ...
<Picture 1> ...
<Video 1> ...
<Audio 1> ...

summary:
[reference generation] ...

retention_analysis:
<Subject 1> (appears in [Shot 1]): fully_preserved - ...

detailed_description:
The target video uses ...
[Shot 1] ...

overall_soundscape:
...

non_diegetic_music:
...
```

### Reference labels

- `<Subject N>`: reusable visible identity, object, environment, costume, style, action, pose, or effect.
- `<Picture N>`: a concrete first frame, keyframe, last frame, or storyboard/composition anchor.
- `<Video N>`: source video, continuation source, or temporal/camera structure.
- `<Audio N>`: copied or referenced audio, voice timbre, rhythm, music, or effect texture.

Keep every label's meaning stable across all six sections. Do not create a standalone `<Picture N>` when the picture only defines a subject; cite it inside that subject definition.

### Summary task prefixes

Use one or more as applicable: `keyframe completion`, `reference generation`, `video editing`, `video continuation`, `audio reuse`, `audio reference`.

### Retention markers

For visible references use `fully_preserved`, `partially_preserved`, `attribute_transfer`, or `weak_reference`.

For audio use `fully_copy`, `partially_copy`, `reference`, or `weak_reference`.

### Detailed description

- Establish style in one or two sentences before `[Shot 1]`.
- Describe composition, subject position, environment, action, state change, camera, lighting, sound, and the exact point where each reference takes effect.
- Use 350–500 English words for a normal generation task when complexity warrants it; prioritize a correct timed sequence over word count.

## Prompt assembly order inside H3 fields

Use this invisible drafting order, then weave it into the required H3 fields:

`format/style → reference responsibilities → identity → spatial map → first-frame state → timed action → performance → optics/camera/focus → physics/materials → light/color → synchronized sound → stable-state locks → known failure exclusions`

