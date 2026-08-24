---
name: h3-cinematic-director
description: Convert approved scripts, shot briefs, storyboards, keyframes, character sheets, scene assets, prop sheets, and sound briefs into director-level storyboards and production-ready MiniMax H3 prompts. Use when the user explicitly invokes $h3-cinematic-director or asks for H3 shot design, T2VA/I2VA/FL2VA/L2VA/Ref2VA prompting, camera and performance direction, first/last-frame interpolation, multi-reference control, character/scene continuity auditing, or single-variable repair. Preserve approved story content and never import or reveal private content from another project.
---

# H3 Cinematic Director

## Purpose

Operate as one explicit, self-contained application for four jobs:

1. `shot-design` — turn an approved dramatic beat into necessary, motivated shots.
2. `h3-prompt` — translate an approved shot into the exact MiniMax H3 prompt schema.
3. `continuity-audit` — compare neighboring shots, keyframes, and assets for continuity failures.
4. `single-variable-repair` — repair one failed variable without redesigning the approved shot.

Treat Higgsfield-style director vocabulary as an internal control layer. Keep MiniMax H3's external field names, order, labels, and timing unchanged.

## Invocation

The user may call the skill directly with:

- `$h3-cinematic-director shot-design: ...`
- `$h3-cinematic-director h3-prompt: ...`
- `$h3-cinematic-director continuity-audit: ...`
- `$h3-cinematic-director single-variable-repair: ...`

If no application is named, infer the smallest applicable job from the request. Do not widen the task into story rewriting unless requested.

## Information Boundary

- Use only story, assets, and decisions supplied in the current task or explicitly retrieved with permission.
- Reuse method, terminology, and checklists; never reuse project-specific names, dialogue, plot beats, shot content, images, or private prompts.
- Treat approved script and approved assets as canonical. Flag contradictions instead of silently inventing replacements.
- Do not add plot, characters, props, effects, dialogue, or cuts merely to make an image more spectacular.

## Core Principle

Translate dramatic intention into visible and audible evidence:

`dramatic purpose → spatial blocking → performance → camera → edit → sound → H3 control`

Every instruction must be observable or measurable. Replace vague language such as “cinematic,” “emotional,” or “dynamic” with subject position, action, muscle response, camera path, focal behavior, light source, material behavior, timing, and sound.

## Workflow

### 1. Lock the approved beat

Before designing or prompting, state internally:

- what changes in information, power, emotion, relationship, danger, or space;
- where the previous shot ends and this shot begins;
- the character objective and immediate obstacle;
- the required end state that enables the next shot.

If the shot changes none of these, remove it or mark it as an unjustified insert.

### 2. Build the continuity ledger

Record only relevant hard facts:

- character identity, silhouette, proportions, face, hair, eyes, costume, footwear, carried props;
- prop state, hand occupancy, damage, open/closed state, display content;
- scene geography, entrance/exit, horizon, floor level, landmark positions, screen direction;
- time, weather, key-light direction, color temperature, atmosphere;
- start pose, end pose, gaze, weight center, contact point, pain or fatigue state;
- sound already active before the cut and sound that must bridge out.

Classify facts as `hard continuity`, `soft continuity`, or `expressive variation`. Never sacrifice hard continuity for decorative detail.

### 3. Choose the generation mode

- `T2VA`: use only for concept exploration or shots without reliable assets.
- `I2VA`: use one approved first frame when the action develops forward with moderate change.
- `FL2VA`: use approved first and last frames for continuous movement or visible state change.
- `L2VA`: use one approved last frame when the shot must converge precisely on it.
- `Ref2VA`: use multiple references when identity, environment, prop, action, camera, style, or voice must be separated and controlled.

For the user's local checkpoints:

- Prefer `minimax_h3_fl2va_int8_convrot.safetensors` for T2VA/I2VA/FL2VA/L2VA and clean keyframe interpolation.
- Prefer `minimax_h3_hybrid_fl2va_ref2va_b25-49-int8.safetensors` when several references are necessary. Treat it as a hybrid tradeoff and keep high-priority references few and unambiguous.

### 4. Assign each reference one job

Use a small hierarchy:

1. canonical identity and costume;
2. environment geometry and light;
3. prop structure and state;
4. action pose or motion timing;
5. camera movement;
6. style or color treatment;
7. voice or audio.

Never ask one ambiguous image to control identity, action, style, and composition unless it is also the exact keyframe. Reference priority is:

`identity/assets > scene layout > prop state > action pose > camera example > style decoration`

Use one canonical facial source whenever possible. Use front, profile, and rear sheets to support rotation, not to create competing identities.

### 5. Plan the shot in director controls

Build these controls before writing H3 fields:

