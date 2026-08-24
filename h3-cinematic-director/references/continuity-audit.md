# Continuity and Shot-Logic Audit

Run this audit against the approved asset sheet, the previous shot's final frame, the current shot's first and last states, and the next shot's required entry state.

## 1. Dramatic necessity

- What new information, emotional turn, power shift, spatial fact, or consequence enters?
- Can the audience understand the beat from visible behavior and sound?
- Is a close-up, insert, reaction, or transition earning its cut?
- Can the same information be staged in the existing shot without weakening clarity?

Reject decorative shots that change nothing.

## 2. Character identity

Compare:

- age impression, face shape, jaw, nose, ears, brow, eye shape and eye colors;
- hair color, hairline, part, bangs, silhouette, strand grouping, rear shape;
- body height, head-to-body ratio, shoulders, limb proportions, hand scale;
- costume layers, collar, closures, seams, hardware, hem, gloves, footwear;
- accessories, scars, makeup, dirt, wetness, damage, and carried props.

Use a single canonical face source. Secondary views supply angle and rear construction only. For distant shots, lock silhouette, hair, costume blocks, and posture; do not demand invisible facial micro-detail.

## 3. NPC diversity

For crowds, build a visible matrix rather than repeating one template:

- age band;
- face shape and facial-hair state;
- hairstyle and color;
- body height, width, posture, and mobility;
- clothing silhouette, dominant color, layers, and occupation cue;
- eyeglasses, bags, devices, or personal props;
- action and attention target.

Do not duplicate the protagonist's face, hair, costume, or color signature among NPCs.

## 4. Scene geography

Verify:

- number and position of doors, windows, steps, platforms, furniture, vehicles, screens, and landmarks;
- floor level, horizon, vanishing direction, ceiling height, and scale;
- foreground, midground, and background occupancy;
- entrance and exit paths;
- camera side of the 180-degree axis;
- screen direction and eyelines;
- light source direction, weather, time, atmosphere, and color temperature.

If geography changes, require a motivated move, transition, or establishing image. Never teleport a subject or mirror the set to repair a composition.

## 5. Prop and state continuity

Track each important prop:

- owner and hand;
- position relative to the body and scene;
- orientation, scale, material, markings, and display content;
- open/closed, intact/damaged, charged/empty, wet/dry, clean/dirty;
- cause and exact moment of every state change.

No prop may disappear behind a cut unless it is put down, passed, concealed, exits frame, or is intentionally withheld by composition.

## 6. Action causality and physicality

Check the chain:

`intent → preparation → exertion → contact/imbalance → result → involuntary response → controlled recovery`

Verify support foot, center of gravity, contact point, force direction, momentum, hand occupancy, distance, and recovery path. Pain must correspond to the actual impact site. Emotional suppression may flatten the face but not erase breath interruption, muscle tension, protective motion, or delayed recovery.

For one continuous action, use several storyboard states under one shot number when appropriate. A new editorial shot requires a new viewpoint, information function, time relation, or attention change.

## 7. Camera and focus logic

- Establish space before a complex action or relational cut.
- Use camera translation when parallax and spatial revelation matter; use pan/tilt when pivoting from a fixed position; use zoom only when focal-length change is intentional.
- Keep one dominant camera idea per short H3 shot.
- Define start frame, path, speed, amplitude, and stopping point.
- Every rack focus must move attention to new evidence or reaction.
- Preserve horizon, axis, screen direction, and gaze across cuts.
- Avoid combining arc, whip pan, zoom, roll, transformation, and complex body action in one prompt.

## 8. Keyframe compatibility

For first/last-frame tasks, compare:

- same identity and costume;
- same scene geometry and light source;
- physically reachable pose and position;
- compatible camera height, perspective, and lens feel;
- prop state changes with a visible cause;
- enough duration for the action path;
- final 0.5 seconds available for convergence when a precise landing matters.

If the two images cannot be connected physically, fix the keyframe instead of hiding the discontinuity in text.

## 9. Sound continuity

Track:

- room tone, ambience, weather, machine hum, crowd bed;
- off-screen sources and their direction/distance;
- synchronous foley and impacts;
- voice identity, language, cadence, breath, and lip state;
- subjective sound and the moment it enters/exits;
- music instrumentation, tempo, dynamics, and ducking;
- sound bridges and deliberate silence.

Reject audio that contradicts material, distance, action timing, or shot geography.

## 10. H3 failure signatures and minimal repairs

| Failure | Minimal repair |
| --- | --- |
| face drifts during turn | strengthen one canonical identity reference; add profile/rear support; reduce turn amplitude |
| costume changes | describe garment construction positively; remove competing style reference |
| prop switches hand | lock hand occupancy in start, action, and end states |
| companion disappears | state its fixed frame position and continuous presence through every action phase |
| crowd clones | define an NPC diversity matrix and lower equal-priority face references |
| set mirrors | lock landmark positions, screen direction, and camera side of axis |
| action floats | add anticipation, planted foot, weight transfer, contact, momentum, and recovery |
| pain is disconnected | name impact site and involuntary protective response |
| end frame misses | simplify the path and reserve the final 0.5 seconds for convergence |
| camera becomes chaotic | keep one movement; specify amplitude, speed, target, and stop |
| dialogue is unclear | shorten the line, isolate the speaker, reduce competing sound, leave temporal space |
| random text appears | remove unnecessary signage and add a concrete no-random-text exclusion |

## 11. Delivery verdict

Use one verdict:

- `PASS` — hard continuity, shot logic, physicality, H3 feasibility, and cut compatibility pass.
- `PASS WITH SOFT VARIATION` — only non-critical background or micro-detail varies.
- `REPAIR ONE VARIABLE` — one contained fix can preserve the shot.
- `REBUILD KEYFRAME` — the source image is incompatible with the required action or continuity.
- `REDESIGN SHOT` — the dramatic or spatial logic fails and cannot be repaired by prompting.

