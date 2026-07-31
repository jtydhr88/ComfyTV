**English** | [简体中文](video-and-audio.zh.md)

# Video & audio

> Video **generation** lives in the Generate group (see [generate.md](generate.md)). This page is a tour of the **video and audio suites** — around 100 video nodes and 30+ audio nodes. Everything below works directly on the clip itself, with no AI model to download, and many nodes preview live right in the browser. For per-node parameters, see the **Node Reference** on [comfytv.org](https://comfytv.org).

![Video editing stages](images/video-tools.png)

---

## Video editing (ComfyTV / Video)

Feed a video (from a **Generate → Video** stage or a **Load Video** node) into any of these:

- **Clip / Split / Concat** — trim to a range, cut at a timestamp (two outputs), join clips.
- **Crop / Resize / Rotate / Speed** — region crop, resolution change, 90°-step rotation, variable speed and reverse.
- **Extract Frame / Extract Frames** — pull a single still, or mark timestamps on the timeline and export them as a set.
- **Scene Detect** — find cuts, preview each scene, and split precisely at a detected boundary.
- **Make Proxy** — generate a lightweight proxy; players transparently switch to it for smooth scrubbing on heavy footage.
- **Volume / Mux Audio / Demux** — fade in/out, replace or add an audio track, or split a clip into its audio track and silent video (the 🔀 **Demux** toolbar action spawns both at once).
- **↪ Extend** (toolbar action) — one-click chain: extract the source's last frame, spawn a new Video Stage, wire that frame as the I2V starting image.

Still pending backend wiring: **Video Upscale** and **Subtitle Erase (Smart / Region)** — see [roadmap.md](roadmap.md).

## Color (ComfyTV / VideoFX)

Color wheels with lift-gamma-gain (**Video Color**), **Curves**, **LUT** (live preview; LUT files come from the resource library), **ASC CDL**, **HueCorrect**, **Selective Color**, **Histogram EQ**, **Gray World** white balance.

## Keying & matte (ComfyTV / Keying)

<!-- TODO(screenshot): the keyer bench — e.g. PIK + Matte Monitor on a green-screen clip -->
![Keying bench](images/keying-bench.png)

A full keyer bench modeled on pro compositors: **Chroma Key**, **PIK** (image-based keyer), **Keyer**, **Despill**, **Color Suppress**, **Select0r**, **KeyMix**, **Matte Monitor**, and **Matte Morphology** for growing / shrinking / feathering mattes.

## Roto, tracking & paint

**Roto Mask** (bezier shapes with feather, keyframable), **Shape Mask**, **Motion Track** (point tracking that can drive transforms or corner pins), **Mask Propagate** (optical-flow tracking of a mask across frames), **Paint Strokes** (paint / clone brushes over time), **Face Blur** and **Spot Remover**.

## Compositing & transitions (ComfyTV / Compose)

**Video Composite** (39 blend modes, opacity, masks), **Video Transform** and **Corner Pin** (keyframable), **Video Transition** (57 xfade families), **Luma Wipe** (gradient-image wipes), **Time Remap** (speed curves), **Sequence** (assemble clips on a track).

## Effects (ComfyTV / VideoFX)

Light & optics: **Glow**, **God Rays**, **Lens Distort** (multiple lens models), **Chromatic Aberration**, **Lens Flare**, **Z-Defocus**.
Texture & era: **Old Film**, **Regrain**, **Frame Blend**, **Posterize**, **Pseudocolor**, **Chroma Shift**.
Art & warp: **Particles**, **Glitch FX**, **Art FX**, **Kaleidoscope**, **Wave Warp**, **Water**, **Light Graffiti**, **Slit Scan**, **Feedback FX**, **Strobe**, **Stylize**, **Ken Burns**.
360 & projection: **360 Projection**, **360 Stabilize**, **Card 3D**, **UV Remap (STMap)** + **STMap Generate**.
Enhance: **Denoise**, **Blur / Sharpen**, **Deinterlace**, **Frame Interpolate**, **Stabilize** / **Stabilize Pro**.

## Text, analysis & infrastructure

- **Title / Subtitles / Annotate** — text overlays, subtitle tracks, and review annotations (boxes, arrows, grids).
- **Subtitles · Speech-to-Text** — generate a subtitle track from the audio.
- **Video Scopes** — waveform / vectorscope / histogram / RGB parade for QC.
- **Expression** — drive any numeric parameter with a math expression.
- **FX Chain** — stack many FX nodes and render the whole chain in a single pass, with a live preview of the combined result.

<!-- TODO(screenshot): an FX Chain with a few chained effects and its live preview -->
![FX Chain](images/fx-chain.png)

---

## Audio (ComfyTV / Audio · AudioFX)

<!-- TODO(screenshot): a few audio nodes chained — e.g. Stem Split → EQ (graph UI) → Loudness -->
![Audio suite](images/audio-fx.png)

- **Stem Split** — separates a track into vocals / accompaniment / drums / bass / other. Built in, nothing extra to install; works on audio or the audio of a video.
- **Dynamics** (compressor, gate, limiter, de-esser), **EQ** (parametric, with a graph UI), **Loudness** (LUFS normalization).
- **Denoise** / **Noise Reduction (Spectral)** / **Repair** — broadband and spectral-gate denoising, click and artifact repair.
- **Time / Pitch** — time-stretch and pitch-shift; **Saturate**, **Echo**, **Modulation** (tremolo / flanger / …), **Stereo** tools.
- **Reverb** — **Audio Convolve (IR)** for convolution reverb, with **Audio Sweep** + **Audio Deconvolve** to capture the sound of a real room and reuse it; **Muse Reverb** for algorithmic reverb.
- **Mix / Crossfade / Duck** — multi-track mixing, crossfades, sidechain ducking under a voice track.
- **Beats & Notes** — detects the beat grid and the individual notes in a track; **Analyze** and **Visualize** for inspection; **Split Export** for segment slicing.
- **Audio Reactive** + **Audio Meter Overlay** — turn the audio's envelope into parameter automation for video FX, and burn level meters into the picture.

A separated / extracted audio track can be wired into a **Video Stage**'s optional `audio` input for audio-driven video (works with LTX 2.3 IA2V).

For **music composition** (scores, piano rolls, SoundFont synthesis), see [making-music.md](making-music.md).