- `location map`: foreground, midground, background, entrances, exits, landmarks, left/right relations;
- `first-frame lock`: the image is already active, spatially clear, and compatible with the incoming cut;
- `format`: aspect ratio, duration, one shot or explicit cut times;
- `optics`: FOV or lens feel, camera height, distance, depth of field, focus targets;
- `camera`: one motivated movement with direction, amplitude, speed, and stopping point;
- `action`: intention, anticipation, exertion, contact/near-miss, reaction, recovery, consequence;
- `performance`: gaze, breath, jaw, shoulders, hands, weight shift, hesitation, protective motion;
- `physics`: gravity, momentum, contact, balance, cloth drag, hair follow-through, material deformation;
- `lighting/color`: source direction, Kelvin value, contrast, exposure behavior, palette, material response;
- `sound`: ambience, synchronous foley, voice, subjective sound, silence, non-diegetic score;
- `positive locks`: elements that remain stable through the shot.

Load [references/director-keywords.md](references/director-keywords.md) when the user asks for camera keywords, director language, or a high-control prompt.

### 6. Design the shot or shot group

For every shot, provide:

- shot number and duration;
- dramatic purpose;
- framing, camera position, FOV/lens feel, and camera height;
- composition, depth layers, screen direction, and gaze;
- start state, action phases, end state;
- performance and physical feedback;
- camera movement and focus behavior;
- cut or keyframe connection;
- lighting, color, diegetic sound, dialogue, and music;
- H3 mode, checkpoint, reference labels, and known risk.

Continuous action may use multiple storyboard frames under one shot number. Label them `S17-A`, `S17-B`, `S17-C` or equivalent; do not mislabel every action phase as a new editorial shot.

### 7. Translate into the exact H3 schema

Load [references/h3-formats.md](references/h3-formats.md). Preserve exact field names, field order, reference labels, shot numbering, dialogue tags, and effective duration.

- H3 base modes output only the applicable alignment instruction plus `integrated_multimodal_description`, `overall_soundscape`, and `non_diegetic_music`.
- Ref2VA outputs only `subject_definitions`, `summary`, `retention_analysis`, `detailed_description`, `overall_soundscape`, and `non_diegetic_music` in that order.
- Write H3 fields in English. Preserve dialogue, lyrics, and visible text in their original language.
- Put Higgsfield-derived control language inside the H3 visual timeline; never create extra external sections that violate the H3 schema.
- Match the described timeline to the requested 4–15 second duration.

### 8. Audit before delivery

Load [references/continuity-audit.md](references/continuity-audit.md) and reject or repair the output when:

- the action cannot be understood without explanation;
- the shot lacks a motivated dramatic purpose;
- a character, prop, or scene element appears, disappears, mirrors, duplicates, or changes state without cause;
- the camera crosses the axis or loses the intended geography;
- force, pain, balance, contact, or recovery is physically false;
- the first frame, last frame, or reference role is not respected;
- a cut breaks gaze, motion, light, sound, or screen direction;
- timing exceeds the available duration;
- sound contradicts the image or masks essential dialogue.

## Application Outputs

### shot-design

Lead with a continuity note, then a compact shot table. Explain why each shot exists and how it connects to neighboring shots. Do not write H3 prompts unless asked.

### h3-prompt

Output the copy-ready H3 prompt first. Follow with a concise production note listing mode, checkpoint, duration, reference roles, and high-risk variables.

### continuity-audit

Return:

1. `passing items`;
2. `hard continuity errors`;
3. `shot logic errors`;
4. `model generation risks`;
5. `minimal repair plan`.

Do not redesign passing elements.

### single-variable-repair

State the failed variable, preserve all approved variables, and provide only the replacement prompt clause or replacement keyframe instruction needed. If the source keyframe itself is wrong, say so explicitly.

## Repair Discipline

- Change one high-impact variable per test.
- Prefer positive locks in the main description: “the same coat remains fastened,” “the doorway stays frame-left,” “the prop remains in the right hand.”
- End with short, concrete failure exclusions only for known H3 risks: no identity drift, no duplicated people, no extra limbs, no prop morphing, no mirrored layout, no random text, no disappearing companion.
- If a remote face is too small to carry emotion, preserve identity through silhouette, hair, costume color, and posture, then cut closer when emotion matters.
- If several NPCs appear, specify diversity by age, face shape, hair, clothing, body type, occupation, color, and behavior; never rely on “a varied crowd.”

## Non-Negotiable Quality Bar

- A shot is an instruction about audience attention, not a decorative image.
- A camera move must reveal, follow, compress, release, isolate, destabilize, or transfer attention.
- A close-up must reveal information, vulnerability, thought, or power.
- A transition effect must inherit the destination world's visual and sonic rules while retaining cross-world identity anchors.
- H3 prompt precision never overrides approved story logic.
- Never expose private source material while teaching or packaging this method.
