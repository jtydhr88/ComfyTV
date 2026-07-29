# Particles

> A 2D particle generator — sparks, embers, smoke, magic dust — composited over your clip, with a live Canvas2D preview.

## What this node does

**Particles** simulates a 2D particle system and composites it onto a `COMFYTV_VIDEO` clip (or renders it over a blank/transparent field when no video is wired). Particles are born from an emitter, pushed around by forces (gravity, wind, turbulence, attractor, swirl), optionally collide with a floor, and are drawn as glowing sprites, stretched streaks, or trails. The node has a live Canvas2D preview so you can dial the look before committing, and a **▶ Run** that renders the final composite as a new video snapshot.

You can also drive emission from a mask: wire **mask_video** or **mask_image** and the emitter switches to `mask_edge`, spawning particles along the mask's edges (great for outlining or "dissolving" a subject).

In and out are `COMFYTV_VIDEO`. To interoperate with native ComfyUI nodes, insert a **Bridge** — see the [bridge guide](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## When to use it

- Add fire embers, sparks, snow, rain, magic dust, or smoke over live footage.
- Emit particles along a subject's silhouette (mask-edge) for a dissolve or energy-outline effect.
- Create looping background motion (dust motes, bokeh) that reacts to gravity and wind.

## Parameters

Positions are normalized `0..1` (fractions of frame width/height). Angles are in degrees. Velocities/forces are in pixels per second unless noted.

### emitter and emitter shape
- **emitter** — where particles spawn: `point`, `line`, `rect`, `circle`, or `mask_edge`. Default `point`. (`mask_edge` requires a wired mask, see below.)
- **e_x0, e_y0** — first anchor of the emitter (default `0.5`, `0.85`). Used as the point, or the start of the line/rect/circle.
- **e_x1, e_y1** — second anchor (default `0.5`, `0.85`), defining the far corner/extent for line/rect/circle emitters.

### Emission
- **rate** — particles spawned per second, `0`–`2000`, default `120`. Set to `0` and the node passes the video through unchanged.
- **lifetime** — how long each particle lives, in seconds, `0.1`–`10.0`, default `2.0`.
- **speed** — initial launch speed, `0`–`1200`, default `120`.
- **direction** — launch angle in degrees, `-180`–`180`, default `-90` (straight up).
- **spread** — random angular cone around **direction**, `0`–`180`, default `30`.
- **warmup** — seconds of simulation run before the first output frame, `0`–`10`, default `1`, so the effect starts already "filled in" rather than empty.
- **seed** — random seed, `0`–`99999`, default `7`, for repeatable results.

### Forces
- **gravity** — downward pull, `-600`–`600`, default `60` (negative rises).
- **wind** — horizontal push, `-600`–`600`, default `0`.
- **turbulence** — strength of noise-driven swirl, `0`–`600`, default `60`.
- **turb_scale** — spatial scale of the turbulence noise, `8`–`600`, default `120` (larger = broader swirls).
- **drag** — velocity damping per step, `0`–`0.99`, default `0.1` (higher = particles slow faster).
- **swirl** — rotational force around the attractor point, `-600`–`600`, default `0`.

### Attractor
- **attract_strength** — pull toward (positive) or push from (negative) the attractor, `-600`–`600`, default `0` (off).
- **attract_x, attract_y** — attractor position, `0..1`, default `0.5, 0.5`.
- **attract_radius** — falloff radius of the attractor, `0.05`–`1.5`, default `0.5`.

### Collision
- **collide** — floor collision behavior: `none` (default), `bounce`, or `die`.
- **floor_y** — floor height as a fraction of frame height, `0..1`, default `0.9`.
- **bounce** — restitution on bounce, `0`–`1`, default `0.5` (fraction of speed kept).

### Sub-emission (secondary bursts)
- **sub_mode** — when to spawn a secondary burst: `none` (default), `on_death`, or `on_collide`.
- **sub_count** — particles per burst, `0`–`30`, default `8`.
- **sub_speed** — burst launch speed, `0`–`600`, default `120`.
- **sub_lifetime** — burst particle life in seconds, `0.1`–`5.0`, default `0.6`.
- **sub_size_ratio** — burst size relative to parent, `0.1`–`2.0`, default `0.5`.
- **sub_color** — burst color as hex, default `#FFF2B0`.

### Size, opacity and color over life
- **size** — starting particle size in pixels, `1`–`64`, default `12`.
- **size_end_ratio** — end size relative to start, `0`–`3`, default `0.4` (particles shrink by default).
- **opacity_start / opacity_end** — alpha at birth and death, each `0`–`1`, default `1.0` / `0.0` (fade out).
- **size_curve / opacity_curve** — optional custom curves as JSON `[{t,v}, ...]` (t = life fraction 0–1, v = multiplier). Leave blank to use the simple start/end ramp above.
- **color0 / color1** — start and end colors as hex, default `#FFD27A` / `#FF5A2A` (particles tint from color0 to color1 over life).

### Look / rendering
- **sprite** — particle texture: `glow` (soft dot, default), `spark`, or `star`.
- **renderer** — how particles are drawn: `sprite` (default), `stretched` (motion-stretched), or `trail` (draws a tail).
- **stretch** — stretch amount for the stretched renderer, `0`–`3`, default `1`.
- **trail_len** — number of trail segments for the trail renderer, `2`–`5`, default `4`.
- **blend** — composite mode over the video: `additive` (default, glowy) or `over` (normal alpha).

### Inputs
- **video** (`COMFYTV_VIDEO`, optional) — the clip to composite onto. Without it, particles render on their own field.
- **mask_video** (`COMFYTV_VIDEO`, optional) / **mask_image** (`COMFYTV_IMAGE`, optional) — wire either to spawn from mask edges; the emitter is forced to `mask_edge`. If you pick the `mask_edge` emitter but wire no mask, the node errors.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | The clip with particles composited, as a new project snapshot |

## Tips

- **rate = 0** short-circuits the node: it passes the input video through untouched.
- **warmup** matters for looks that should already be full at frame 1 (falling snow, rising embers) — without it the effect builds up from empty.
- `additive` blend reads as glowing light (sparks, magic); use `over` for opaque particles like snow or debris.
- The Canvas2D preview lets you tune forces and look before the (slower) **▶ Run** render.
- Mask-edge emission needs a mask wired to **mask_video** or **mask_image**; selecting the `mask_edge` emitter alone will error.

## Related nodes

- **Blur / Sharpen** — soften or sharpen the composited result.
- **Video Denoise** — clean the base clip before adding particles.
